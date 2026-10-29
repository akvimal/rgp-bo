import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { ConfigService } from 'src/core/config/config.service';
import { MANAGER_ROLES } from 'src/core/roles';
import { DashboardService } from './dashboard.service';
import { compareOf, deltaOf, marginOf, periodsFor } from './dashboard-tiles';
import { CHECKS, cashScore, combine, complianceScore, customersScore, expectedSales, expiryScore, purchasingScore, salesScoreVs, serviceScore, stockOutScore, stockScore, suggestedTarget } from './dashboard-health';

/** the placeholder customer used at the counter when no mobile number is given */
const NO_MOBILE = '0000000000';
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The owner's and manager's charts, targets and store health (DASHBOARD_AND_MENU_DESIGN 4 to 6, implementation plan stage 6). Every query is scoped by the
 * same rule as the rest of the dashboard (`DashboardService.scope`): the stores of the person, a requested store refused when it is not theirs.
 * Margin and cost are not here yet: they need the cost coverage guard first. Customer names never leave this service.
 */
@Injectable()
export class DashboardMetricsService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly dash: DashboardService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private num(v: any): number | null {
    const n = Number(v);
    return v === undefined || v === null || v === '' || !Number.isFinite(n) ? null : n;
  }

  /** These figures are for the people who run the business or a store; the counter and staff views have their own (`/dashboard/mine`). */
  private async managed(user: any, storeid: any) {
    const sc = await this.dash.scope(user, this.num(storeid));
    if (!MANAGER_ROLES.includes(String(sc.role))) throw new ForbiddenException('These figures are for the people who run the business or a store.');
    return sc;
  }

  // ------------------------------------------------------------------ targets

  /** The sales targets of a month ("YYYY-MM", this month by default): the business one and each store's. */
  async targets(user: any, month?: string) {
    const sc = await this.managed(user, null);
    if (!sc.businessId) return { month: null, business: null, stores: [] };
    const m = month && MONTH.test(month) ? month : new Date().toISOString().slice(0, 7);
    const rows = await this.manager.query(
      `select store_id, value::float8 as value from metric_target where business_id = $1 and metric = 'sales' and month = ($2 || '-01')::date`, [sc.businessId, m]);
    const stores = await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive and ($2::int[] is null or id = any($2::int[])) order by location`, [sc.businessId, sc.stores]);
    return {
      month: m,
      business: rows.find((r: any) => r.store_id === null)?.value ?? null,
      stores: stores.map((s: any) => ({ id: +s.id, location: s.location, value: rows.find((r: any) => r.store_id === +s.id)?.value ?? null })),
    };
  }

  /** Sets (or clears, with a null value) one sales target. Business Head and Owner-operator only; audited. */
  async setTarget(user: any, body: { month: string; storeid?: number | null; value: number | null }) {
    const sc = await this.dash.scope(user, null);
    if (!sc.owner || !sc.businessId) throw new ForbiddenException('Only the Business Head sets targets.');
    if (!MONTH.test(String(body?.month))) throw new BadRequestException('Give the month as YYYY-MM.');
    const storeId = body.storeid ? Number(body.storeid) : null;
    if (storeId !== null && !(sc.stores || []).includes(storeId)) throw new ForbiddenException('That store is not one of yours.');
    const value = body.value === null ? null : Number(body.value);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1e9)) throw new BadRequestException('A target is a number from 0 up.');
    const [before] = await this.manager.query(`select value::float8 as value from metric_target where business_id = $1 and metric = 'sales' and coalesce(store_id, 0) = $2 and month = ($3 || '-01')::date`, [sc.businessId, storeId || 0, body.month]);
    if (value === null) {
      await this.manager.query(`delete from metric_target where business_id = $1 and metric = 'sales' and coalesce(store_id, 0) = $2 and month = ($3 || '-01')::date`, [sc.businessId, storeId || 0, body.month]);
    } else {
      await this.manager.query(
        `insert into metric_target (business_id, store_id, metric, month, value, set_by) values ($1, $2, 'sales', ($3 || '-01')::date, $4, $5)
         on conflict (business_id, coalesce(store_id, 0), metric, month) do update set value = excluded.value, set_by = excluded.set_by, set_on = now()`,
        [sc.businessId, storeId, body.month, value, user.id]);
    }
    await this.audit.record({ userId: user.id, action: 'dashboard.target', entityType: 'metric_target', entityId: storeId || 0, summary: `Sales target for ${body.month}`, details: { storeId, month: body.month, from: before?.value ?? null, to: value } });
    return { ok: true };
  }

  /** The target in force for the stores asked about: one store's own, else the business one, else the stores' added up. */
  private async targetFor(businessId: number, stores: number[] | null, requested: number | null, month: string): Promise<number | null> {
    const rows = await this.manager.query(`select store_id, value::float8 as value from metric_target where business_id = $1 and metric = 'sales' and month = ($2 || '-01')::date`, [businessId, month]);
    if (requested) return rows.find((r: any) => r.store_id === requested)?.value ?? null;
    const whole = rows.find((r: any) => r.store_id === null);
    if (whole) return whole.value;
    const mine = rows.filter((r: any) => r.store_id !== null && (stores === null || stores.includes(r.store_id)));
    return mine.length ? mine.reduce((a: number, r: any) => a + r.value, 0) : null;
  }

  /** sales (completed bills) of a span of days, for the stores asked about */
  private async sumSales(stores: number[] | null, from: string, to: string): Promise<number> {
    const [r] = await this.manager.query(
      `select coalesce(sum(total), 0)::float8 as v from sale where status = 'COMPLETE' and active and not archive and bill_date >= $2::date and bill_date < $3::date and ($1::int[] is null or store_id = any($1::int[]))`, [stores, from, to]);
    return r.v;
  }

  /** the average sales of a whole month over the last `months` complete months that had any sales, or null when there is none yet */
  private async recentMonthlyAverage(stores: number[] | null, firstOfMonth: string, months: number): Promise<number | null> {
    const [r] = await this.manager.query(
      `select coalesce(sum(total), 0)::float8 as total, count(distinct date_trunc('month', bill_date))::int as months from sale
        where status = 'COMPLETE' and active and not archive and bill_date >= ($2::date - ($3 || ' months')::interval) and bill_date < $2::date and ($1::int[] is null or store_id = any($1::int[]))`,
      [stores, firstOfMonth, String(months)]);
    return r.months > 0 ? r.total / r.months : null;
  }

  /**
   * A target to start from for a month, so a business that has never set one does not have to invent a number: the same month last year, or the recent
   * monthly average when there is no history for it, plus a growth percentage. Nothing is saved; the Business Head reviews and saves.
   */
  async suggestTargets(user: any, month?: string, growth?: any) {
    const sc = await this.dash.scope(user, null);
    if (!sc.owner || !sc.businessId) throw new ForbiddenException('Only the Business Head sets targets.');
    const m = month && MONTH.test(month) ? month : new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);
    const g = Math.min(100, Math.max(-50, Number(growth) || 0));
    const first = `${m}-01`;
    const lastYearFirst = `${Number(m.slice(0, 4)) - 1}-${m.slice(5, 7)}-01`;
    const lastYearNext = new Date(Date.UTC(Number(lastYearFirst.slice(0, 4)), Number(lastYearFirst.slice(5, 7)), 1)).toISOString().slice(0, 10);
    const cfg = await this.config.valuesFor(sc.businessId, 'health');
    const months = Number(cfg.recent_months) || 3;
    const one = async (stores: number[] | null) => suggestedTarget(await this.sumSales(stores, lastYearFirst, lastYearNext), await this.recentMonthlyAverage(stores, first, months), g);
    const storeRows = await this.manager.query(`select id, location from stores where business_id = $1 and active and not archive and id = any($2::int[]) order by location`, [sc.businessId, sc.stores]);
    return {
      month: m, growth: g,
      business: await one(sc.stores),
      stores: await Promise.all(storeRows.map(async (s: any) => ({ id: +s.id, location: String(s.location).trim(), ...(await one([+s.id])) }))),
    };
  }

  // ------------------------------------------------------------------ store health

  /** The store (or the whole business) health: seven checks, the business's weights, the Watch safeguard. */
  async health(user: any, storeid?: any) {
    const requested = this.num(storeid);
    const sc = await this.managed(user, storeid);
    if (!sc.businessId) return { score: null, status: null, held: false, checks: [] };
    const stores = sc.stores;
    const cfg = await this.config.valuesFor(sc.businessId, 'health');
    const rec = await this.config.valuesFor(sc.businessId, 'recognition');
    const now = new Date(Date.now() + 5.5 * 3600000);
    const month = now.toISOString().slice(0, 7);
    const day = now.getUTCDate();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const todayIst = now.toISOString().slice(0, 10);

    // a check the business has switched off is not asked for at all
    const on = (k: string) => cfg[`on_${k}`] !== false;
    const num = (k: string, d: number) => (Number.isFinite(Number(cfg[k])) ? Number(cfg[k]) : d);
    const skip = <T>(v: T) => Promise.resolve(v);
    const basis = String(cfg.sales_basis || 'target or recent average');
    const stockBasis = String(cfg.stock_basis || 'products below their minimum');
    const per = periodsFor(todayIst, 'prev');
    const yr = periodsFor(todayIst, 'lastyear');
    const custDays = num('customers_window_days', 30);
    const svcDays = num('service_window_days', 30);
    const sellDays = num('stock_window_days', 30);
    const expiryDays = num('expiry_days', 90);
    const tol = num('cash_tolerance', 100);

    const [sales, target, stock, shifts, varShifts, owed, customers, late, service, lastMonthSoFar, lastYearSoFar, recentAvg] = await Promise.all([
      on('sales') ? this.dash.getSalesAggregate(stores, 'month') : skip({ total: 0, orders: 0 }),
      on('sales') ? this.targetFor(sc.businessId, stores, requested, month) : skip(null),
      !on('stock') ? skip([{}]) : stockBasis === 'products out of stock but selling'
        ? this.manager.query(
          `select count(*)::int as selling, count(*) filter (where coalesce(b.q, 0) <= 0)::int as out
             from (select si.product_id from sale_item si join sale s on s.id = si.sale_id
                    where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive and s.bill_date >= current_date - ($2 || ' days')::interval
                      and ($1::int[] is null or s.store_id = any($1::int[])) group by si.product_id having sum(si.qty) > 0) sold
             left join (select product_id, sum(available_qty) as q from stock_view group by 1) b on b.product_id = sold.product_id`, [stores, String(sellDays)])
        : stockBasis === 'stock close to expiry'
          ? this.manager.query(
            `select coalesce(sum(available_qty * ptr_value / nullif(pack, 0)), 0)::float8 as total,
                    coalesce(sum(available_qty * ptr_value / nullif(pack, 0)) filter (where expdate <= current_date + ($1 || ' days')::interval), 0)::float8 as expiring
               from stock_view where available_qty > 0`, [String(expiryDays)])
          : this.manager.query(
            `select count(*) filter (where p.min_stock > 0)::int as withmin,
                    count(*) filter (where p.min_stock > 0 and coalesce(b.q, 0) >= p.min_stock)::int as ok
               from product p left join (select product_id, sum(available_qty) as q from stock_view group by 1) b on b.product_id = p.id
              where p.active and not p.archive`),
      on('cash') ? this.manager.query(`select count(*)::int as n from store_shifts where status = 'OPEN' and shift_date < current_date and ($1::int[] is null or store_id = any($1::int[]))`, [stores]) : skip([{ n: 0 }]),
      on('cash') && num('cash_variance_points', 0) > 0
        ? this.manager.query(`select count(*)::int as n from store_shifts where status = 'CLOSED' and closed_on >= now() - interval '30 days' and abs(coalesce(variance, 0)) > $2 and ($1::int[] is null or store_id = any($1::int[]))`, [stores, tol])
        : skip([{ n: 0 }]),
      on('purchasing') ? this.dash.getOutstandingInvoices(stores) : skip([] as any[]),
      on('customers') ? this.manager.query(
        `select count(*)::int as bills, count(*) filter (where c.mobile is not null and c.mobile <> $2)::int as withmobile
           from sale s left join customer c on c.id = s.customer_id
          where s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= current_date - ($3 || ' days')::interval
            and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores, NO_MOBILE, String(custDays)]) : skip([{}]),
      on('compliance') ? this.manager.query(
        `select count(*) filter (where step = 'late')::int as late, count(*) filter (where step = 'escalated')::int as escalated
           from compliance_instance where business_id = $1 and state = 'OPEN' and not_mine = false and ($2::int[] is null or store_id is null or store_id = any($2::int[]))`, [sc.businessId, stores]) : skip([{}]),
      on('service') ? this.manager.query(
        `select count(*) filter (where d.status = 'Delivered')::int as delivered, count(*) filter (where d.status = 'Failed')::int as failed
           from sale_deliveries d join sale s on s.id = d."saleId"
          where d.active and not d.archive and d.booked_date >= current_date - ($2 || ' days')::interval and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores, String(svcDays)]) : skip([{}]),
      on('sales') && basis === 'last month' ? this.sumSales(stores, per.cmpFrom, per.cmpTo) : skip(0),
      on('sales') && basis === 'same period last year' ? this.sumSales(stores, yr.cmpFrom, yr.cmpTo) : skip(0),
      on('sales') && (basis === 'recent average' || basis === 'target or recent average') ? this.recentMonthlyAverage(stores, `${month}-01`, num('recent_months', 3)) : skip(null),
    ]);
    const exp = expectedSales(basis, { target, day, daysInMonth, lastMonthSoFar, lastYearSoFar, recentMonthlyAvg: recentAvg });

    const today = new Date().toISOString().slice(0, 10);
    const graceDate = (() => { const d = new Date(Date.parse(today) - num('payables_grace_days', 0) * 86400000); return d.toISOString().slice(0, 10); })();
    const balance = (i: any) => Number(i.balance_amount) || 0;
    const owedTotal = owed.reduce((a: number, i: any) => a + balance(i), 0);
    const overdueTotal = owed.filter((i: any) => i.due_date && String(i.due_date).slice(0, 10) < graceDate).reduce((a: number, i: any) => a + balance(i), 0);
    const aim = Number(rec.capture_pct) || 95;
    const s0: any = stock[0] || {};

    const stockResult = stockBasis === 'products out of stock but selling' ? stockOutScore(s0.selling || 0, s0.out || 0)
      : stockBasis === 'stock close to expiry' ? expiryScore(s0.total || 0, s0.expiring || 0)
      : stockScore(s0.withmin || 0, s0.ok || 0);
    const scores = {
      sales: salesScoreVs(sales.total, exp.expected),
      stock: stockResult,
      cash: cashScore(shifts[0]?.n || 0, num('cash_points_per_shift', 25), varShifts[0]?.n || 0, num('cash_variance_points', 0)),
      purchasing: purchasingScore(owedTotal, overdueTotal),
      customers: customersScore(customers[0]?.bills || 0, customers[0]?.withmobile || 0, aim),
      compliance: complianceScore(late[0]?.late || 0, late[0]?.escalated || 0, num('compliance_late_points', 10), num('compliance_escalated_points', 25)),
      service: serviceScore((service[0]?.delivered || 0) + (service[0]?.failed || 0), service[0]?.delivered || 0),
    };
    const weights: any = {};
    for (const c of CHECKS) weights[c.key] = Number(cfg[c.weightKey]);
    const off = CHECKS.map((c) => c.key).filter((k) => !on(k));
    const result = combine(scores, { weights, healthyMin: Number(cfg.healthy_min) || 80, holdBelow: Number(cfg.hold_below) || 60, off });
    // the figures behind each check, so a score can be explained and traced; a check with nothing to judge says what is needed
    const facts: Record<string, string> = {
      sales: exp.expected
        ? `${Math.round(sales.total)} so far, against ${Math.round(exp.expected)} expected by now (${exp.source === 'target' ? 'from the monthly target' : exp.source === 'recent average' ? 'from the recent monthly average' : exp.source === 'last month' ? 'the same days of last month' : 'the same days a year ago'})`
        : basis === 'off' ? 'Not measured: switched off in Setup' : 'Nothing to measure against yet: set a target, or choose another basis in Setup (Health and targets)',
      stock: stockBasis === 'products out of stock but selling'
        ? (s0.selling ? `${s0.out || 0} of ${s0.selling} products sold in the last ${sellDays} days are out of stock` : `No sales in the last ${sellDays} days to judge by`)
        : stockBasis === 'stock close to expiry'
          ? (s0.total ? `${Math.round(s0.expiring || 0)} of ${Math.round(s0.total)} of stock (at cost) expires within ${expiryDays} days` : 'No stock on hand to judge')
          : (s0.withmin ? `${s0.ok || 0} of ${s0.withmin} products with a minimum are at or above it` : 'No product has a minimum stock yet: set one on the products, or choose another stock basis in Setup'),
      cash: `${shifts[0]?.n || 0} shift(s) left open from an earlier day${num('cash_variance_points', 0) > 0 ? `, ${varShifts[0]?.n || 0} closed in 30 days with a drawer difference over ${tol}` : ''}`,
      purchasing: `${Math.round(overdueTotal)} overdue of ${Math.round(owedTotal)} owed to vendors${num('payables_grace_days', 0) ? ` (${num('payables_grace_days', 0)} days of grace)` : ''}`,
      customers: customers[0]?.bills ? `${customers[0]?.withmobile || 0} of ${customers[0]?.bills || 0} bills in ${custDays} days carry a mobile number (aim ${aim}%)` : `No bills in the last ${custDays} days to judge by`,
      compliance: `${late[0]?.late || 0} late and ${late[0]?.escalated || 0} escalated item(s) in the register`,
      service: (service[0]?.delivered || 0) + (service[0]?.failed || 0) ? `${service[0]?.delivered || 0} delivered, ${service[0]?.failed || 0} failed in ${svcDays} days` : `No finished deliveries in the last ${svcDays} days to judge by`,
    };
    return {
      ...result,
      checks: result.checks.map((c) => ({ ...c, fact: !c.on ? 'Switched off in Setup' : facts[c.key] })),
      asOf: new Date().toISOString(), target,
      salesBasis: { chosen: basis, used: exp.source, expected: exp.expected === null ? null : Math.round(exp.expected) },
    };
  }

  // ------------------------------------------------------------------ tiles

  private async salesFigures(stores: number[] | null, from: string, to: string, withMargin: boolean) {
    const [a] = await this.manager.query(
      `select coalesce(sum(s.total), 0)::float8 as sales, count(*)::int as bills, coalesce(sum(s.disc_amount), 0)::float8 as disc
         from sale s where s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= $2::date and s.bill_date < $3::date
          and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores, from, to]);
    const [r] = await this.manager.query(
      `select coalesce(sum(sri.qty * si.total / nullif(si.qty, 0)), 0)::float8 as value
         from sale_return_item sri join sale_item si on si.id = sri.sale_item_id join sale s on s.id = si.sale_id
        where sri.active and not sri.archive and sri.created_on >= $2::date and sri.created_on < $3::date
          and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores, from, to]);
    let margin: { pct: number | null; coverage: number } | null = null;
    if (withMargin) {
      // net of GST sale value over the lines, and the cost of the batch sold (after the vendor discount and the free quantity, per unit of the pack)
      const [m] = await this.manager.query(
        `select coalesce(sum(net), 0)::float8 as net_all,
                coalesce(sum(net) filter (where covered), 0)::float8 as net_covered,
                coalesce(sum(cogs) filter (where covered), 0)::float8 as cogs_covered
           from (select si.total / (1 + coalesce(si.tax_pcnt, 0) / 100.0) as net,
                        (pii.ptr_value * (1 - coalesce(pii.disc_pcnt, 0) / 100.0) * pii.qty / nullif(pii.qty + coalesce(pii.free_qty, 0), 0) / nullif(p.pack, 0)) * si.qty as cogs,
                        (pii.id is not null and p.pack > 0 and pii.ptr_value > 0) as covered
                   from sale_item si join sale s on s.id = si.sale_id
                        left join purchase_invoice_item pii on pii.id = si.purchase_item_id left join product p on p.id = si.product_id
                  where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive
                    and s.bill_date >= $2::date and s.bill_date < $3::date and ($1::int[] is null or s.store_id = any($1::int[]))) x`, [stores, from, to]);
      margin = marginOf(m.net_covered, m.cogs_covered, m.net_all);
    }
    const gross = a.sales + a.disc;
    return {
      sales: a.sales, bills: a.bills, avgBill: a.bills ? a.sales / a.bills : 0,
      discountPct: gross > 0 ? Math.round((a.disc / gross) * 1000) / 10 : 0,
      returnsPct: a.sales > 0 ? Math.round((r.value / a.sales) * 1000) / 10 : 0,
      margin,
    };
  }

  /**
   * The tiles: this month to date against the previous month (or the same month last year), each with its change and whether it is good, a spark line of
   * the last 14 days of sales, and (owner only) gross margin with how much of the sales its cost covers.
   */
  async tiles(user: any, storeid?: any, compare?: any) {
    const sc = await this.managed(user, storeid);
    const cmp = compareOf(compare);
    const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    const p = periodsFor(today, cmp);
    const [now, before] = await Promise.all([this.salesFigures(sc.stores, p.from, p.to, sc.owner), this.salesFigures(sc.stores, p.cmpFrom, p.cmpTo, sc.owner)]);
    const spark = await this.manager.query(
      `select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(sum(s.total), 0)::float8 as value
         from generate_series(current_date - 13, current_date, interval '1 day') d(day)
         left join sale s on date(s.bill_date) = d.day::date and s.status = 'COMPLETE' and s.active and not s.archive and ($1::int[] is null or s.store_id = any($1::int[]))
        group by 1 order by 1`, [sc.stores]);
    const tile = (key: string, label: string, value: number, prev: number, goodWhen: 'up' | 'down', unit: 'money' | 'count' | 'pct', link?: string) =>
      ({ key, label, value: Math.round(value * 100) / 100, prev: Math.round(prev * 100) / 100, unit, ...deltaOf(value, prev, goodWhen), link: link || null });
    const tiles: any[] = [
      { ...tile('sales', 'Sales', now.sales, before.sales, 'up', 'money', '/secure/sales'), spark },
      tile('bills', 'Bills', now.bills, before.bills, 'up', 'count', '/secure/sales'),
      tile('avgbill', 'Average bill', now.avgBill, before.avgBill, 'up', 'money'),
      tile('discount', 'Discount given', now.discountPct, before.discountPct, 'down', 'pct'),
      tile('returns', 'Returns', now.returnsPct, before.returnsPct, 'down', 'pct', '/secure/returns'),
    ];
    if (sc.owner && now.margin) {
      tiles.push({ ...tile('margin', 'Gross margin', now.margin.pct ?? 0, before.margin?.pct ?? 0, 'up', 'pct'), withheld: now.margin.pct === null, coverage: now.margin.coverage });
    }
    return { compare: cmp, period: `${p.from} to ${today}`, against: `${p.cmpFrom} to ${p.cmpTo}`, tiles, asOf: new Date().toISOString() };
  }

  // ------------------------------------------------------------------ deliveries and money

  /** Deliveries by week for the last 8 weeks: delivered, failed and still pending. */
  async deliveries(user: any, storeid?: any) {
    const sc = await this.managed(user, storeid);
    const rows = await this.manager.query(
      `select to_char(date_trunc('week', d.booked_date), 'YYYY-MM-DD') as week,
              count(*) filter (where d.status = 'Delivered')::int as delivered, count(*) filter (where d.status = 'Failed')::int as failed,
              count(*) filter (where coalesce(d.status, 'Pending') not in ('Delivered', 'Failed'))::int as pending
         from sale_deliveries d join sale s on s.id = d."saleId"
        where d.active and not d.archive and d.booked_date >= date_trunc('week', current_date) - interval '7 weeks'
          and ($1::int[] is null or s.store_id = any($1::int[])) group by 1 order by 1`, [sc.stores]);
    const total = rows.reduce((a: number, r: any) => a + r.delivered + r.failed, 0);
    const ok = rows.reduce((a: number, r: any) => a + r.delivered, 0);
    return { weeks: rows, deliveredPct: total ? Math.round((ok / total) * 1000) / 10 : null };
  }

  /** Approved expenses of the month by category, largest first. */
  async expenses(user: any, storeid?: any) {
    const sc = await this.managed(user, storeid);
    const rows = await this.manager.query(
      `select c.name as category, coalesce(sum(e.amount), 0)::float8 as total, count(*)::int as count
         from expense e join expense_category c on c.id = e.category_id
        where e.status = 'APPROVED' and e.expense_date >= date_trunc('month', current_date) and e.expense_date < date_trunc('month', current_date) + interval '1 month'
          and ($1::int[] is null or e.store_id = any($1::int[])) group by 1 order by 2 desc`, [sc.stores]);
    return { categories: rows, total: Math.round(rows.reduce((a: number, r: any) => a + r.total, 0) * 100) / 100 };
  }

  // ------------------------------------------------------------------ charts

  /** Sales by month for the last 12 months against the same months of the year before and the year before that. */
  async salesByMonth(user: any, storeid?: any) {
    const sc = await this.managed(user, storeid);
    const rows = await this.manager.query(
      `select to_char(date_trunc('month', s.bill_date), 'YYYY-MM') as m, coalesce(sum(s.total), 0)::float8 as total, count(*)::int as bills
         from sale s
        where s.status = 'COMPLETE' and s.active and not s.archive
          and s.bill_date >= date_trunc('month', current_date) - interval '35 months'
          and ($1::int[] is null or s.store_id = any($1::int[]))
        group by 1 order by 1`, [sc.stores]);
    const by = new Map<string, any>(rows.map((r: any) => [r.m, r]));
    const out: any[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = (y: number) => `${d.getUTCFullYear() - y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      out.push({ month: key(0), label: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }), sales: by.get(key(0))?.total || 0, bills: by.get(key(0))?.bills || 0, lastYear: by.get(key(1))?.total || 0, twoYearsAgo: by.get(key(2))?.total || 0 });
    }
    return { months: out, asOf: new Date().toISOString() };
  }

  /** Sales by product category this month (or a chosen month), largest first, with the share of the whole. */
  async categories(user: any, storeid?: any, month?: string) {
    const sc = await this.managed(user, storeid);
    const m = month && MONTH.test(month) ? month : new Date().toISOString().slice(0, 7);
    const rows = await this.manager.query(
      `select coalesce(nullif(trim(p.category), ''), 'Uncategorised') as category, coalesce(sum(si.total), 0)::float8 as total, coalesce(sum(si.qty), 0)::float8 as qty
         from sale_item si join sale s on s.id = si.sale_id left join product p on p.id = si.product_id
        where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive
          and s.bill_date >= ($2 || '-01')::date and s.bill_date < (($2 || '-01')::date + interval '1 month')
          and ($1::int[] is null or s.store_id = any($1::int[]))
        group by 1 order by 2 desc`, [sc.stores, m]);
    const sum = rows.reduce((a: number, r: any) => a + r.total, 0);
    return { month: m, total: sum, categories: rows.map((r: any) => ({ category: r.category, total: r.total, qty: r.qty, share: sum ? Math.round((r.total / sum) * 1000) / 10 : 0 })) };
  }

  /** New and returning customers per month for the last 6 months (counts only; a bill without a mobile number is not a known customer). */
  async customers(user: any, storeid?: any) {
    const sc = await this.managed(user, storeid);
    const rows = await this.manager.query(
      `with first as (
         select s.customer_id, min(s.bill_date) as f from sale s join customer c on c.id = s.customer_id
          where s.status = 'COMPLETE' and s.active and not s.archive and c.mobile <> $2 group by 1),
       m as (
         select distinct date_trunc('month', s.bill_date) as month, s.customer_id from sale s
          where s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= date_trunc('month', current_date) - interval '5 months'
            and ($1::int[] is null or s.store_id = any($1::int[])))
       select to_char(m.month, 'YYYY-MM') as month,
              count(*) filter (where date_trunc('month', f.f) = m.month)::int as new,
              count(*) filter (where date_trunc('month', f.f) < m.month)::int as returning
         from m join first f on f.customer_id = m.customer_id group by 1 order by 1`, [sc.stores, NO_MOBILE]);
    return { months: rows.map((r: any) => ({ ...r, repeatRate: r.new + r.returning ? Math.round((r.returning / (r.new + r.returning)) * 100) : 0 })) };
  }

  /** Bills by weekday and hour over the last 90 days: when the store is busy. Weekday 1 is Monday. */
  async busyHours(user: any, storeid?: any) {
    const sc = await this.managed(user, storeid);
    const rows = await this.manager.query(
      `select extract(isodow from s.bill_date)::int as dow, extract(hour from s.bill_date)::int as hour, count(*)::int as bills
         from sale s where s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= current_date - interval '90 days'
          and ($1::int[] is null or s.store_id = any($1::int[])) group by 1, 2 order by 1, 2`, [sc.stores]);
    return { cells: rows, days: 90 };
  }

  /** What is owed to vendors by how late it is, and who it is owed to. Owner and Store Head views (not the shift people). */
  async payables(user: any, storeid?: any) {
    const sc = await this.managed(user, storeid);
    const open = await this.dash.getOutstandingInvoices(sc.stores);
    const today = Date.parse(new Date().toISOString().slice(0, 10));
    const buckets = [
      { key: 'notdue', label: 'Not yet due', total: 0, count: 0 },
      { key: 'd0_30', label: '1 to 30 days late', total: 0, count: 0 },
      { key: 'd31_60', label: '31 to 60 days', total: 0, count: 0 },
      { key: 'd61_90', label: '61 to 90 days', total: 0, count: 0 },
      { key: 'd90_plus', label: 'Over 90 days', total: 0, count: 0 },
    ];
    for (const i of open) {
      const due = i.due_date ? Date.parse(String(i.due_date).slice(0, 10)) : Date.parse(String(i.invoice_date).slice(0, 10));
      const late = Math.floor((today - due) / 86400000);
      const b = late <= 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : late <= 90 ? buckets[3] : buckets[4];
      b.total += Number(i.balance_amount) || 0;
      b.count += 1;
    }
    return { buckets: buckets.map((b) => ({ ...b, total: Math.round(b.total * 100) / 100 })), total: Math.round(buckets.reduce((a, b) => a + b.total, 0) * 100) / 100 };
  }
}
