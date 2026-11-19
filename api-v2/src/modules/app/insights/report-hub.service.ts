import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { permsOf } from 'src/core/role-rules';
import { loadTurnaround } from '../customers/customer-turnaround.service';
import { DEFAULT_WINDOWS, TWindows, summarise } from '../customers/customer-turnaround-rules';
import { InsightsData, SALE_OK, StoreScope, UNIT_COST } from './insights-data.service';
import { PERIOD_LABELS, PERIODS, addDays, periodRange } from './insights-rules';
import { REPORT_KEYS } from './insights-data.service';
import { canOpenReport } from './report-access';
import { Figure, TILE_NEEDS, mayOpenTile, previousRange, withPrevious } from './report-hub';

interface Ctx { m: EntityManager; role: string; perms: any[]; stores: StoreScope; from: string; to: string; userId: number; manager: boolean; windows: TWindows }
interface Tile { /** whether the figures are for the period (and so are compared with the period before); the others are as of now */ periodic: boolean; run: (c: Ctx) => Promise<Figure[]> }

const n = (v: any) => (v === null || v === undefined ? 0 : Number(v));
const SCOPE = (col: string) => `($1::int[] is null or ${col} = any($1::int[]))`;

const TILES: Record<string, Tile> = {
  'rh-ask': { periodic: false, run: async (c) => [{ key: 'ready', label: 'Ready reports open to you', kind: 'number', value: REPORT_KEYS.filter((k) => canOpenReport(c.role, c.perms, k)).length }] },
  'rh-weekly': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(`select to_char(week_start, 'DD Mon') as start, to_char(week_end, 'DD Mon') as finish from weekly_summary order by week_start desc limit 1`);
    return [{ key: 'latest', label: 'Latest summary', kind: 'text', value: r ? `${r.start} to ${r.finish}` : null }];
  } },
  'rh-stock': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(
      `select count(distinct v.id)::int as products, coalesce(sum(v.balance * coalesce(${UNIT_COST}, 0)), 0)::float8 as value
         from product_items_view v join purchase_invoice_item pii on pii.id = v.item_id join purchase_invoice pi on pi.id = pii.invoice_id join product p on p.id = v.id
        where v.balance > 0 and (v.exp_date is null or public.expiry_end(v.exp_date) >= current_date) and pi.active and not pi.archive and ${SCOPE('pi.store_id')}`, [c.stores]);
    return [{ key: 'products', label: 'Products in stock', kind: 'number', value: n(r.products) }, { key: 'value', label: 'Stock at cost', kind: 'money', value: Math.round(n(r.value)) }];
  } },
  'rh-audits': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*) filter (where a.status = 'DONE' and a.completed_on >= $2::date and a.completed_on < $3::date)::int as done,
              coalesce(sum(a.variance_value) filter (where a.status = 'DONE' and a.completed_on >= $2::date and a.completed_on < $3::date), 0)::float8 as variance,
              count(*) filter (where a.status not in ('DONE', 'SKIPPED'))::int as open
         from stock_audit a where ${SCOPE('a.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'done', label: 'Audits done', kind: 'number', value: n(r.done), trend: true }, { key: 'variance', label: 'Net variance', kind: 'money', value: Math.round(n(r.variance)) }, { key: 'open', label: 'Open now', kind: 'number', value: n(r.open) }];
  } },
  'rh-drug-register': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*)::int as entries, count(*) filter (where r.schedule = 'H1')::int as h1 from schedule_register r
        where r.superseded_on is null and r.entry_on >= $2::date and r.entry_on < $3::date and ${SCOPE('r.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'entries', label: 'Register entries', kind: 'number', value: n(r.entries), trend: true }, { key: 'h1', label: 'Schedule H1', kind: 'number', value: n(r.h1), trend: true }];
  } },
  'rh-payables': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*)::int as unpaid, coalesce(sum(pi.total), 0)::float8 as value, count(*) filter (where pi.due_date < current_date)::int as overdue
         from purchase_invoice pi where pi.active and not pi.archive and pi.status = 'COMPLETE' and pi.payment_status <> 'Paid' and ${SCOPE('pi.store_id')}`, [c.stores]);
    return [{ key: 'value', label: 'Unpaid invoices', kind: 'money', value: Math.round(n(r.value)) }, { key: 'unpaid', label: 'Count', kind: 'number', value: n(r.unpaid) }, { key: 'overdue', label: 'Past due date', kind: 'number', value: n(r.overdue) }];
  } },
  'rh-vendor-returns': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select count(*)::int as returns, coalesce(sum(v.total), 0)::float8 as value from vendor_return v where v.active and not v.archive and v.return_date >= $2::date and v.return_date < $3::date and ${SCOPE('v.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'returns', label: 'Returns made', kind: 'number', value: n(r.returns), trend: true }, { key: 'value', label: 'Value', kind: 'money', value: Math.round(n(r.value)), trend: true }];
  } },
  'rh-gst-recon': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(`select count(*)::int as open from gst_reconciliation g where g.active and not g.archive and g.resolved_at is null`);
    return [{ key: 'open', label: 'To resolve', kind: 'number', value: n(r.open) }];
  } },
  // money in and out: sales, what was bought, and what was spent
  'rh-financials': { periodic: true, run: async (c) => {
    const [s] = await c.m.query(`select coalesce(sum(s.total), 0)::float8 as sales from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ${SCOPE('s.store_id')}`, [c.stores, c.from, c.to]);
    const [p] = await c.m.query(`select coalesce(sum(pi.total), 0)::float8 as bought from purchase_invoice pi where pi.active and not pi.archive and pi.invoice_date >= $2::date and pi.invoice_date < $3::date and ${SCOPE('pi.store_id')}`, [c.stores, c.from, c.to]);
    const [e] = await c.m.query(`select coalesce(sum(withdraw), 0)::float8 as spent from store_cash_accounts where category = 'EXPENSE' and trans_date >= $2::date and trans_date < $3::date and ${SCOPE('store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'sales', label: 'Sales', kind: 'money', value: n(s.sales), trend: true }, { key: 'bought', label: 'Bought', kind: 'money', value: n(p.bought), trend: true }, { key: 'spent', label: 'Spent', kind: 'money', value: n(e.spent), trend: true }];
  } },
  'rh-finance': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(`select count(*) filter (where status = 'UNRECONCILED')::int as open, count(*) filter (where status = 'UNEXPLAINED')::int as unexplained from bank_txn`);
    return [{ key: 'open', label: 'Bank lines to check', kind: 'number', value: n(r.open) }, { key: 'unexplained', label: 'Unexplained', kind: 'number', value: n(r.unexplained) }];
  } },
  // the tax in the bills of the period: what was charged on top of the price
  'rh-gst': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(
      `select coalesce(sum(si.total / (1 + coalesce(si.tax_pcnt, 0) / 100.0)), 0)::float8 as taxable, coalesce(sum(si.total - si.total / (1 + coalesce(si.tax_pcnt, 0) / 100.0)), 0)::float8 as tax
         from sale_item si join sale s on s.id = si.sale_id where ${SALE_OK} and si.active and not si.archive and s.bill_date >= $2::date and s.bill_date < $3::date and ${SCOPE('s.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'tax', label: 'GST on sales', kind: 'money', value: Math.round(n(r.tax)), trend: true }, { key: 'taxable', label: 'Sales before GST', kind: 'money', value: Math.round(n(r.taxable)), trend: true }];
  } },
  'rh-discrepancies': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*) filter (where abs(coalesce(h.variance, 0)) >= 1)::int as off, coalesce(sum(abs(h.variance)) filter (where abs(coalesce(h.variance, 0)) >= 1), 0)::float8 as amount
         from store_shifts h where h.status = 'CLOSED' and h.shift_date >= $2::date and h.shift_date < $3::date and ${SCOPE('h.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'off', label: 'Shifts that did not tally', kind: 'number', value: n(r.off), trend: true }, { key: 'amount', label: 'Out by', kind: 'money', value: Math.round(n(r.amount)), trend: true }];
  } },
  'rh-review': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(`select to_char(max(week_start), 'DD Mon YYYY') as last from weekly_review w where ${SCOPE('w.store_id')} or w.store_id is null`, [c.stores]);
    return [{ key: 'last', label: 'Last week reviewed', kind: 'text', value: r?.last || null }];
  } },
  'rh-compliance': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*)::int as open, count(*) filter (where i.due_on < current_date)::int as late from compliance_instance i where i.state = 'OPEN' and (${SCOPE('i.store_id')} or i.store_id is null)`, [c.stores]);
    return [{ key: 'open', label: 'Open items', kind: 'number', value: n(r.open) }, { key: 'late', label: 'Late', kind: 'number', value: n(r.late) }];
  } },
  'rh-audit': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select count(*)::int as events from audit_event a where a.occurred_on >= $1::date and a.occurred_on < $2::date`, [c.from, c.to]);
    return [{ key: 'events', label: 'Changes logged', kind: 'number', value: n(r.events), trend: true }];
  } },
  'rh-audiences': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select count(*) filter (where cu.created_on >= $1::date and cu.created_on < $2::date)::int as added, count(*)::int as active from customer cu where cu.active and not cu.archive`, [c.from, c.to]);
    return [{ key: 'added', label: 'New customers', kind: 'number', value: n(r.added), trend: true }, { key: 'active', label: 'Active customers', kind: 'number', value: n(r.active) }];
  } },
  'rh-sale-list': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select count(*)::int as bills, coalesce(sum(s.total), 0)::float8 as sales from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ${SCOPE('s.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'sales', label: 'Sales', kind: 'money', value: n(r.sales), trend: true }, { key: 'bills', label: 'Bills', kind: 'number', value: n(r.bills), trend: true }];
  } },
  'rh-returns': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*)::int as lines, coalesce(sum(r.refund_amount), 0)::float8 as amount from sale_return_item r join sale_item si on si.id = r.sale_item_id join sale s on s.id = si.sale_id
        where r.active and not r.archive and r.created_on >= $2::date and r.created_on < $3::date and ${SCOPE('s.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'lines', label: 'Items returned', kind: 'number', value: n(r.lines), trend: true }, { key: 'amount', label: 'Refunded', kind: 'money', value: n(r.amount), trend: true }];
  } },
  'rh-staff-sales': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(
      `select coalesce(nullif(btrim(u.full_name), ''), 'Unknown') as name, coalesce(sum(s.total), 0)::float8 as sales from sale s left join app_user u on u.id = coalesce(s.acting_user_id, s.created_by)
        where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ${SCOPE('s.store_id')} group by 1 order by sales desc limit 1`, [c.stores, c.from, c.to]);
    return r ? [{ key: 'top', label: 'Top seller', kind: 'text', value: r.name }, { key: 'sales', label: 'Their sales', kind: 'money', value: n(r.sales) }] : [{ key: 'top', label: 'Top seller', kind: 'text', value: null }];
  } },
  'rh-digital': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select count(*) filter (where s.digi_amount > 0)::int as bills, coalesce(sum(s.digi_amount), 0)::float8 as amount from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ${SCOPE('s.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'amount', label: 'UPI / card', kind: 'money', value: n(r.amount), trend: true }, { key: 'bills', label: 'Bills', kind: 'number', value: n(r.bills), trend: true }];
  } },
  'rh-cashbook': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select coalesce(sum(s.cash_amount), 0)::float8 as cash from sale s where ${SALE_OK} and s.bill_date >= $2::date and s.bill_date < $3::date and ${SCOPE('s.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'cash', label: 'Cash sales', kind: 'money', value: n(r.cash), trend: true }];
  } },
  'rh-expenses': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select count(*)::int as entries, coalesce(sum(withdraw), 0)::float8 as amount from store_cash_accounts where category = 'EXPENSE' and trans_date >= $2::date and trans_date < $3::date and ${SCOPE('store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'amount', label: 'Spent', kind: 'money', value: n(r.amount), trend: true }, { key: 'entries', label: 'Entries', kind: 'number', value: n(r.entries), trend: true }];
  } },
  'rh-invoices': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(`select count(*)::int as invoices, coalesce(sum(pi.total), 0)::float8 as amount from purchase_invoice pi where pi.active and not pi.archive and pi.invoice_date >= $2::date and pi.invoice_date < $3::date and ${SCOPE('pi.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'amount', label: 'Bought', kind: 'money', value: n(r.amount), trend: true }, { key: 'invoices', label: 'Invoices', kind: 'number', value: n(r.invoices), trend: true }];
  } },
  'rh-complaints': { periodic: true, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*) filter (where g.created_on >= $2::date and g.created_on < $3::date)::int as raised, count(*) filter (where g.status = 'OPEN')::int as open from grievance g where ${SCOPE('g.store_id')}`, [c.stores, c.from, c.to]);
    return [{ key: 'raised', label: 'Raised', kind: 'number', value: n(r.raised), trend: true }, { key: 'open', label: 'Open now', kind: 'number', value: n(r.open) }];
  } },
  'rh-dues': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(`select count(*)::int as customers, coalesce(sum(b), 0)::float8 as owed from (select sum(e.amount) as b from customer_due_entry e group by e.customer_id having sum(e.amount) > 0.5) x`);
    return [{ key: 'owed', label: 'Owed now', kind: 'money', value: n(r.owed) }, { key: 'customers', label: 'Customers', kind: 'number', value: n(r.customers) }];
  } },
  'rh-expiry': { periodic: false, run: async (c) => {
    const [r] = await c.m.query(
      `select count(*)::int as batches, coalesce(sum(v.balance * coalesce(${UNIT_COST}, 0)), 0)::float8 as value
         from product_items_view v join purchase_invoice_item pii on pii.id = v.item_id join purchase_invoice pi on pi.id = pii.invoice_id join product p on p.id = v.id
        where v.balance > 0 and v.exp_date is not null and public.expiry_end(v.exp_date) >= current_date and public.expiry_end(v.exp_date) <= current_date + 90
          and pi.active and not pi.archive and ${SCOPE('pi.store_id')}`, [c.stores]);
    return [{ key: 'batches', label: 'Batches expiring in 90 days', kind: 'number', value: n(r.batches) }, { key: 'value', label: 'At cost', kind: 'money', value: Math.round(n(r.value)) }];
  } },
  // the contacts made in the period and how many customers bought again; a person sees their own, a manager everyone's
  'rh-refills': { periodic: true, run: (c) => contactFigures(c, c.manager ? null : c.userId) },
  'rh-followups': { periodic: true, run: (c) => contactFigures(c, c.userId) },
};

