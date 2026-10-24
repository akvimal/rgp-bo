import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

export const INVOICE_VIEWS = ['all', 'pending', 'overdue', 'due7', 'hold', 'paid', 'draft', 'awaiting'] as const;
export type InvoiceView = typeof INVOICE_VIEWS[number];

export interface InvoiceFilter { vendor?: number; from?: string; to?: string; q?: string }
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// sortable columns -> SQL (all from the wrapped query below)
const SORTS: Record<string, string> = {
  invoice_date: 'invoice_date', due_date: 'due_date', total: 'total', paid_amount: 'paid', balance_amount: 'balance',
  business_name: 'lower(business_name)', invoice_no: 'coalesce(invoice_no, challan_no)', payment_status: 'payment_status', items: 'items',
};

/**
 * Purchase invoices as the person who pays them sees them: what is pending, what is overdue, what falls due this
 * week, what is on hold, what is paid, and what is still only a draft (not received, so never owed). Balances come
 * from the payments recorded against each invoice, the same arithmetic as the Outstanding and Payables screens.
 */
@Injectable()
export class InvoiceViewService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
  ) {}

  /** Shared SELECT: one row per invoice with paid, balance and the derived flags. Filters are bound parameters. */
  private base(f: InvoiceFilter) {
    const where: string[] = ['i.active and not i.archive'];
    const args: any[] = [];
    const add = (sql: string, v: any) => { args.push(v); where.push(sql.split('?').join(`$${args.length}`)); };
    if (f.vendor) add('i.vendor_id = ?', f.vendor);
    if (f.from && DATE.test(f.from)) add('i.invoice_date >= ?::date', f.from);
    if (f.to && DATE.test(f.to)) add('i.invoice_date <= ?::date', f.to);
    if (f.q && f.q.trim()) add(`(i.invoice_no ilike ? or i.challan_no ilike ?)`, `%${f.q.trim()}%`);
    const sql = `
      select w.*,
             greatest(w.total - w.paid, 0) as balance,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005) as pending,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status = 'On Hold') as on_hold,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.due_date < current_date) as overdue,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.due_date >= current_date and w.due_date <= current_date + 7) as due7,
             (w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid <= 0.005) as is_paid,
             (w.status <> 'COMPLETE') as draft,
             (w.status = 'COMPLETE' and w.invoice_no is null) as awaiting,
             case when w.status <> 'COMPLETE' then 'Draft'
                  when w.invoice_no is null then 'Awaiting invoice'
                  when w.total - w.paid <= 0.005 then 'Paid'
                  when w.stored_status = 'On Hold' then 'On Hold'
                  when w.due_date < current_date then 'Overdue'
                  when w.paid > 0.005 then 'Part Paid'
                  else 'Unpaid' end as payment_status,
             case when w.status = 'COMPLETE' and w.invoice_no is not null and w.total - w.paid > 0.005 and w.stored_status <> 'On Hold' and w.due_date < current_date
                  then (current_date - w.due_date) else 0 end as days_overdue,
             case when w.status = 'COMPLETE' and w.invoice_no is null then (current_date - coalesce(w.challan_date, w.invoice_date)) else 0 end as days_waiting
        from (
          select i.id, i.vendor_id, btrim(v.business_name) as business_name, i.invoice_no, i.challan_no, i.challan_date, i.invoice_date,
                 coalesce(i.due_date, i.invoice_date) as due_date, i.status, i.total::numeric as total,
                 coalesce(i.payment_status, 'Unpaid') as stored_status, i.gst_recon_status, i.gst_period,
                 i.hold_reason, p.paid, p.last_payment, p.payments,
                 (select count(*) from purchase_invoice_item x where x.invoice_id = i.id)::int as items
            from purchase_invoice i
            join vendor v on v.id = i.vendor_id
            left join lateral (select coalesce(sum(amount), 0)::numeric as paid, max(pay_date) filter (where amount > 0) as last_payment,
                                      (count(*) filter (where amount > 0))::int as payments
                                 from vendor_payment where invoice_id = i.id) p on true
           where ${where.join(' and ')}
        ) w`;
    return { sql, args };
  }

  private viewClause(view: string): string {
    switch (view) {
      case 'pending': return 'pending';
      case 'overdue': return 'overdue';
      case 'due7': return 'due7';
      case 'hold': return 'on_hold';
      case 'paid': return 'is_paid';
      case 'draft': return 'draft';
      case 'awaiting': return 'awaiting';
      default: return 'true';
    }
  }

  async search(f: InvoiceFilter, view: string, sort: string | undefined, dir: string | undefined, page = 1, limit = 25) {
    const { sql, args } = this.base(f);
    const v = (INVOICE_VIEWS as readonly string[]).includes(view) ? view : 'all';
    // unpaid views read best oldest-due first; the rest newest first
    const defaultSort = ['pending', 'overdue', 'due7', 'hold'].includes(v) ? 'due_date asc' : v === 'awaiting' ? 'invoice_date asc' : 'invoice_date desc';
    const col = sort && SORTS[sort] ? `${SORTS[sort]} ${dir === 'asc' ? 'asc' : 'desc'}, id desc` : `${defaultSort}, id desc`;
    const safeLimit = Math.min(100, Math.max(1, limit || 25));
    const safePage = Math.max(1, page || 1);
    const rows = await this.manager.query(
      `select *, count(*) over ()::int as total_rows from (${sql}) x where ${this.viewClause(v)}
        order by ${col} limit ${safeLimit} offset ${(safePage - 1) * safeLimit}`, args);
    const data = rows.map((r: any) => ({
      id: r.id, vendor_id: r.vendor_id, business_name: r.business_name, invoice_no: r.invoice_no, challan_no: r.challan_no, challan_date: r.challan_date,
      awaiting: r.awaiting, days_waiting: +r.days_waiting,
      invoice_date: r.invoice_date, due_date: r.due_date, status: r.status, payment_status: r.payment_status,
      items: r.items, total: +r.total, paid_amount: +r.paid, balance_amount: +r.balance, days_overdue: +r.days_overdue,
      last_payment: r.last_payment, payments: r.payments, on_hold: r.on_hold, hold_reason: r.hold_reason,
      gst_status: r.gst_recon_status, gst_period: r.gst_period,
    }));
    return { data, total: rows[0]?.total_rows ?? 0, page: safePage, limit: safeLimit, view: v };
  }

  /** The chip totals above the list, for the same vendor / date / search filters (not for the chosen view). */
  async summary(f: InvoiceFilter) {
    const { sql, args } = this.base(f);
    const [r] = await this.manager.query(
      `select count(*)::int as all_n,
              count(*) filter (where pending)::int as pending_n, coalesce(round(sum(balance) filter (where pending), 2), 0) as pending_amt,
              count(*) filter (where overdue)::int as overdue_n, coalesce(round(sum(balance) filter (where overdue), 2), 0) as overdue_amt,
              count(*) filter (where due7)::int as due7_n, coalesce(round(sum(balance) filter (where due7), 2), 0) as due7_amt,
              count(*) filter (where on_hold)::int as hold_n, coalesce(round(sum(balance) filter (where on_hold), 2), 0) as hold_amt,
              count(*) filter (where is_paid)::int as paid_n, coalesce(round(sum(total) filter (where is_paid), 2), 0) as paid_amt,
              count(*) filter (where draft)::int as draft_n, coalesce(round(sum(total) filter (where draft), 2), 0) as draft_amt,
              count(*) filter (where awaiting)::int as awaiting_n, coalesce(round(sum(total) filter (where awaiting), 2), 0) as awaiting_amt,
              coalesce(max(days_waiting) filter (where awaiting), 0)::int as awaiting_oldest
         from (${sql}) x`, args);
    const n = (k: string) => +r[k];
    return {
      all: { count: n('all_n') },
      pending: { count: n('pending_n'), amount: n('pending_amt') },
      overdue: { count: n('overdue_n'), amount: n('overdue_amt') },
      due7: { count: n('due7_n'), amount: n('due7_amt') },
      hold: { count: n('hold_n'), amount: n('hold_amt') },
      paid: { count: n('paid_n'), amount: n('paid_amt') },
      draft: { count: n('draft_n'), amount: n('draft_amt') },
      awaiting: { count: n('awaiting_n'), amount: n('awaiting_amt'), oldest_days: n('awaiting_oldest') },
    };
  }

  /** Payment history of one invoice, oldest first, with who recorded each entry. A reversal shows as its own line. */
  async payments(invoiceId: number) {
    const [inv] = await this.manager.query(`select id from purchase_invoice where id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    return this.manager.query(
      `select p.id, to_char(p.pay_date, 'YYYY-MM-DD') as paydate, p.amount::numeric as amount, p.pay_mode as paymode, p.trans_ref as transref,
              p.status, p.reverses_id as reversesid, p.batch_ref as batchref, p.remarks, p.created_on as createdon,
              u.full_name as createdby, p.communication_status as communicationstatus
         from vendor_payment p left join app_user u on u.id = p.created_by
        where p.invoice_id = $1 order by p.pay_date, p.id`, [invoiceId]);
  }

  /** Puts a received invoice with a balance on hold: no payment can be recorded against it until released. */
  async hold(invoiceId: number, reason: string, userid: number) {
    const why = (reason || '').trim();
    if (why.length < 5) throw new BadRequestException('Give a reason of at least 5 characters.');
    const [inv] = await this.manager.query(
      `select i.id, i.invoice_no, i.status, i.total::numeric - coalesce((select sum(amount) from vendor_payment where invoice_id = i.id), 0)::numeric as balance
         from purchase_invoice i where i.id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.status !== 'COMPLETE') throw new BadRequestException('Only a received invoice can be put on hold.');
    if (+inv.balance <= 0.005) throw new BadRequestException('This invoice is already paid.');
    await this.manager.query(
      `update purchase_invoice set payment_status = 'On Hold', hold_reason = $2, hold_on = now(), hold_by = $3, updated_on = now(), updated_by = $3 where id = $1`,
      [invoiceId, why.slice(0, 200), userid]);
    await this.audit.record({ userId: userid, action: 'invoice.held', entityType: 'purchases', entityId: invoiceId,
      summary: `invoice ${inv.invoice_no} put on hold: ${why}`, details: { reason: why } });
    return { id: invoiceId, on_hold: true };
  }

  async release(invoiceId: number, userid: number) {
    const [inv] = await this.manager.query(`select id, invoice_no, payment_status, hold_reason from purchase_invoice where id = $1`, [invoiceId]);
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.payment_status === 'On Hold') {
      await this.manager.query(
        `update purchase_invoice set payment_status = 'Unpaid', hold_reason = null, hold_on = null, hold_by = null, updated_on = now(), updated_by = $2 where id = $1`,
        [invoiceId, userid]);
      await this.audit.record({ userId: userid, action: 'invoice.released', entityType: 'purchases', entityId: invoiceId,
        summary: `invoice ${inv.invoice_no} released from hold`, details: { was: inv.hold_reason } });
    }
    return { id: invoiceId, on_hold: false };
  }
}
