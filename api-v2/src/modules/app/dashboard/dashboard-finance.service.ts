import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { MANAGER_ROLES } from 'src/core/roles';
import { DashboardService } from './dashboard.service';
import { TtlCache, cacheKey, heavy } from 'src/core/heavy-query';
import { StoredCache, wantsRefresh } from 'src/core/stored-cache';
import { costRatios } from './cost-ratios';
import { DashboardRollupService, rollupCut } from './dashboard-rollup.service';
import { FlowRow, buildMatrix, compareRange, financialYear, monthsBetween } from './money-matrix';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISTDAY = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
/** the classes an expense category can be filed under by the owner */
export const EXPENSE_CLASSES = ['OPERATING_COST', 'PEOPLE', 'FINANCE_COST', 'CAPITAL_OWNER'];
const VIEWS: Record<string, string[] | null> = { pnl: null, products: ['INCOME', 'INCOME_REDUCTION', 'COST_OF_GOODS'] };

/**
 * The financial dashboard's matrix over the `money_flow` view (migration 201): every sale, return, purchase and approved expense as one classified stream.
 * Scoped like the rest of the dashboard. A manager sees no purchases, margin or profit (decided 2026-11-14); only the owner files a category.
 */
@Injectable()
export class DashboardFinanceService {
  /** the cash balances are worked out once a minute per person's view (live) */
  private readonly cache = new TtlCache(60_000);
  /** the other figures are kept between opens, by how fast they change (hourly, daily), and show when they were worked out */
  private readonly stored: StoredCache;

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly dash: DashboardService, private readonly audit: AuditService, private readonly rollup: DashboardRollupService) {
    this.stored = new StoredCache(manager);
  }

  /** the money figures kept between opens (a rebuilt roll-up or a filed category changes them all) */
  private forgetMoney() { return Promise.all(['matrix|', 'unclassified|', 'trend|', 'gst|'].map((k) => this.stored.clear(k))); }

  private num(v: any): number | null {
    const n = Number(v);
    return v === undefined || v === null || v === '' || !Number.isFinite(n) ? null : n;
  }

  private async guard(user: any, storeid: any) {
    const requested = this.num(storeid);
    const sc = await this.dash.scope(user, requested);
    if (!MANAGER_ROLES.includes(String(sc.role))) throw new ForbiddenException('These figures are for the people who run the business or a store.');
    // expenses kept at business level have no store: the owner sees them when no single store is asked for
    return { ...sc, withBusinessLevel: sc.owner && requested === null };
  }

  private range(from?: string, to?: string) {
    const fy = financialYear(ISTDAY());
    const f = from && MONTH.test(from) ? from : fy.from;
    const t = to && MONTH.test(to) ? to : fy.to;
    if (f > t) throw new BadRequestException('The first month is after the last month.');
    const months = monthsBetween(f, t);
    if (months.length > 36) throw new BadRequestException('Choose 36 months or fewer.');
    return { from: f, to: t, months };
  }

  private async flow(sc: { stores: number[] | null; withBusinessLevel: boolean }, from: string, to: string, classes: string[] | null): Promise<FlowRow[]> {
    const start = `${from}-01`;
    const end = new Date(Date.UTC(+to.slice(0, 4), +to.slice(5, 7), 1)).toISOString().slice(0, 10);      // the first day after the last month
    // older whole months come from the nightly roll-up when it covers them; the rest, and everything when it has not been built, is read live
    const cut = rollupCut(await this.rollup.through(), ISTDAY(), start);
    const rolledUntil = cut && cut < end ? cut : cut ? end : start;
    const scope = `($1::int[] is null or store_id = any($1::int[]) or (store_id is null and $2::boolean)) and ($3::text[] is null or flow_class = any($3::text[]))`;
    const rows = await heavy(this.manager, 25_000, (tx) => tx.query(
      `select to_char(flow_date, 'YYYY-MM') as month, flow_class as cls, grp, category, sum(amount)::float8 as amount, sum(n)::int as n, bool_or(unclassified) as unclassified
         from (
           select flow_date, store_id, flow_class, grp, category, amount, 1 as n, unclassified from money_flow where flow_date >= $5::date and flow_date < $6::date and ${scope}
           union all
           select flow_date, store_id, flow_class, grp, category, amount, entries as n, unclassified from metric_daily where flow_date >= $4::date and flow_date < $5::date and ${scope}
         ) u group by 1, 2, 3, 4`,
      [sc.stores, sc.withBusinessLevel, classes, start, rolledUntil, end]));
    return rows.map((r: any) => ({ ...r, amount: Number(r.amount) }));
  }

  /** The category x month matrix: ?from=YYYY-MM&to=YYYY-MM (this financial year by default), ?view=pnl|products, ?compare=prev|yoy|none, ?storeid */
  async matrix(user: any, q: { storeid?: any; from?: string; to?: string; view?: string; compare?: string; refresh?: any }) {
    const sc = await this.guard(user, q.storeid);
    const { from, to, months } = this.range(q.from, q.to);
    const view = q.view && q.view in VIEWS ? q.view : 'pnl';
    const classes = VIEWS[view];
    const cmp = compareRange(from, to, String(q.compare || 'none'));
    return this.stored.get(cacheKey('matrix', sc.businessId, sc.owner, sc.stores, sc.withBusinessLevel, from, to, view, cmp ? q.compare : 'none'), 'daily', async () => {
      const [rows, compareRows] = await Promise.all([this.flow(sc, from, to, classes), cmp ? this.flow(sc, cmp.from, cmp.to, classes) : Promise.resolve(undefined)]);
      const result = buildMatrix(rows, months, { hideCost: !sc.owner, compareRows, compareMonths: cmp ? monthsBetween(cmp.from, cmp.to) : undefined });
      return { ...result, from, to, view, compare: cmp ? { ...cmp, kind: q.compare } : null, owner: sc.owner, basis: 'ACCRUAL', asOf: new Date().toISOString() };
    }, wantsRefresh(q));
  }

  /** The entries behind one cell or row: ?month=YYYY-MM (optional), cls, grp, category. At most 200, newest first. */
  async drill(user: any, q: { storeid?: any; month?: string; cls?: string; grp?: string; category?: string; from?: string; to?: string }) {
    const sc = await this.guard(user, q.storeid);
    if (!sc.owner && q.cls === 'COST_OF_GOODS') throw new ForbiddenException('Purchases are shown to the owner only.');
    const { from, to } = this.range(q.month && MONTH.test(q.month) ? q.month : q.from, q.month && MONTH.test(q.month) ? q.month : q.to);
    const rows = await this.manager.query(
      `select m.flow_date::text as date, m.store_id, trim(st.location) as store, m.amount::float8 as amount, m.gst::float8 as gst, m.source, m.source_id,
              case m.source
                when 'SALE' then 'Bill ' || coalesce(s.bill_no::text, s.id::text)
                when 'RETURN' then 'Return on bill ' || coalesce(rs.bill_no::text, rs.id::text)
                when 'PURCHASE' then 'Invoice ' || pi.invoice_no || ' (' || v.business_name || ')'
                when 'EXPENSE' then coalesce(nullif(e.payee, ''), nullif(e.description, ''), 'Expense')
              end as what
         from money_flow m
         left join stores st on st.id = m.store_id
         left join sale_item si on m.source = 'SALE' and si.id = m.source_id
         left join sale s on s.id = si.sale_id
         left join sale_return_item ri on m.source = 'RETURN' and ri.id = m.source_id
         left join sale_item rsi on rsi.id = ri.sale_item_id
         left join sale rs on rs.id = rsi.sale_id
         left join purchase_invoice_item pii on m.source = 'PURCHASE' and pii.id = m.source_id
         left join purchase_invoice pi on pi.id = pii.invoice_id
         left join vendor v on v.id = pi.vendor_id
         left join expense e on m.source = 'EXPENSE' and e.id = m.source_id
        where m.flow_date >= ($2 || '-01')::date and m.flow_date < (($3 || '-01')::date + interval '1 month')
          and ($1::int[] is null or m.store_id = any($1::int[]) or (m.store_id is null and $4::boolean))
          and m.flow_class = $5 and m.grp = $6 and m.category = $7
        order by m.flow_date desc, m.source_id desc limit 200`,
      [sc.stores, from, to, sc.withBusinessLevel, String(q.cls || ''), String(q.grp || ''), String(q.category || '')]);
    return { rows, limited: rows.length === 200 };
  }

  /** What has no category: expense categories with no mapping, and products with no category (their sales count under Unclassified). */
  async unclassified(user: any, q: { storeid?: any; refresh?: any } = {}) {
    const sc = await this.guard(user, q.storeid);
    return this.stored.get(cacheKey('unclassified', sc.businessId, sc.owner, sc.stores, sc.withBusinessLevel), 'hourly', async () => {
      // straight from the expense and sale tables: the money view would read every bill line of the year just to count what has no category
      const expenses = await this.manager.query(
        `select c.name as key, count(*)::int as entries, sum(e.amount - e.gst_amount)::float8 as amount
           from expense e join expense_category c on c.id = e.category_id
           left join flow_category m on m.source = 'EXPENSE' and m.source_key = c.name
          where e.status = 'APPROVED' and m.id is null and e.expense_date >= current_date - interval '12 months'
            and ($1::int[] is null or e.store_id = any($1::int[]) or (e.store_id is null and $2::boolean))
          group by 1 order by 3 desc`, [sc.stores, sc.withBusinessLevel]);
      const [products] = await this.manager.query(
        `select count(distinct si.product_id)::int as products,
                coalesce(sum(si.total / (1 + coalesce(si.tax_pcnt, p.tax_pcnt, 0) / 100.0)), 0)::float8 as amount
           from sale s join sale_item si on si.sale_id = s.id and si.active and not si.archive and coalesce(si.sale_mode, 'SALE') = 'SALE'
           join product p on p.id = si.product_id
          where s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= current_date - interval '12 months'
            and nullif(btrim(p.category), '') is null and ($1::int[] is null or s.store_id = any($1::int[]))`, [sc.stores]);
      const mapped = await this.manager.query(
        `select c.name as key, coalesce(f.flow_class, 'OPERATING_COST') as flow_class, coalesce(f.grp, c.cost_group) as grp, (f.id is not null) as filed
           from expense_category c left join flow_category f on f.source = 'EXPENSE' and f.source_key = c.name where c.active order by c.name`);
      return { expenses, products: { count: Number(products?.products) || 0, amount: Number(products?.amount) || 0 }, categories: mapped, classes: EXPENSE_CLASSES, canFile: sc.owner };
    }, wantsRefresh(q));
  }

  /**
   * Running cost against sales for the last 12 complete months and this one, by cost group, with the usual band. Managers see it too: it holds no
   * purchases and no profit.
   */
  async trend(user: any, q: { storeid?: any; refresh?: any }) {
    const sc = await this.guard(user, q.storeid);
    const today = ISTDAY();
    const thisMonth = today.slice(0, 7);
    const shift = (ym: string, by: number) => { const t = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + by; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
    const from = shift(thisMonth, -12);
    const months = monthsBetween(from, thisMonth);
    return this.stored.get(cacheKey('trend', sc.businessId, sc.stores, sc.withBusinessLevel, thisMonth), 'daily', async () => {
    const rows = await this.flow(sc, from, thisMonth, ['INCOME', 'INCOME_REDUCTION', 'OPERATING_COST', 'PEOPLE', 'FINANCE_COST']);
    const sales = months.map((m) => ({
      month: m,
      sales: rows.filter((r) => r.month === m).reduce((t, r) => t + (r.cls === 'INCOME' ? r.amount : r.cls === 'INCOME_REDUCTION' ? -r.amount : 0), 0),
    }));
    const costs = rows.filter((r) => ['OPERATING_COST', 'PEOPLE', 'FINANCE_COST'].includes(r.cls)).map((r) => ({ month: r.month, grp: r.grp, amount: r.amount }));
    return { ...costRatios(costs, sales, months, { latest: shift(thisMonth, -1) }), thisMonth };
    }, wantsRefresh(q));
  }

  /** What is in the bank now: the last balance of each active bank account, with its date. Accounts of the business show when no single store is chosen. */
  async cash(user: any, q: { storeid?: any }) {
    const sc = await this.guard(user, q.storeid);
    return this.cache.get(cacheKey('cash', sc.businessId, sc.stores, sc.withBusinessLevel), async () => {
    const accounts = await this.manager.query(
      `select a.id, a.name, a.bank_name, a.store_id, st.location as store,
              (select t.balance from bank_txn t where t.account_id = a.id and t.balance is not null order by t.txn_date desc, t.id desc limit 1)::float8 as balance,
              (select max(t.txn_date)::text from bank_txn t where t.account_id = a.id) as as_of
         from bank_account a left join stores st on st.id = a.store_id
        where a.active and ($1::int[] is null or a.store_id = any($1::int[]) or (a.store_id is null and $2::boolean))
          and ($3::int is null or a.business_id = $3)
        order by a.name`, [sc.stores, sc.withBusinessLevel, sc.businessId]);
    const known = accounts.filter((a: any) => a.balance !== null);
    return { accounts, bankTotal: Math.round(known.reduce((t: number, a: any) => t + Number(a.balance), 0)), unknown: accounts.length - known.length };
    });
  }

  /** Rebuilds the daily roll-up now (owner only): the last 100 days, or all history with `full`. It also runs every night. */
  async rebuildRollup(user: any, full: boolean) {
    const sc = await this.guard(user, null);
    if (!sc.owner) throw new ForbiddenException('Only the owner rebuilds the roll-up.');
    const r = await this.rollup.refresh(full);
    this.cache.clear();
    await this.forgetMoney();
    await this.audit.record({ userId: user.id, action: 'finance.rollup_rebuilt', entityType: 'metric_daily', entityId: 0, summary: `Roll-up rebuilt through ${r.through} (${r.full ? 'all history' : 'recent days'})`, details: r });
    return r;
  }

  /** The owner files an expense category under a class and group. Saved once, used by every figure, and audited. */
  async file(user: any, body: { source?: string; key?: string; flow_class?: string; grp?: string }) {
    const sc = await this.guard(user, null);
    if (!sc.owner) throw new ForbiddenException('Only the owner files a category.');
    const key = String(body?.key || '').trim();
    const cls = String(body?.flow_class || '');
    const grp = String(body?.grp || '').trim().slice(0, 40);
    if (String(body?.source || 'EXPENSE') !== 'EXPENSE') throw new BadRequestException('Only expense categories are filed here. Set a product category on the product.');
    if (!key) throw new BadRequestException('Say which category.');
    if (!EXPENSE_CLASSES.includes(cls)) throw new BadRequestException(`The class is one of: ${EXPENSE_CLASSES.join(', ')}.`);
    if (!grp) throw new BadRequestException('Give the group it belongs to.');
    const [exists] = await this.manager.query(`select 1 from expense_category where name = $1`, [key]);
    if (!exists) throw new BadRequestException('There is no expense category with that name.');
    await this.manager.query(
      `insert into flow_category (source, source_key, flow_class, grp, updated_by, updated_on) values ('EXPENSE', $1, $2, $3, $4, now())
       on conflict (source, source_key) do update set flow_class = excluded.flow_class, grp = excluded.grp, updated_by = excluded.updated_by, updated_on = now()`,
      [key, cls, grp, user.id]);
    this.cache.clear();
    await this.forgetMoney();
    await this.audit.record({ userId: user.id, action: 'finance.category_filed', entityType: 'flow_category', entityId: 0, summary: `${key} filed under ${cls} / ${grp}`, details: { key, flow_class: cls, grp } });
    return { saved: true };
  }
}