async function contactFigures(c: Ctx, only: number | null): Promise<Figure[]> {
  const { results } = await loadTurnaround(c.m, c.from, addDays(c.to, -1), only, c.windows);
  const s = summarise(results);
  return [
    { key: 'contacts', label: 'Contacted', kind: 'number', value: s.contacts, trend: true },
    { key: 'back', label: 'Bought again', kind: 'number', value: s.cameBack, trend: true },
    { key: 'rate', label: 'Came back of those decided', kind: 'percent', value: s.ratePct },
  ];
}

/**
 * The figures on the Reports hub cards, for a period: what a person may open, nothing else, within their own stores. Read only. The earlier period of the
 * same length comes with the figures that are for a period, so a card can say up or down.
 */
@Injectable()
export class ReportHubService {
  private readonly log = new Logger(ReportHubService.name);
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly data: InsightsData) {}

  private async windows(): Promise<TWindows> {
    const get = async (key: string, fallback: number, max: number) => {
      const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive limit 1`, [key]);
      const v = Math.round(Number(r?.setting_value));
      return Number.isFinite(v) && v >= 1 && v <= max ? v : fallback;
    };
    return { refillDays: await get('turnaround_refill_days', DEFAULT_WINDOWS.refillDays, 60), lapsedDays: await get('turnaround_lapsed_days', DEFAULT_WINDOWS.lapsedDays, 90) };
  }

  async summary(user: any, periodKey?: string) {
    const [r] = await this.manager.query(`select name, permissions from app_role where id = $1`, [user?.roleid || 0]);
    const role = r?.name || '';
    const perms = permsOf(r);
    const owner = isOwnerRole(role);
    const stores: StoreScope = owner ? null : (await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id])).map((x: any) => x.store_id);
    const today = await this.data.today();
    const key = (PERIODS as readonly string[]).includes(String(periodKey)) ? String(periodKey) : 'this_month';
    const p = periodRange(key, today)!;
    const prev = previousRange(p.from, p.to);
    const base = { m: this.manager, role, perms, stores, userId: user.id, manager: isManagerRole(role), windows: await this.windows() };

    const tiles: Record<string, { figures: Figure[]; asOfNow: boolean }> = {};
    for (const id of Object.keys(TILE_NEEDS)) {
      if (!mayOpenTile(owner, perms, id)) continue;
      const tile = TILES[id];
      if (!tile) continue;
      try {
        const now = await tile.run({ ...base, from: p.from, to: p.to });
        const figures = tile.periodic ? withPrevious(now, await tile.run({ ...base, from: prev.from, to: prev.to })) : now;
        tiles[id] = { figures, asOfNow: !tile.periodic };
      } catch (e: any) {
        this.log.warn(`hub figures for ${id}: ${e?.message}`);       // one card's figures failing leaves the card as a plain link
      }
    }
    return {
      period: { key, label: p.label, from: p.from, to: addDays(p.to, -1) },
      compared: { from: prev.from, to: addDays(prev.to, -1) },
      periods: PERIODS.map((k) => ({ key: k, label: PERIOD_LABELS[k] })),
      tiles,
    };
  }
}
