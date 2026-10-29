import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { PurchaseInvoiceService } from "../purchases/purchase-invoice.service";
import { PurchaseService } from "../purchases/purchase.service";

import { OWNER_ROLES } from 'src/core/roles';
import { businessOfUser } from 'src/core/business-of-user';
import { DepositRule, evaluateDeposit } from '../store/deposit-rule';
import { ConfigService } from 'src/core/config/config.service';
import { viewForRole, widgetsFor, VIEW_OF_ROLE } from './dashboard-view';
import { checkValue, defOf } from 'src/core/config/config-schema';
import { aimFromUsual, againstUsual, capturePct, goalProgress, ringPct, usualOf } from './dashboard-mine';
/** Customer record used at the counter when no mobile number is given (mobile '0000000000', name NIL). */
const NO_MOBILE_PLACEHOLDER = '0000000000';

@Injectable()
export class DashboardService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly purchaseService: PurchaseService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
    private readonly config: ConfigService,
  ) {}

  /** The view this person's role opens, its widgets in order, and the business's choices for it (period, GST basis, grouped menu). */
  async view(currentUser: any) {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [currentUser?.roleid || 0]);
    const view = viewForRole(role?.name);
    const businessId = await businessOfUser(this.manager, currentUser?.id || 0);
    const settings = businessId ? await this.config.valuesFor(businessId, 'views') : {};
    return { view, widgets: widgetsFor(view), settings };
  }

  /**
   * "Preview as": the view a role would open and the dashboard settings that would apply, with the Business Head's unsaved choices laid over today's
   * (checked the same way as a save). Nothing is written. Business Head and Owner-operator only.
   */
  async preview(currentUser: any, body: { role?: string; values?: Record<string, any> }) {
    const sc = await this.scope(currentUser, null);
    if (!sc.owner || !sc.businessId) throw new ForbiddenException('Only the Business Head can preview other views.');
    const role = String(body?.role || '');
    const known = Object.keys(VIEW_OF_ROLE);
    if (!role || !known.includes(role)) throw new BadRequestException(`Choose one of: ${known.join(', ')}.`);
    const settings: Record<string, any> = { ...(await this.config.valuesFor(sc.businessId, 'views')) };
    for (const [key, v] of Object.entries(body?.values || {})) {
      const d = defOf('views', key);
      if (!d) throw new BadRequestException(`Unknown setting "${key}".`);
      const err = checkValue(d, v);
      if (err) throw new BadRequestException(err);
      settings[key] = v;
    }
    const view = viewForRole(role);
    return { role, view, widgets: widgetsFor(view), settings };
  }

  /**
   * The Staff and Counter views: the person's own day against their own usual (the same weekday over the last eight weeks), their goals, and the
   * store's day. A counter login is shared, so its figures are the bills made on that login; a person's own login counts the bills they served.
   * Nothing here names a customer or another person.
   */
  async mine(currentUser: any) {
    const uid = Number(currentUser?.id) || 0;
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [currentUser?.roleid || 0]);
    const view = viewForRole(role?.name);
    const by = view === 'counter' ? 's.created_by' : 'coalesce(s.acting_user_id, s.created_by)';
    const sc = await this.scope(currentUser, null);
    const stores = sc.stores;
    const businessId = await businessOfUser(this.manager, uid);
    const aimCapture = Number((businessId ? await this.config.valuesFor(businessId, 'recognition') : {}).capture_pct) || 95;
    const real = `(c.mobile is not null and c.mobile !~ '^0*$')`;

    // my bills for the last 56 days by day and hour
    const rows = await this.manager.query(
      `select s.bill_date::date::text as d, extract(hour from s.bill_date)::int as h, sum(s.total)::float as t, count(*)::int as bills,
              count(*) filter (where ${real})::int as with_mobile
         from sale s left join customer c on c.id = s.customer_id
        where s.status = 'COMPLETE' and ${by} = $1 and s.bill_date >= current_date - 56 and s.bill_date < current_date + 1
        group by 1, 2`, [uid]);
    const [{ today }] = await this.manager.query(`select current_date::text as today`);
    const dow = new Date(today + 'T00:00:00Z').getUTCDay();
    const sameDow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay() === dow;
    const byDay = new Map<string, { t: number; bills: number; m: number }>();
    const hourToday: Record<number, number> = {};
    const hourHist: Record<number, number> = {};
    const histDays = new Set<string>();
    for (const r of rows) {
      const e = byDay.get(r.d) || { t: 0, bills: 0, m: 0 };
      e.t += r.t; e.bills += r.bills; e.m += r.with_mobile; byDay.set(r.d, e);
      if (r.d === today) hourToday[r.h] = (hourToday[r.h] || 0) + r.t;
      else if (sameDow(r.d)) { hourHist[r.h] = (hourHist[r.h] || 0) + r.t; histDays.add(r.d); }
    }
    const nHist = histDays.size;
    const usualDay = usualOf([...histDays].map((d) => byDay.get(d)!.t));
    const me = byDay.get(today) || { t: 0, bills: 0, m: 0 };
    const hours = Array.from({ length: 13 }, (_, i) => i + 9);
    const nowH = (await this.manager.query(`select extract(hour from now() at time zone 'Asia/Kolkata')::int as h`))[0].h;

    // my last 7 days against my usual week (the four 7-day windows before)
    const dayOf = (offset: number) => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - offset); return byDay.get(d.toISOString().slice(0, 10)); };
    const win = (from: number) => Array.from({ length: 7 }, (_, i) => dayOf(from + i)?.t || 0).reduce((a, b) => a + b, 0);
    const week = win(0);
    const usualWeek = usualOf([win(7), win(14), win(21), win(28)].filter((x) => x > 0));
    const wk = Array.from({ length: 7 }, (_, i) => dayOf(i)).reduce((a, e) => ({ m: a.m + (e?.m || 0), b: a.b + (e?.bills || 0) }), { m: 0, b: 0 });

    // my parked bills and the deliveries waiting in my stores
    const parked = await this.manager.query(
      `select s.id, s.bill_no, s.total::float as total, to_char(s.created_on at time zone 'Asia/Kolkata', 'HH24:MI') as at
         from sale s where s.status = 'PENDING' and ${by} = $1 order by s.created_on desc limit 10`, [uid]);
    const [dl] = await this.manager.query(
      `select count(*)::int as n from sale_deliveries d join sale s on s.id = d."saleId"
        where coalesce(d.status, 'Pending') = 'Pending' and d.active and ($1::int[] is null or s.store_id = any($1::int[]))`, [stores]);

    // the store's day (shared goals)
    const st = await this.manager.query(
      `select s.bill_date::date::text as d, sum(s.total)::float as t, count(*)::int as bills, count(*) filter (where ${real})::int as with_mobile
         from sale s left join customer c on c.id = s.customer_id
        where s.status = 'COMPLETE' and ($1::int[] is null or s.store_id = any($1::int[])) and s.bill_date >= current_date - 56 and s.bill_date < current_date + 1
        group by 1`, [stores]);
    const stToday = st.find((r: any) => r.d === today) || { t: 0, bills: 0, with_mobile: 0 };
    const stUsual = usualOf(st.filter((r: any) => r.d !== today && sameDow(r.d)).map((r: any) => r.t));

    const aim = aimFromUsual(usualDay);
    const capToday = capturePct(me.m, me.bills);
    const goals = [
      { key: 'capture', title: 'Ask for a mobile number', done: me.m, of: me.bills,
        note: me.bills ? `${me.m} of ${me.bills} bills have a number (${capToday}%). The aim is ${aimCapture}%.` : 'No bills yet today.' },
      { key: 'parked', title: 'Clear your parked bills', done: parked.length ? 0 : 1, of: 1, note: parked.length ? `${parked.length} still parked: finish or discard them before closing.` : 'Nothing parked.' },
      { key: 'deliveries', title: 'Hand over the deliveries', done: dl.n ? 0 : 1, of: 1, note: dl.n ? `${dl.n} waiting to be handed over.` : 'Every delivery is handed over.' },
    ].map((g) => ({ ...g, ...goalProgress(g) }));

    return {
      view,
      today: { sales: Math.round(me.t), bills: me.bills, avgBill: me.bills ? Math.round(me.t / me.bills) : 0, usual: usualDay === null ? null : Math.round(usualDay),
        against: againstUsual(me.t, usualDay), aim, ring: ringPct(me.t, aim), capturePct: capToday, history: nHist },
      hours: hours.map((h) => ({ hour: h, mine: h <= nowH ? Math.round(hourToday[h] || 0) : null, usual: nHist ? Math.round((hourHist[h] || 0) / nHist) : null })),
      week: { sales: Math.round(week), usual: usualWeek === null ? null : Math.round(usualWeek), against: againstUsual(week, usualWeek), capturePct: capturePct(wk.m, wk.b) },
      goals, parked,
      store: { sales: Math.round(stToday.t), usual: stUsual === null ? null : Math.round(stUsual), against: againstUsual(stToday.t, stUsual),
        capturePct: capturePct(stToday.with_mobile, stToday.bills), captureAim: aimCapture },
    };
  }

  /**
   * What this person may see, decided here and not by the screen: the stores of the business for an owner, the stores they are assigned to for anyone
   * else (or the business's stores when none are assigned), and everything only for a platform user with no business. A store they ask for must be one
   * of them. `stores` null means no limit; an empty list means nothing.
   */
  async scope(currentUser: any, requested: number | null) {
    const userId = Number(currentUser?.id) || 0;
    const [role] = await this.manager.query(`select r.name, r.permissions from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [userId]);
    const resources = new Set<string>((Array.isArray(role?.permissions) ? role.permissions : []).map((p: any) => String(p?.resource)));
    const owner = OWNER_ROLES.includes(role?.name);
    const businessId = await businessOfUser(this.manager, userId);
    let stores: number[] | null = null;
    if (businessId) {
      const inBusiness = (await this.manager.query(`select id from stores where business_id = $1 and active and not archive`, [businessId])).map((r: any) => +r.id);
      if (owner) stores = inBusiness;
      else {
        const assigned = (await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [userId])).map((r: any) => +r.store_id);
        const mine = assigned.filter((id: number) => inBusiness.includes(id));
        stores = mine.length ? mine : inBusiness;
      }
    }
    if (requested !== null) {
      if (stores !== null && !stores.includes(requested)) throw new ForbiddenException('That store is not one of yours.');
      stores = [requested];
    }
    return { stores, businessId, owner, role: role?.name as string | undefined, resources };
  }

  async summary(query: any, currentUser?: any) {
    const sc = await this.scope(currentUser, this.toNumber(query?.storeid));
    const storeid = sc.stores && sc.stores.length === 1 ? sc.stores[0] : null;
    const stores = sc.stores;
    const purchasing = sc.owner || sc.resources.has('purchaseorders');       // purchase orders belong to the installation, not to a store: only those who work with them see them
    const [
      salesTrend, purchaseTrend, cashTrend,
      salesToday, salesMonth, purchaseMonth,
      openShifts, cashSnapshot, pendingApprovals,
      outstandingInvoices, lowStock, salesReturns,
      cashMovement, paymentSplit, approvalBreakdown,
    ] = await Promise.all([
      this.getSalesTrend(stores),
      this.getPurchaseTrend(stores),
      this.getCashTrend(stores),
      this.getSalesAggregate(stores, "today"),
      this.getSalesAggregate(stores, "month"),
      this.getPurchaseAggregate(stores, "month"),
      this.getOpenShifts(stores),
      this.getCashSnapshot(stores, storeid),
      purchasing ? this.getPendingApprovals() : Promise.resolve([]),
      this.getOutstandingInvoices(stores),
      purchasing ? this.getLowStockSuggestions() : Promise.resolve([]),
      this.getSalesReturnsMonth(stores),
      this.getCashMovementMonth(stores),
      this.getSalesPaymentSplit(stores),
      purchasing ? this.getPurchaseApprovalBreakdown() : Promise.resolve([]),
    ]);

    return {
      storeid,
      generatedat: new Date().toISOString(),
      kpis: {
        sales_today: salesToday.total,
        sales_today_orders: salesToday.orders,
        sales_month: salesMonth.total,
        sales_month_orders: salesMonth.orders,
        purchase_month: purchaseMonth.total,
        purchase_month_invoices: purchaseMonth.invoices,
        open_shifts: openShifts.length,
        cash_balance: cashSnapshot.cashbalance,
        deposit_threshold: cashSnapshot.depositthreshold,
        deposit_due: cashSnapshot.depositdue,
        deposit_reason: cashSnapshot.depositreason,
        deposit_next: cashSnapshot.depositnext,
        cash_expenses_month: cashMovement.expenses,
        bank_deposits_month: cashMovement.deposits,
        overdue_invoices: outstandingInvoices.filter((invoice: any) => invoice.is_overdue).length,
        outstanding_invoices: outstandingInvoices.length,
        pending_purchase_approvals: pendingApprovals.length,
        low_stock_items: lowStock.length,
        sales_returns_month: salesReturns.qty,
        sales_returns_invoices_month: salesReturns.invoices,
        sales_returns_value_month: salesReturns.value,
      },
      salestrend: salesTrend,
      purchasetrend: purchaseTrend,
      cashtrend: cashTrend,
      paymentsplit: paymentSplit,
      approvalbreakdown: approvalBreakdown,
      openShifts,
      pendingapprovals: pendingApprovals,
      outstandinginvoices: outstandingInvoices.slice(0, 5),
      lowstock: lowStock.slice(0, 5),
      salesreturns: salesReturns,
    };
  }

  private async getSalesPaymentSplit(stores: number[] | null) {
    const row = await this.manager.query(`
      select
        coalesce(sum(s.cash_amount), 0) as cash,
        coalesce(sum(s.digi_amount), 0) as digital
      from sale s
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true
        and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
    `, [stores]);
    return [
      { name: 'Cash', value: +row?.[0]?.cash || 0 },
      { name: 'Digital', value: +row?.[0]?.digital || 0 },
    ];
  }

  private async getPurchaseApprovalBreakdown() {
    const rows = await this.manager.query(`
      select
        initcap(lower(replace(coalesce(approval_status, 'Pending'), '_', ' '))) as status,
        count(*)::int as count
      from purchase_order
      where active = true and archive = false
        and created_on >= date_trunc('month', current_date)
      group by 1
    `);
    // "Approved" and "APPROVED" are one status: the donut has one slice for each
    const map: Record<string, number> = { Pending: 0, Approved: 0, Rejected: 0 };
    rows.forEach((r: any) => { map[r.status] = (map[r.status] || 0) + (+r.count || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }

  async getSalesAggregate(stores: number[] | null, bucket: "today" | "month") {
    const periodClause = bucket === "today"
      ? "s.bill_date >= current_date and s.bill_date < current_date + interval '1 day'"
      : "s.bill_date >= date_trunc('month', current_date)";
    const row = await this.manager.query(`
      select
        coalesce(sum(s.total), 0) as total,
        count(*)::int as orders
      from sale s
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true
        and s.archive = false
        and ${periodClause}
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
    `, [stores]);
    return {
      total: +row?.[0]?.total || 0,
      orders: +row?.[0]?.orders || 0,
    };
  }

  private async getPurchaseAggregate(stores: number[] | null, bucket: "today" | "month") {
    const periodClause = bucket === "today"
      ? "pi.invoice_date >= current_date and pi.invoice_date < current_date + interval '1 day'"
      : "pi.invoice_date >= date_trunc('month', current_date)";
    const row = await this.manager.query(`
      select
        coalesce(sum(pi.total), 0) as total,
        count(*)::int as invoices
      from purchase_invoice pi
      where pi.active = true
        and pi.archive = false
        and ${periodClause}
        and ($1::int[] is null or pi.store_id = any($1::int[]))
    `, [stores]);
    return {
      total: +row?.[0]?.total || 0,
      invoices: +row?.[0]?.invoices || 0,
    };
  }

  private async getSalesTrend(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        to_char(date_trunc('day', s.bill_date), 'yyyy-mm-dd') as period,
        coalesce(sum(s.total), 0) as total,
        coalesce(sum(s.cash_amount), 0) as cash,
        coalesce(sum(s.digi_amount), 0) as digital,
        count(*)::int as orders
      from sale s
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true
        and s.archive = false
        and s.bill_date >= current_date - interval '13 days'
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
      group by 1
      order by 1
    `, [stores]);
    return rows.map((row: any) => ({
      name: row.period,
      value: +row.total || 0,
      cash: +row.cash || 0,
      digital: +row.digital || 0,
      orders: +row.orders || 0,
    }));
  }

  private async getPurchaseTrend(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        to_char(date_trunc('day', pi.invoice_date), 'yyyy-mm-dd') as period,
        coalesce(sum(pi.total), 0) as total,
        count(*)::int as invoices
      from purchase_invoice pi
      where pi.active = true
        and pi.archive = false
        and pi.invoice_date >= current_date - interval '13 days'
        and pi.invoice_date <= current_date
        and ($1::int[] is null or pi.store_id = any($1::int[]))
      group by 1
      order by 1
    `, [stores]);
    return rows.map((row: any) => ({
      name: row.period,
      value: +row.total || 0,
      invoices: +row.invoices || 0,
    }));
  }

  private async getCashTrend(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        to_char(ledger.trans_date, 'yyyy-mm-dd') as period,
        coalesce(sum(ledger.deposit), 0) as deposit,
        coalesce(sum(ledger.withdraw), 0) as withdraw
      from store_cash_accounts ledger
      where ledger.trans_date >= current_date - interval '13 days'
        and ($1::int[] is null or ledger.store_id = any($1::int[]))
      group by 1
      order by 1
    `, [stores]);
    return rows.map((row: any) => ({
      name: row.period,
      series: [
        { name: "Deposit", value: +row.deposit || 0 },
        { name: "Withdraw", value: +row.withdraw || 0 },
      ],
    }));
  }

  private async getOpenShifts(stores: number[] | null) {
    return this.manager.query(`
      select
        s.id,
        s.shift_date as shiftdate,
        s.name,
        s.start_time as starttime,
        s.end_time as endtime,
        s.status,
        s.opening_cash as openingcash,
        s.expected_cash as expectedcash,
        s.counted_cash as countedcash,
        s.variance,
        s.deposit_threshold as depositthreshold,
        st.location as store_location,
        u.full_name as assigned_user
      from store_shifts s
      left join stores st on st.id = s.store_id
      left join app_user u on u.id = s.assigned_user_id
      where s.status = 'OPEN'
        and ($1::int[] is null or s.store_id = any($1::int[]))
      order by s.shift_date desc, s.id desc
      limit 5
    `, [stores]);
  }

  private async getCashSnapshot(stores: number[] | null, storeid: number | null) {
    const row = await this.manager.query(`
      select
        coalesce(sum(ledger.deposit), 0) as deposit,
        coalesce(sum(ledger.withdraw), 0) as withdraw
      from store_cash_accounts ledger
      where ($1::int[] is null or ledger.store_id = any($1::int[]))
    `, [stores]);

    let rule: DepositRule = { threshold: 0, schedule: 'none', weekdays: [], monthdays: [] };
    let lastDeposit: string | null = null;
    if (storeid) {
      const store = await this.manager.query(`
        select deposit_threshold as depositthreshold, deposit_schedule as schedule, deposit_weekdays as weekdays, deposit_month_days as monthdays
        from stores
        where id = $1
        limit 1
      `, [storeid]);
      rule = { threshold: +store?.[0]?.depositthreshold || 0, schedule: store?.[0]?.schedule || 'none', weekdays: store?.[0]?.weekdays || [], monthdays: store?.[0]?.monthdays || [] };
      const [last] = await this.manager.query(`select to_char(max(trans_date), 'YYYY-MM-DD') as d from store_cash_accounts where store_id = $1 and category = 'BANK_DEPOSIT'`, [storeid]);
      lastDeposit = last?.d ?? null;
    }

    const cashbalance = (+row?.[0]?.deposit || 0) - (+row?.[0]?.withdraw || 0);
    const status = storeid ? evaluateDeposit(rule, cashbalance, lastDeposit, new Date().toISOString().slice(0, 10)) : null;

    return {
      cashbalance,
      depositthreshold: rule.threshold,
      depositdue: !!status?.due,
      depositexcess: status?.excess ?? 0,
      depositreason: status?.reason ?? null,
      depositnext: status?.nextscheduled ?? null,
    };
  }

  private async getPendingApprovals() {
    const orders = await this.purchaseService.findAllOrders({ approvalstatus: "Pending" });
    return orders.slice(0, 5).map((order: any) => ({
      id: order.id,
      vendorname: order.vendor?.name || "",
      status: order.status,
      approvalstatus: order.approvalstatus,
      approvalreason: order.approvalreason,
      createdon: order.createdon,
    }));
  }

  async getOutstandingInvoices(stores: number[] | null) {
    let invoices = await this.purchaseInvoiceService.findOutstanding({});
    if (stores !== null) {
      const ids = invoices.map((i: any) => Number(i.id)).filter((n: number) => Number.isFinite(n));
      const mine = new Set<number>(ids.length ? (await this.manager.query(`select id from purchase_invoice where id = any($1::int[]) and store_id = any($2::int[])`, [ids, stores])).map((r: any) => +r.id) : []);
      invoices = invoices.filter((i: any) => mine.has(Number(i.id)));
    }
    return invoices
      .filter((invoice: any) => +invoice.balance_amount > 0)
      .sort((a: any, b: any) => {
        const ad = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
        const bd = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
        return bd - ad;
      });
  }

  private async getLowStockSuggestions() {
    const items = await this.purchaseService.findSuggestions({ days: 30, targetdays: 21, includezero: false });
    return items
      .filter((item: any) => +item.final_qty > 0)
      .slice(0, 5)
      .map((item: any) => ({
        product_id: item.product_id,
        title: item.title,
        vendor_name: item.vendor_name,
        available_stock: item.available_stock,
        trend_qty: item.trend_qty,
        adhoc_qty: item.adhoc_qty,
        final_qty: item.final_qty,
        reason_summary: item.reason_summary,
      }));
  }

  private async getSalesReturnsMonth(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        coalesce(count(distinct s.id), 0) as invoices,
        coalesce(sum(sri.qty), 0) as qty,
        coalesce(sum(sri.qty * si.total / nullif(si.qty, 0)), 0) as value
      from sale_return_item sri
      inner join sale_item si on si.id = sri.sale_item_id
      inner join sale s on s.id = si.sale_id
      left join store_shifts sh on sh.id = s.shift_id
      where sri.created_on >= date_trunc('month', current_date)
        and sri.active = true and sri.archive = false
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
    `, [stores]);
    return {
      invoices: +rows?.[0]?.invoices || 0,
      qty: +rows?.[0]?.qty || 0,
      value: Math.round((+rows?.[0]?.value || 0) * 100) / 100,
    };
  }

  private async getCashMovementMonth(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        coalesce(sum(case when ledger.category = 'EXPENSE' then ledger.withdraw else 0 end), 0) as expenses,
        coalesce(sum(case when ledger.category = 'BANK_DEPOSIT' then ledger.withdraw else 0 end), 0) as deposits
      from store_cash_accounts ledger
      where ledger.trans_date >= date_trunc('month', current_date)
        and ($1::int[] is null or ledger.store_id = any($1::int[]))
    `, [stores]);
    return {
      expenses: +rows?.[0]?.expenses || 0,
      deposits: +rows?.[0]?.deposits || 0,
    };
  }

  async trends(query: any, currentUser?: any) {
    const sc = await this.scope(currentUser, this.toNumber(query?.storeid));
    const stores = sc.stores;
    const [customersPerDay, topCustomers, walkin, topProductsByQty, topProductsByRevenue] = await Promise.all([
      this.getCustomersServedPerDay(stores),
      sc.owner ? this.getTopCustomers(stores) : Promise.resolve([]),        // people's names: the owner only, for now (the redesigned dashboard shows counts and shares, not names)
      this.getWalkinShare(stores),
      this.getTopProductsByQty(stores),
      this.getTopProductsByRevenue(stores),
    ]);
    return { customersPerDay, topCustomers, walkin, topProductsByQty, topProductsByRevenue };
  }

  /**
   * Distinct customers billed per day, split into New (their first completed bill with the business is
   * that day) and Returning (they had bought before). "First" looks at the whole history, not only the
   * 14-day window or the selected store, so a returning customer is never miscounted as new.
   */
  private async getCustomersServedPerDay(stores: number[] | null) {
    const rows = await this.manager.query(`
      with first_bill as (
        select customer_id, min(bill_date)::date as first_day
        from sale
        where status = 'COMPLETE' and active = true and archive = false and customer_id is not null
        group by customer_id
      )
      select
        to_char(s.bill_date::date, 'yyyy-mm-dd') as name,
        count(distinct s.customer_id) filter (where fb.first_day = s.bill_date::date)::int as new_customers,
        count(distinct s.customer_id) filter (where fb.first_day < s.bill_date::date)::int as returning_customers
      from sale s
      inner join first_bill fb on fb.customer_id = s.customer_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= current_date - interval '13 days'
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
      group by 1
      order by 1
    `, [stores]);
    return rows.map((r: any) => ({
      name: String(r.name).slice(5),
      series: [
        { name: 'New', value: +r.new_customers || 0 },
        { name: 'Returning', value: +r.returning_customers || 0 },
      ],
    }));
  }

  private async getTopCustomers(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        coalesce(c.name, 'Walk-in') as name,
        coalesce(sum(s.total), 0) as value
      from sale s
      left join customer c on c.id = s.customer_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
        and coalesce(c.mobile, '') <> '${NO_MOBILE_PLACEHOLDER}'
      group by s.customer_id, c.name
      order by value desc
      limit 8
    `, [stores]);
    return rows.map((r: any) => ({ name: r.name, value: +r.value || 0 }));
  }

  /** Bills sold to the "NIL" placeholder customer (no mobile given) this month, against all bills. */
  private async getWalkinShare(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        count(*) filter (where c.mobile = '${NO_MOBILE_PLACEHOLDER}') as walkin_bills,
        count(*) as bills,
        coalesce(sum(s.total) filter (where c.mobile = '${NO_MOBILE_PLACEHOLDER}'), 0) as walkin_value,
        coalesce(sum(s.total), 0) as value
      from sale s
      left join customer c on c.id = s.customer_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
    `, [stores]);
    const r = rows?.[0] || {};
    const bills = +r.bills || 0, value = +r.value || 0;
    const wb = +r.walkin_bills || 0, wv = +r.walkin_value || 0;
    return {
      bills: wb, totalbills: bills, billspct: bills ? Math.round((1000 * wb) / bills) / 10 : 0,
      value: Math.round(wv), totalvalue: Math.round(value), valuepct: value ? Math.round((1000 * wv) / value) / 10 : 0,
    };
  }

  private async getTopProductsByQty(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        p.title as name,
        coalesce(sum(si.qty), 0) as value
      from sale_item si
      inner join product p on p.id = si.product_id
      inner join sale s on s.id = si.sale_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
      group by p.id, p.title
      order by value desc
      limit 8
    `, [stores]);
    return rows.map((r: any) => ({ name: r.name, value: +r.value || 0 }));
  }

  private async getTopProductsByRevenue(stores: number[] | null) {
    const rows = await this.manager.query(`
      select
        p.title as name,
        coalesce(sum(si.total), 0) as value
      from sale_item si
      inner join product p on p.id = si.product_id
      inner join sale s on s.id = si.sale_id
      left join store_shifts sh on sh.id = s.shift_id
      where s.status = 'COMPLETE'
        and s.active = true and s.archive = false
        and s.bill_date >= date_trunc('month', current_date)
        and ($1::int[] is null or coalesce(s.store_id, sh.store_id) = any($1::int[]))
      group by p.id, p.title
      order by value desc
      limit 8
    `, [stores]);
    return rows.map((r: any) => ({ name: r.name, value: +r.value || 0 }));
  }

  async adminSummary(roleid?: number, userId?: number) {
    // Cross-business rollup - only roles that legitimately see across stores.
    const allowed = ['Site Admin', ...OWNER_ROLES];
    const roleRow = await this.manager.query(`SELECT name FROM app_role WHERE id = $1`, [roleid || 0]);
    if (!allowed.includes(roleRow?.[0]?.name)) {
      throw new ForbiddenException('Not authorized to view the admin summary.');
    }
    // a business's owner sees their own business; only a platform user sees them all
    const own = roleRow?.[0]?.name === 'Site Admin' ? null : (await businessOfUser(this.manager, Number(userId) || 0)) ?? -1;
    const [bizRows, storeRows, userRows, roleRows, byRole, byBiz] = await Promise.all([
      this.manager.query(`SELECT count(*)::int AS count FROM business WHERE active = true AND archive = false AND ($1::int IS NULL OR id = $1::int)`, [own]),
      this.manager.query(`SELECT count(*)::int AS count FROM stores WHERE active = true AND archive = false AND ($1::int IS NULL OR business_id = $1::int)`, [own]),
      this.manager.query(`SELECT count(*)::int AS count FROM app_user WHERE active = true AND archive = false AND ($1::int IS NULL OR business_id = $1::int)`, [own]),
      this.manager.query(`SELECT count(*)::int AS count FROM app_role WHERE active = true AND archive = false AND locked = false`),
      this.manager.query(`
        SELECT r.name, count(u.id)::int AS value
        FROM app_role r
        LEFT JOIN app_user u ON u.role_id = r.id AND u.active = true AND u.archive = false AND ($1::int IS NULL OR u.business_id = $1::int)
        WHERE r.active = true AND r.archive = false AND r.locked = false
        GROUP BY r.id, r.name
        ORDER BY value DESC
      `, [own]),
      this.manager.query(`
        SELECT b.name, count(s.id)::int AS value
        FROM business b
        LEFT JOIN stores s ON s.business_id = b.id AND s.active = true AND s.archive = false
        WHERE b.active = true AND b.archive = false AND ($1::int IS NULL OR b.id = $1::int)
        GROUP BY b.id, b.name
        ORDER BY value DESC
      `, [own]),
    ]);
    return {
      businesses: +bizRows?.[0]?.count || 0,
      stores: +storeRows?.[0]?.count || 0,
      users: +userRows?.[0]?.count || 0,
      roles: +roleRows?.[0]?.count || 0,
      usersByRole: byRole.map((r: any) => ({ name: r.name, value: +r.value || 0 })),
      storesByBusiness: byBiz.map((b: any) => ({ name: b.name, value: +b.value || 0 })),
    };
  }

  private toNumber(value: any) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
