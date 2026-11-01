import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { DayFacts, DayShift } from './day-digest';

const TZ = 'Asia/Kolkata';
/** a timestamptz column within one India day ($2 is the date) */
const within = (col: string) => `${col} >= ($2::date::timestamp at time zone '${TZ}') and ${col} < (($2::date + 1)::timestamp at time zone '${TZ}')`;

/**
 * What happened in one store on one day, beyond the sales numbers: each shift, the customers, purchases received, audit and adjustment activity,
 * complaints, and the cash moved on the drawers. It only reads; the wording and who sees what is in day-digest.ts.
 */
@Injectable()
export class DayDetailBuilder {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async forStore(storeId: number, date: string): Promise<DayFacts> {
    const shifts = await this.shifts(storeId, date);
    const ids = shifts.map((s) => s.id);
    const [customers, purchases, audits, adjustments, complaints, money, overdue] = await Promise.all([
      this.customers(storeId, date), this.purchases(storeId, date), this.audits(storeId, date), this.adjustments(storeId, date),
      this.complaints(storeId, date), this.money(ids), this.overdue(storeId),
    ]);
    const first = shifts[0];
    const last = shifts.length ? shifts[shifts.length - 1] : null;
    return {
      shifts: shifts.map(({ id, ...s }) => s),
      customers, purchases, audits, adjustments, complaints,
      cash: {
        opening: first ? first.opening : null, cashSales: shifts.reduce((a, s) => a + s.cashSales, 0),
        expenses: money.expenses, refunds: money.refunds, deposits: money.deposits,
        expected: last ? last.expected : null, counted: last && last.status !== 'OPEN' ? last.counted : null,
      },
      expensesByCategory: money.byCategory, overdueInvoices: overdue,
    };
  }

  private async shifts(storeId: number, date: string): Promise<(DayShift & { id: number; opening: number; expected: number; counted: number | null })[]> {
    const rows = await this.manager.query(
      `select sh.id, sh.name, sh.start_time, sh.end_time, sh.status, sh.close_type, sh.opening_cash::float as opening, sh.expected_cash::float as expected, sh.counted_cash::float as counted,
              sh.closing_digital,
              count(s.id) filter (where s.status = 'COMPLETE' and s.active = true)::int as bills,
              coalesce(sum(s.total) filter (where s.status = 'COMPLETE' and s.active = true), 0)::float as sales,
              coalesce(sum(s.cash_amount) filter (where s.status = 'COMPLETE' and s.active = true), 0)::float as cash_sales
         from store_shifts sh left join sale s on s.shift_id = sh.id
        where sh.store_id = $1 and sh.shift_date = $2::date
        group by sh.id order by sh.opened_on nulls last, sh.id`, [storeId, date]);
    return rows.map((r: any) => {
      const closed = r.status !== 'OPEN';
      const digital = (Array.isArray(r.closing_digital) ? r.closing_digital : []).reduce((a: number, d: any) => a + (Number(d.variance) || 0), 0);
      return {
        id: r.id, name: r.name, start: r.start_time ?? null, end: r.end_time ?? null, status: r.status, handover: r.close_type === 'HANDOVER',
        bills: r.bills, sales: r.sales, cashSales: r.cash_sales, opening: r.opening, expected: r.expected, counted: r.counted ?? null,
        cashVariance: closed && r.counted !== null && r.counted !== undefined ? Math.round((r.counted - r.expected) * 100) / 100 : null,
        digitalVariance: closed ? Math.round(digital * 100) / 100 : 0,
      };
    });
  }

