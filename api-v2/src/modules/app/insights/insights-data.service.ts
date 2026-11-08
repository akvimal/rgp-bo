import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { WeeklyFacts, expiryAction, unsoldBeforeExpiry } from './insights-rules';

/** which stores a login may see: null is all of them, a list is a store head's own (an empty list sees nothing) */
export type StoreScope = number[] | null;

export interface Column { key: string; label: string; type: 'text' | 'money' | 'number' | 'percent' | 'date' }
export interface ReportResult { columns: Column[]; rows: Record<string, any>[]; note?: string }
export interface ReportArgs { from: string; to: string; limit: number; days: number; stores: StoreScope }

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

// the cost of one unit of a purchased batch: the invoice rate after the vendor discount and the free quantity, per unit of the pack (the way the dashboard counts margin)
const UNIT_COST = `(pii.ptr_value * (1 - coalesce(pii.disc_pcnt, 0) / 100.0) * pii.qty / nullif(pii.qty + coalesce(pii.free_qty, 0), 0) / nullif(p.pack, 0))`;
const SALE_OK = `s.status = 'COMPLETE' and s.active and not s.archive`;

/** The facts the insight features are built from. Read only; every figure is a total or a list, and everything is scoped to the stores the login may see. */
@Injectable()
export class InsightsData {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async today(): Promise<string> {
    const [r] = await this.manager.query(`select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d`);
    return r.d;
  }