  /** a customer is new when the day holds their first completed bill */
  private async customers(storeId: number, date: string) {
    const [c] = await this.manager.query(
      `with mine as (select s.customer_id, s.bill_date from sale s join store_shifts sh on sh.id = s.shift_id
                      where sh.store_id = $1 and sh.shift_date = $2::date and s.status = 'COMPLETE' and s.active = true),
            first_today as (select customer_id, min(bill_date) as d from mine where customer_id is not null group by 1)
       select (select count(*) from mine where customer_id is null)::int as none,
              count(*) filter (where not exists (select 1 from sale p where p.customer_id = f.customer_id and p.status = 'COMPLETE' and p.active = true and p.bill_date < f.d))::int as new_c,
              count(*)::int as known
         from first_today f`, [storeId, date]);
    return { newCount: c?.new_c ?? 0, returning: (c?.known ?? 0) - (c?.new_c ?? 0), none: c?.none ?? 0 };
  }

  private async purchases(storeId: number, date: string) {
    const [p] = await this.manager.query(
      `select count(*)::int as invoices, coalesce(sum(total), 0)::float as total from purchase_invoice
        where store_id = $1 and active = true and archive = false and invoice_date >= $2::date and invoice_date < $2::date + 1`, [storeId, date]);
    return { invoices: p?.invoices ?? 0, total: p?.total ?? 0 };
  }

  private async audits(storeId: number, date: string) {
    const [a] = await this.manager.query(
      `select count(*) filter (where ${within('completed_on')})::int as finished, count(*) filter (where ${within('certified_on')})::int as signed,
              coalesce(sum(lines_changed) filter (where ${within('completed_on')}), 0)::int as changed
         from stock_audit where store_id = $1`, [storeId, date]);
    return { finished: a?.finished ?? 0, signedOff: a?.signed ?? 0, linesChanged: a?.changed ?? 0 };
  }

  private async adjustments(storeId: number, date: string) {
    const [a] = await this.manager.query(
      `select count(*) filter (where status = 'PENDING')::int as pending,
              coalesce(floor(extract(epoch from now() - min(created_on) filter (where status = 'PENDING')) / 86400), 0)::int as oldest,
              count(*) filter (where status = 'APPROVED' and ${within('updated_on')})::int as approved
         from product_qtychange where store_id = $1 and active = true and archive = false`, [storeId, date]);
    return { pending: a?.pending ?? 0, oldestDays: a?.pending ? a.oldest : null, approvedToday: a?.approved ?? 0 };
  }

  private async complaints(storeId: number, date: string) {
    const [g] = await this.manager.query(
      `select count(*) filter (where ${within('created_on')})::int as opened, count(*) filter (where resolved_on is null)::int as open from grievance where store_id = $1`, [storeId, date]);
    return { opened: g?.opened ?? 0, open: g?.open ?? 0 };
  }

  /** what the drawers paid out on the day's shifts */
  private async money(shiftIds: number[]) {
    if (!shiftIds.length) return { expenses: 0, refunds: 0, deposits: 0, byCategory: [] as { category: string; total: number }[] };
    const [m] = await this.manager.query(
      `select coalesce(sum(withdraw) filter (where category = 'EXPENSE'), 0)::float as expenses, coalesce(sum(withdraw) filter (where category = 'REFUND'), 0)::float as refunds,
              coalesce(sum(withdraw) filter (where category = 'BANK_DEPOSIT'), 0)::float as deposits
         from store_cash_accounts where shift_id = any($1::int[])`, [shiftIds]);
    const cats = await this.manager.query(
      `select coalesce(nullif(btrim(expense_category), ''), 'Other') as category, sum(withdraw)::float as total from store_cash_accounts
        where shift_id = any($1::int[]) and category = 'EXPENSE' group by 1 order by 2 desc`, [shiftIds]);
    return { expenses: m.expenses, refunds: m.refunds, deposits: m.deposits, byCategory: cats.map((c: any) => ({ category: c.category, total: c.total })) };
  }

  private async overdue(storeId: number): Promise<number> {
    const [o] = await this.manager.query(
      `select count(*)::int as n from purchase_invoice where store_id = $1 and active = true and archive = false and due_date < current_date and lower(coalesce(payment_status, '')) <> 'paid'`, [storeId]);
    return o?.n ?? 0;
  }
}