  /** the role of a login, and the stores it may see; throws unless it is an owner or a store head */
  async scope(user: any): Promise<{ role: string; owner: boolean; stores: StoreScope }> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const role = r?.name || '';
    if (!isManagerRole(role)) throw new ForbiddenException('Only the Business Head and Store Heads can use this.');
    if (isOwnerRole(role)) return { role, owner: true, stores: null };
    const mine = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { role, owner: false, stores: mine.map((m: any) => m.store_id) };
  }

  // ------------------------------------------------------------------------------------------------ stock that will not sell before it expires
  async expiryRisk(stores: StoreScope, horizonDays = 180, limit = 200): Promise<{ rows: any[]; totalValue: number; batches: number }> {
    const rows = await this.manager.query(
      `with rate as (
         select si.product_id, sum(si.qty)::float8 / 90 as per_day from sale_item si join sale s on s.id = si.sale_id
          where ${SALE_OK} and si.active and not si.archive and s.bill_date >= current_date - 90 and ($1::int[] is null or s.store_id = any($1::int[])) group by 1)
       select v.id::int as product_id, v.title, v.batch, to_char(public.expiry_end(v.exp_date), 'YYYY-MM-DD') as expires, (public.expiry_end(v.exp_date) - current_date)::int as days_left,
              v.balance::float8 as qty, coalesce(r.per_day, 0)::float8 as per_day, coalesce(${UNIT_COST}, 0)::float8 as unit_cost
         from product_items_view v join purchase_invoice_item pii on pii.id = v.item_id join purchase_invoice pi on pi.id = pii.invoice_id join product p on p.id = v.id
              left join rate r on r.product_id = v.id
        where v.balance > 0 and v.exp_date is not null and public.expiry_end(v.exp_date) >= current_date and public.expiry_end(v.exp_date) <= current_date + $2::int
          and pi.active and not pi.archive and ($1::int[] is null or pi.store_id = any($1::int[]))`, [stores, horizonDays]);
    const out = rows
      .map((r: any) => {
        const unsold = unsoldBeforeExpiry({ qty: r.qty, daysLeft: r.days_left, perDay: r.per_day });
        const action = expiryAction({ qty: r.qty, daysLeft: r.days_left, perDay: r.per_day, unsold });
        return { product_id: r.product_id, product: r.title, batch: r.batch, expires: r.expires, days_left: r.days_left, qty: r.qty, per_day: round2(r.per_day), will_sell: Math.min(r.qty, Math.floor(r.per_day * r.days_left)), unsold, value: round2(unsold * r.unit_cost), action };
      })
      .filter((r: any) => r.unsold > 0)
      .sort((a: any, b: any) => b.value - a.value || a.days_left - b.days_left);
    return { rows: out.slice(0, limit), totalValue: round2(out.reduce((n: number, r: any) => n + r.value, 0)), batches: out.length };
  }

  // ------------------------------------------------------------------------------------------------ the report catalogue (what the question box can answer)
  async run(report: string, a: ReportArgs): Promise<ReportResult | null> {
    const fn = (this.reports as any)[report];
    return fn ? fn.call(this, a) : null;
  }

  private readonly reports = {
    sales_summary: async (a: ReportArgs): Promise<ReportResult> => {
      const [r] = await this.manager.query(
        `select count(*)::int as bills, coalesce(sum(s.total), 0)::float8 as sales, coalesce(sum(s.disc_amount), 0)::float8 as discount, coalesce(sum(s.cash_amount), 0)::float8 as cash,
                coalesce(sum(s.digi_amount), 0)::float8 as digital, coalesce(sum(s.credit_amount), 0)::float8 as credit
           from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))`, [a.stores, a.from, a.to]);
      return { columns: [col('bills', 'Bills', 'number'), col('sales', 'Sales', 'money'), col('average', 'Average bill', 'money'), col('cash', 'Cash', 'money'), col('digital', 'UPI / card', 'money'), col('credit', 'On credit', 'money'), col('discount', 'Discount given', 'money')],
               rows: [{ ...r, average: r.bills ? round2(r.sales / r.bills) : 0 }] };
    },
    sales_by_day: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('day', 'Day', 'date'), col('bills', 'Bills', 'number'), col('sales', 'Sales', 'money')],
      rows: await this.manager.query(
        `select to_char(s.bill_date::date, 'YYYY-MM-DD') as day, count(*)::int as bills, coalesce(sum(s.total), 0)::float8 as sales from sale s
          where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[])) group by 1 order by 1`, [a.stores, a.from, a.to]) }),
    sales_by_staff: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('name', 'Staff', 'text'), col('bills', 'Bills', 'number'), col('sales', 'Sales', 'money'), col('average', 'Average bill', 'money')],
      rows: (await this.manager.query(
        `select coalesce(nullif(btrim(u.full_name), ''), 'Unknown') as name, count(*)::int as bills, coalesce(sum(s.total), 0)::float8 as sales
           from sale s left join app_user u on u.id = coalesce(s.acting_user_id, s.created_by)
          where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[])) group by 1 order by sales desc limit $4`, [a.stores, a.from, a.to, a.limit]))
        .map((r: any) => ({ ...r, average: r.bills ? round2(r.sales / r.bills) : 0 })) }),
    sales_by_store: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('store', 'Store', 'text'), col('bills', 'Bills', 'number'), col('sales', 'Sales', 'money')],
      rows: await this.manager.query(
        `select st.location as store, count(*)::int as bills, coalesce(sum(s.total), 0)::float8 as sales from sale s join stores st on st.id = s.store_id
          where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[])) group by 1 order by sales desc`, [a.stores, a.from, a.to]) }),
    top_products: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('product', 'Product', 'text'), col('qty', 'Units sold', 'number'), col('sales', 'Sales', 'money')],
      rows: await this.manager.query(
        `select p.title as product, sum(si.qty)::float8 as qty, coalesce(sum(si.total), 0)::float8 as sales from sale_item si join sale s on s.id = si.sale_id join product p on p.id = si.product_id
          where ${SALE_OK} and si.active and not si.archive and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))
          group by p.id, p.title order by sales desc limit $4`, [a.stores, a.from, a.to, a.limit]) }),
    margin_by_product: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('product', 'Product', 'text'), col('sales', 'Sales (before GST)', 'money'), col('cost', 'Cost', 'money'), col('profit', 'Profit', 'money'), col('margin', 'Margin', 'percent')],
      note: 'Only lines whose cost is known are counted.',
      rows: (await this.manager.query(
        `select p.title as product, sum(si.total / (1 + coalesce(si.tax_pcnt, 0) / 100.0))::float8 as sales, sum(${UNIT_COST} * si.qty)::float8 as cost
           from sale_item si join sale s on s.id = si.sale_id join purchase_invoice_item pii on pii.id = si.purchase_item_id join product p on p.id = si.product_id
          where ${SALE_OK} and si.active and not si.archive and p.pack > 0 and pii.ptr_value > 0 and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))
          group by p.id, p.title having sum(si.total) > 0 order by sum(si.total / (1 + coalesce(si.tax_pcnt, 0) / 100.0)) - sum(${UNIT_COST} * si.qty) desc limit $4`, [a.stores, a.from, a.to, a.limit]))
        .map((r: any) => ({ product: r.product, sales: round2(r.sales), cost: round2(r.cost), profit: round2(r.sales - r.cost), margin: r.sales ? round2(((r.sales - r.cost) / r.sales) * 100) : 0 })) }),
    low_margin_products: async (a: ReportArgs): Promise<ReportResult> => {
      const r = await this.reports.margin_by_product({ ...a, limit: 500 });
      return { ...r, rows: r.rows.filter((x) => x.sales > 0).sort((p, q) => p.margin - q.margin).slice(0, a.limit), note: 'Products with the thinnest margin first. Only lines whose cost is known are counted.' };
    },
    payment_modes: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('mode', 'Paid by', 'text'), col('bills', 'Bills', 'number'), col('amount', 'Amount', 'money')],
      rows: await this.manager.query(
        `select mode, sum(bills)::int as bills, sum(amount)::float8 as amount from (
           select 'Cash' as mode, count(*) filter (where s.cash_amount > 0) as bills, coalesce(sum(s.cash_amount), 0) as amount from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))
           union all
           select 'UPI / card: ' || coalesce(nullif(btrim(s.digi_provider), ''), 'other'), count(*), coalesce(sum(s.digi_amount), 0) from sale s where ${SALE_OK} and s.digi_amount > 0 and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[])) group by coalesce(nullif(btrim(s.digi_provider), ''), 'other')
           union all
           select 'On credit', count(*) filter (where s.credit_amount > 0), coalesce(sum(s.credit_amount), 0) from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))) x
         where amount > 0 group by mode order by amount desc`, [a.stores, a.from, a.to]) }),
    expenses: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('category', 'Expense', 'text'), col('count', 'Entries', 'number'), col('amount', 'Amount', 'money')],
      rows: await this.manager.query(
        `select coalesce(nullif(btrim(expense_category), ''), 'Other') as category, count(*)::int as count, sum(withdraw)::float8 as amount from store_cash_accounts
          where category = 'EXPENSE' and trans_date >= $2::date and trans_date < $3::date and ($1::int[] is null or store_id = any($1::int[])) group by 1 order by amount desc`, [a.stores, a.from, a.to]) }),
    purchases_by_vendor: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('vendor', 'Vendor', 'text'), col('invoices', 'Invoices', 'number'), col('amount', 'Bought', 'money')],
      rows: await this.manager.query(
        `select v.business_name as vendor, count(*)::int as invoices, coalesce(sum(pi.total), 0)::float8 as amount from purchase_invoice pi join vendor v on v.id = pi.vendor_id
          where pi.active and not pi.archive and pi.invoice_date >= $2::date and pi.invoice_date < $3::date and ($1::int[] is null or pi.store_id = any($1::int[])) group by 1 order by amount desc limit $4`, [a.stores, a.from, a.to, a.limit]) }),
    customer_dues: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('customer', 'Customer', 'text'), col('balance', 'Owes', 'money'), col('since', 'Last entry', 'date')],
      note: 'Customers who owe money on credit, the most first.',
      rows: await this.manager.query(
        `select c.name as customer, sum(e.amount)::float8 as balance, to_char(max(e.entry_date), 'YYYY-MM-DD') as since from customer_due_entry e join customer c on c.id = e.customer_id
          group by c.id, c.name having sum(e.amount) > 0.5 order by balance desc limit $1`, [a.limit]) }),
    expiring_stock: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('product', 'Product', 'text'), col('batch', 'Batch', 'text'), col('expires', 'Expires', 'date'), col('qty', 'Units left', 'number'), col('value', 'Value at cost', 'money')],
      note: `Stock that expires within ${a.days} days.`,
      rows: await this.manager.query(
        `select v.title as product, v.batch, to_char(public.expiry_end(v.exp_date), 'YYYY-MM-DD') as expires, v.balance::float8 as qty, round((v.balance * coalesce(${UNIT_COST}, 0))::numeric, 2)::float8 as value
           from product_items_view v join purchase_invoice_item pii on pii.id = v.item_id join purchase_invoice pi on pi.id = pii.invoice_id join product p on p.id = v.id
          where v.balance > 0 and v.exp_date is not null and public.expiry_end(v.exp_date) >= current_date and public.expiry_end(v.exp_date) <= current_date + $2::int
            and pi.active and not pi.archive and ($1::int[] is null or pi.store_id = any($1::int[])) order by public.expiry_end(v.exp_date), value desc limit $3`, [a.stores, a.days, a.limit]) }),
    expiry_risk: async (a: ReportArgs): Promise<ReportResult> => {
      const r = await this.expiryRisk(a.stores, Math.max(a.days, 30), a.limit);
      return { columns: [col('product', 'Product', 'text'), col('batch', 'Batch', 'text'), col('expires', 'Expires', 'date'), col('qty', 'Units left', 'number'), col('unsold', 'Will not sell', 'number'), col('value', 'Value at cost', 'money'), col('action', 'Suggestion', 'text')],
               rows: r.rows, note: 'Batches that will not all sell before they expire at the current selling rate (the last 90 days).' };
    },
    dead_stock: async (a: ReportArgs): Promise<ReportResult> => ({
      columns: [col('product', 'Product', 'text'), col('qty', 'Units on hand', 'number'), col('last_sale', 'Last sold', 'date'), col('value', 'Value at cost', 'money')],
      note: `Stock that has not sold in ${a.days} days.`,
      rows: await this.manager.query(
        `select v.title as product, sum(v.balance)::float8 as qty, to_char(max(v.last_sale_date), 'YYYY-MM-DD') as last_sale, round(sum(v.balance * coalesce(${UNIT_COST}, 0))::numeric, 2)::float8 as value
           from product_items_view v join purchase_invoice_item pii on pii.id = v.item_id join purchase_invoice pi on pi.id = pii.invoice_id join product p on p.id = v.id
          where v.balance > 0 and (v.exp_date is null or public.expiry_end(v.exp_date) >= current_date) and pi.active and not pi.archive and ($1::int[] is null or pi.store_id = any($1::int[]))
          group by v.id, v.title having coalesce(max(v.last_sale_date), '1970-01-01'::timestamp) < now() - make_interval(days => $2::int) order by value desc nulls last limit $3`, [a.stores, a.days, a.limit]) }),
  };

  // ------------------------------------------------------------------------------------------------ the week
  async weekly(w: { start: string; end: string; prevStart: string; prevEnd: string }, stores: StoreScope): Promise<WeeklyFacts> {
    const range = (from: string, to: string) => ({ from, to: this.next(to) });
    const cur = range(w.start, w.end), prev = range(w.prevStart, w.prevEnd);
    const figures = async (r: { from: string; to: string }) => {
      const [x] = await this.manager.query(
        `select count(*)::int as bills, coalesce(sum(s.total), 0)::float8 as sales, coalesce(sum(s.cash_amount), 0)::float8 as cash, coalesce(sum(s.digi_amount), 0)::float8 as digital, coalesce(sum(s.credit_amount), 0)::float8 as credit
           from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores, r.from, r.to]);
      return x;
    };
    const margin = async (r: { from: string; to: string }) => {
      const [m] = await this.manager.query(
        `select coalesce(sum(net), 0)::float8 as net_all, coalesce(sum(net) filter (where covered), 0)::float8 as net_cov, coalesce(sum(cogs) filter (where covered), 0)::float8 as cogs_cov
           from (select si.total / (1 + coalesce(si.tax_pcnt, 0) / 100.0) as net, ${UNIT_COST} * si.qty as cogs, (pii.id is not null and p.pack > 0 and pii.ptr_value > 0) as covered
                   from sale_item si join sale s on s.id = si.sale_id left join purchase_invoice_item pii on pii.id = si.purchase_item_id left join product p on p.id = si.product_id
                  where ${SALE_OK} and si.active and not si.archive and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))) x`, [stores, r.from, r.to]);
      return { pct: m.net_cov > 0 ? Math.round(((m.net_cov - m.cogs_cov) / m.net_cov) * 1000) / 10 : null, coverage: m.net_all > 0 ? Math.round((m.net_cov / m.net_all) * 100) : 0 };
    };
    const now = await figures(cur), before = await figures(prev), m0 = await margin(cur), m1 = await margin(prev);
    const top = await this.reports.top_products({ from: cur.from, to: cur.to, limit: 5, days: 0, stores });
    const staff = await this.reports.sales_by_staff({ from: cur.from, to: cur.to, limit: 5, days: 0, stores });
    const [exp] = await this.manager.query(`select coalesce(sum(withdraw) filter (where trans_date >= $2::date and trans_date < $3::date), 0)::float8 as t, coalesce(sum(withdraw) filter (where trans_date >= $4::date and trans_date < $5::date), 0)::float8 as p
        from store_cash_accounts where category = 'EXPENSE' and ($1::int[] is null or store_id = any($1::int[]))`, [stores, cur.from, cur.to, prev.from, prev.to]);
    const [ret] = await this.manager.query(
      `select count(*)::int as n, 0::float8 as v from sale_return_item ri join sale_item si on si.id = ri.sale_item_id join sale s on s.id = si.sale_id
        where ri.active and not ri.archive and ri.created_on >= $2::date and ri.created_on < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores, cur.from, cur.to]);
    const [dues] = await this.manager.query(`select coalesce(sum(b), 0)::float8 as total, count(*)::int as n from (select sum(amount) as b from customer_due_entry group by customer_id having sum(amount) > 0.5) x`);
    const risk = await this.expiryRisk(stores, 90, 1000);
    const [expired] = await this.manager.query(
      `select coalesce(sum(v.balance * coalesce(${UNIT_COST}, 0)), 0)::float8 as v from product_items_view v join purchase_invoice_item pii on pii.id = v.item_id join purchase_invoice pi on pi.id = pii.invoice_id join product p on p.id = v.id
        where v.balance > 0 and v.exp_date is not null and public.expiry_end(v.exp_date) < current_date and pi.active and not pi.archive and ($1::int[] is null or pi.store_id = any($1::int[]))`, [stores]);
    const [out] = await this.manager.query(
      `with sold as (select si.product_id from sale_item si join sale s on s.id = si.sale_id where ${SALE_OK} and si.active and not si.archive and s.bill_date >= current_date - 30 and ($1::int[] is null or s.store_id = any($1::int[])) group by 1),
            have as (select v.id as product_id, sum(v.balance) as bal from product_items_view v join purchase_invoice_item pii on pii.id = v.item_id join purchase_invoice pi on pi.id = pii.invoice_id
                      where (v.exp_date is null or public.expiry_end(v.exp_date) >= current_date + 30) and pi.active and not pi.archive and ($1::int[] is null or pi.store_id = any($1::int[])) group by 1)
       select count(*)::int as n from sold left join have h on h.product_id = sold.product_id where coalesce(h.bal, 0) <= 0`, [stores]);
    const [sh] = await this.manager.query(
      `select count(*)::int as closed, count(*) filter (where abs(coalesce(variance, 0)) > 1)::int as diff from store_shifts where status = 'CLOSED' and closed_on >= $2::date and closed_on < $3::date and ($1::int[] is null or store_id = any($1::int[]))`, [stores, cur.from, cur.to]);
    const [att] = await this.manager.query(
      `select count(*) filter (where 'LATE' = any(a.flags))::int as late, count(*) filter (where a.verification_status = 'PENDING')::int as pending from hr_attendance a
        where a.att_date >= $2::date and a.att_date < $3::date and ($1::int[] is null or a.store_id = any($1::int[]))`, [stores, cur.from, cur.to]);
    const [dl] = await this.manager.query(
      `select count(*)::int as total, count(*) filter (where d.status = 'Failed')::int as failed from sale s left join sale_deliveries d on d."saleId" = s.id
        where ${SALE_OK} and s.delivery_type = 'Delivery' and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores, cur.from, cur.to]);
    return {
      week: { start: w.start, end: w.end },
      sales: { value: round2(now.sales), bills: now.bills, avgBill: now.bills ? round2(now.sales / now.bills) : 0, prevValue: round2(before.sales), prevBills: before.bills },
      mix: { cash: round2(now.cash), digital: round2(now.digital), credit: round2(now.credit) },
      margin: m0.pct === null && m1.pct === null ? null : { pct: m0.pct, prevPct: m1.pct, coverage: m0.coverage },
      topProducts: top.rows.map((r: any) => ({ name: r.product, value: round2(r.sales) })),
      topStaff: staff.rows.map((r: any) => ({ name: r.name, bills: r.bills, value: round2(r.sales) })),
      expenses: { total: round2(exp.t), prevTotal: round2(exp.p) },
      returns: { count: ret.n, value: 0 },
      dues: { outstanding: round2(dues.total), customers: dues.n },
      expiry: { atRiskValue: risk.totalValue, atRiskBatches: risk.batches, expiredValue: round2(expired.v) },
      stock: { outOfStockSelling: out.n },
      shifts: { closed: sh.closed, withDifference: sh.diff },
      attendance: { late: att.late, missing: att.pending },
      deliveries: { total: dl.total, failed: dl.failed },
    };
  }

  private next(day: string): string { return new Date(new Date(day + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10); }
}

function col(key: string, label: string, type: Column['type']): Column { return { key, label, type }; }

export const REPORT_KEYS = ['sales_summary', 'sales_by_day', 'sales_by_staff', 'sales_by_store', 'top_products', 'margin_by_product', 'low_margin_products', 'payment_modes', 'expenses', 'purchases_by_vendor', 'customer_dues', 'expiring_stock', 'expiry_risk', 'dead_stock'] as const;

/** what the question box tells the model and the person about each report */
export const REPORT_INFO: Record<string, { label: string; what: string; example: string; periodic: boolean; ownerOnly?: boolean }> = {
  sales_summary: { label: 'Sales summary', what: 'Bills, sales, average bill, cash, UPI/card, credit and discount for a period.', example: 'How much did we sell last week?', periodic: true },
  sales_by_day: { label: 'Sales by day', what: 'Bills and sales for each day of a period.', example: 'Show daily sales for this month', periodic: true },
  sales_by_staff: { label: 'Sales by staff', what: 'Bills and sales for each person who served customers.', example: 'Who sold the most this month?', periodic: true },
  sales_by_store: { label: 'Sales by store', what: 'Bills and sales for each store.', example: 'Compare the stores last month', periodic: true },
  top_products: { label: 'Top products', what: 'The products that sold the most, by value.', example: 'Top 10 products last month', periodic: true },
  margin_by_product: { label: 'Profit by product', what: 'Sales, cost, profit and margin for the products that earned the most.', example: 'Which products earned the most profit this month?', periodic: true, ownerOnly: true },
  low_margin_products: { label: 'Thin-margin products', what: 'Products with the lowest margin.', example: 'Which products have the thinnest margin?', periodic: true, ownerOnly: true },
  payment_modes: { label: 'Payment modes', what: 'How customers paid: cash, UPI or card by app, credit.', example: 'How did customers pay last week?', periodic: true },
  expenses: { label: 'Expenses', what: 'Expenses paid from the drawer, by category.', example: 'What did we spend on expenses this month?', periodic: true },
  purchases_by_vendor: { label: 'Purchases by vendor', what: 'What was bought from each vendor.', example: 'Which vendors did we buy the most from this year?', periodic: true },
  customer_dues: { label: 'Customer dues', what: 'Customers who owe money on credit.', example: 'Who owes us money?', periodic: false, ownerOnly: true },
  expiring_stock: { label: 'Expiring stock', what: 'Stock that expires within a number of days.', example: 'What expires in the next 60 days?', periodic: false },
  expiry_risk: { label: 'Stock that will not sell in time', what: 'Batches that will not all sell before they expire at the current rate.', example: 'What stock will we not be able to sell before it expires?', periodic: false },
  dead_stock: { label: 'Stock not selling', what: 'Stock that has not sold in a number of days.', example: 'What has not sold in 90 days?', periodic: false },
};
