import { EntityManager } from 'typeorm';
import { StoreService } from '../store/store.service';
import { PricingReader } from '../products/pricing-reader';
import { BATCH_BALANCE_SQL } from './stock-audit-alerts';
import { lastFullWeek, reviewLate } from '../review/review-rules';

export type Severity = 'info' | 'warning' | 'critical';
export const SEVERITIES: Severity[] = ['info', 'warning', 'critical'];

export interface ParamDef { key: string; label: string; min: number; max: number; default: number; unit: string; }

/** one thing found: the same key on the next run means the same cause, so the notification is kept, not repeated */
export interface Finding {
  key: string;
  storeid: number | null;
  code: string;
  params: Record<string, any>;
  link: string;
  severity?: Severity;
}

export interface Ctx {
  manager: EntityManager;
  stores: StoreService;
  businessId: number;
  today: string;
}

export interface AlertKind {
  kind: string;
  label: string;
  description: string;
  params: ParamDef[];
  defaultSeverity: Severity;
  evaluate(ctx: Ctx, params: Record<string, number>): Promise<Finding[]>;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

export const KINDS: AlertKind[] = [
  {
    kind: 'deposit_due',
    label: 'Bank deposit due',
    description: "A store's cash is due at the bank by its deposit rule (the amount, or the daily / weekly / monthly schedule, whichever comes first). Set the rule under Settings > Store > Cash & shifts.",
    params: [],
    defaultSeverity: 'warning',
    async evaluate(ctx) {
      const rows = await ctx.stores.depositStatusesForBusiness(ctx.businessId);
      return rows.filter((r: any) => r.due).map((r: any) => ({
        key: `deposit:${r.storeid}`,
        storeid: r.storeid,
        code: r.reason === 'amount' ? 'deposit_due_amount' : 'deposit_due_schedule',
        params: { store: r.location, balance: r.balance, excess: r.excess, since: r.since },
        link: '/secure/store/cash',
      }));
    },
  },
  {
    kind: 'licence_expiring',
    label: 'Store licence ending',
    description: "A store's licence (drug licence, FSSAI and so on) ends soon or has ended. The newest row of each licence type counts.",
    params: [{ key: 'days', label: 'Warn this many days before', min: 1, max: 365, default: 30, unit: 'days' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select s.id as store_id, s.location, l.license_type, l.number, max(l.valid_to)::text as valid_to
           from store_license l join stores s on s.id = l.store_id
          where s.business_id = $1 and s.active and not s.archive and l.valid_to is not null
            and not exists (select 1 from store_license l2 where l2.store_id = l.store_id and l2.license_type = l.license_type and (l2.valid_to is null or l2.valid_to > l.valid_to))
          group by s.id, s.location, l.license_type, l.number`, [ctx.businessId]);
      const horizon = addDays(ctx.today, p.days);
      return rows.filter((r: any) => r.valid_to <= horizon).map((r: any) => {
        const left = daysBetween(ctx.today, r.valid_to);
        return {
          key: `licence:${r.store_id}:${r.license_type}`,
          storeid: r.store_id,
          code: left < 0 ? 'licence_expired' : 'licence_expiring',
          severity: left < 0 ? 'critical' as Severity : undefined,
          params: { store: String(r.location).trim(), type: r.license_type, number: r.number, date: r.valid_to, days: Math.abs(left) },
          link: '/secure/settings/store',
        };
      });
    },
  },
  {
    kind: 'registration_expiring',
    label: 'Pharmacist registration ending',
    description: "A pharmacist's registration (on the staff record, under Settings > Users) ends soon or has ended. Only people at a pharmacy store are watched.",
    params: [{ key: 'days', label: 'Warn this many days before', min: 1, max: 365, default: 30, unit: 'days' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select e.id, u.full_name, e.pharmacist_valid_to::text as valid_to,
                (select us.store_id from user_stores us join stores s on s.id = us.store_id
                  where us.user_id = u.id and us.active and not us.archive and s.active and not s.archive
                  order by us.is_primary desc, us.id limit 1) as store_id
           from hr_employee e join app_user u on u.id = e.user_id
          where u.active and not u.archive and e.pharmacist_reg_no is not null and e.pharmacist_valid_to is not null
            and coalesce(u.business_id, (select s.business_id from user_stores us join stores s on s.id = us.store_id
                 where us.user_id = u.id and us.active and not us.archive order by us.is_primary desc, us.id limit 1)) = $1
            and exists (select 1 from stores s join user_stores us on us.store_id = s.id
                         where us.user_id = u.id and us.active and not us.archive and s.active and not s.archive and s.store_type = 'pharmacy')`, [ctx.businessId]);
      const horizon = addDays(ctx.today, p.days);
      return rows.filter((r: any) => r.valid_to <= horizon).map((r: any) => {
        const left = daysBetween(ctx.today, r.valid_to);
        return {
          key: `registration:${r.id}`,
          storeid: r.store_id ?? null,
          code: left < 0 ? 'registration_expired' : 'registration_expiring',
          severity: left < 0 ? 'critical' as Severity : undefined,
          params: { person: r.full_name, date: r.valid_to, days: Math.abs(left) },
          link: '/secure/settings/users',
        };
      });
    },
  },
  {
    kind: 'shift_open_long',
    label: 'Shift left open',
    description: 'A shift has been open longer than a working day, so its cash has not been counted.',
    params: [{ key: 'hours', label: 'Warn after this many hours open', min: 1, max: 72, default: 14, unit: 'hours' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select sh.id, sh.store_id, sh.name, s.location,
                floor(extract(epoch from (now() - coalesce(sh.opened_on::timestamptz, sh.created_on))) / 3600)::int as hours
           from store_shifts sh join stores s on s.id = sh.store_id
          where s.business_id = $1 and sh.status = 'OPEN' and not sh.archive
            and coalesce(sh.opened_on::timestamptz, sh.created_on) < now() - make_interval(hours => $2::int)`, [ctx.businessId, p.hours]);
      return rows.map((r: any) => ({
        key: `shift:${r.id}`,
        storeid: r.store_id,
        code: 'shift_open_long',
        params: { store: String(r.location).trim(), name: r.name, hours: r.hours },
        link: '/secure/store/shifts',
      }));
    },
  },
  {
    kind: 'approvals_pending',
    label: 'Stock adjustments waiting',
    description: 'Stock adjustments are waiting for approval for longer than the limit. One alert per store, however many are waiting.',
    params: [{ key: 'hours', label: 'Warn after waiting this many hours', min: 1, max: 720, default: 24, unit: 'hours' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select pq.store_id, s.location, count(*)::int as n,
                floor(extract(epoch from (now() - min(pq.created_on))) / 3600)::int as hours
           from product_qtychange pq join stores s on s.id = pq.store_id
          where s.business_id = $1 and pq.status = 'PENDING' and pq.active and not pq.archive
            and pq.created_on < now() - make_interval(hours => $2::int)
          group by pq.store_id, s.location`, [ctx.businessId, p.hours]);
      return rows.map((r: any) => ({
        key: `adjustments:${r.store_id}`,
        storeid: r.store_id,
        code: r.n === 1 ? 'approvals_pending_one' : 'approvals_pending',
        params: { store: String(r.location).trim(), count: r.n, hours: r.hours },
        link: '/secure/store/stock/adjust',
      }));
    },
  },
  {
    kind: 'price_policy',
    label: 'Prices out of policy',
    description: 'Products priced so that a bill would charge more than the MRP, or below the class floor markup or deeper than the class discount cap, products with stock and no price, and products whose pack or cost looks wrong. Fix them in Products > Pricing policy.',
    params: [{ key: 'min', label: 'Raise it when at least this many products', min: 1, max: 1000, default: 1, unit: 'products' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      // the read side of the pricing policy needs only the database
      const c = await new PricingReader(ctx.manager).counts();
      const out: Finding[] = [];
      if (c.cuts >= p.min) out.push({ key: 'pricing:cuts', storeid: null, code: 'pricing_cuts', severity: 'critical', params: { count: c.cuts }, link: '/secure/products/pricing-policy' });
      if (c.raises >= p.min) out.push({ key: 'pricing:raises', storeid: null, code: 'pricing_raises', params: { count: c.raises, held: c.held }, link: '/secure/products/pricing-policy' });
      if (c.unpriced >= p.min) out.push({ key: 'pricing:unpriced', storeid: null, code: 'pricing_unpriced', params: { count: c.unpriced }, link: '/secure/products/pricing-policy' });
      if (c.check >= p.min) out.push({ key: 'pricing:check', storeid: null, code: 'pricing_check', severity: 'info', params: { count: c.check }, link: '/secure/products/pack-check' });
      return out;
    },
  },
  {
    kind: 'outage_kit',
    label: 'Outage kit not checked',
    description: "A store that has traded in the last 60 days has not ticked off its outage kit (UPS, price list, bill book, light) as ready for this many days. The Outage kit page has the weekly checklist.",
    params: [{ key: 'days', label: 'Warn when it has not been checked for', min: 1, max: 60, default: 7, unit: 'days' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select s.id as store_id, s.location,
                (select to_char(max(l.checked_on at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') from outage_readiness_log l where l.store_id = s.id and l.complete) as last
           from stores s where s.business_id = $1 and s.active and not s.archive
            and exists (select 1 from sale x where x.store_id = s.id and x.created_on >= current_date - 60)`, [ctx.businessId]);
      const out: Finding[] = [];
      for (const r of rows) {
        const days = r.last ? daysBetween(r.last, ctx.today) : null;
        if (days !== null && days < p.days) continue;
        out.push({
          key: `outage:${r.store_id}`, storeid: r.store_id, code: days === null ? 'outage_kit_never' : 'outage_kit_overdue',
          params: { store: String(r.location).trim(), days: days ?? 0, date: r.last ?? '' }, link: '/secure/outage',
        });
      }
      return out;
    },
  },
  {
    kind: 'stock_count_overdue',
    label: 'Stock count overdue',
    description: "A store that has traded in the last 60 days has not completed a stock count for this many days. Weekly category counts keep the book stock honest; start one under Store > Stock.",
    params: [{ key: 'days', label: 'Warn when no count has been completed for', min: 1, max: 90, default: 10, unit: 'days' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select s.id as store_id, s.location,
                (select to_char(max(c.completed_on at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') from stock_count c where c.store_id = s.id and c.status = 'COMPLETED') as last
           from stores s where s.business_id = $1 and s.active and not s.archive
            and exists (select 1 from sale x where x.store_id = s.id and x.created_on >= current_date - 60)`, [ctx.businessId]);
      const out: Finding[] = [];
      for (const r of rows) {
        const days = r.last ? daysBetween(r.last, ctx.today) : null;
        if (days !== null && days < p.days) continue;
        out.push({
          key: `count:${r.store_id}`, storeid: r.store_id, code: days === null ? 'stock_count_never' : 'stock_count_overdue',
          params: { store: String(r.location).trim(), days: days ?? 0, date: r.last ?? '' }, link: '/secure/stock-audits',
        });
      }
      return out;
    },
  },
  {
    kind: 'negative_stock',
    label: 'Negative stock',
    description: 'Products whose book stock is below zero: more was sold or written off than was bought. It means a purchase was not entered or a count is overdue.',
    params: [{ key: 'min', label: 'Warn when this many products are negative', min: 1, max: 1000, default: 5, unit: 'products' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const [r] = await ctx.manager.query(
        `select count(*)::int as n, coalesce(sum(-net), 0)::float as units from (
           select product_id, sum(bal) as net from (${BATCH_BALANCE_SQL}) b
            group by 1 having sum(bal) < 0) x`, []);
      return r.n >= p.min ? [{ key: 'negative_stock', storeid: null, code: 'negative_stock', params: { count: r.n, units: Math.round(r.units) }, link: '/secure/stock-audits' }] : [];
    },
  },
  {
    kind: 'expired_stock',
    label: 'Expired stock on the shelf',
    description: 'Batches past their expiry date that still show as stock, valued at cost. Pull them, return them to the vendor or write them off.',
    params: [{ key: 'value', label: 'Warn when expired stock at cost is above', min: 0, max: 10000000, default: 1000, unit: 'rupees' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const [r] = await ctx.manager.query(
        `select count(*)::int as batches, coalesce(sum(bal * unit_cost), 0)::float as value
           from (${BATCH_BALANCE_SQL}) b where bal > 0 and exp_date < current_date`, []);
      return r.value > p.value ? [{ key: 'expired_stock', storeid: null, code: 'expired_stock', params: { batches: r.batches, value: Math.round(r.value) }, link: '/secure/store/stock' }] : [];
    },
  },
  {
    kind: 'adjustment_other',
    label: 'Unexplained write-offs',
    description: 'Stock adjustments in the last 30 days given the reason "Other" (or none), valued at cost. Each should carry a proper reason: damaged, expired, missing or returned.',
    params: [{ key: 'value', label: 'Warn when they add up to more than', min: 0, max: 10000000, default: 2000, unit: 'rupees' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const [r] = await ctx.manager.query(
        `select count(*)::int as n, coalesce(sum(abs(q.qty) * (pii.ptr_cost / nullif(pr.pack, 0))), 0)::float as value
           from product_qtychange q
           join purchase_invoice_item pii on pii.id = q.item_id
           join product pr on pr.id = pii.product_id
          where q.active and not q.archive and coalesce(q.status, 'APPROVED') = 'APPROVED' and q.count_id is null
            and coalesce(nullif(q.reason_code, ''), 'Other') = 'Other' and q.created_on >= current_date - 30`, []);
      return r.value > p.value ? [{ key: 'adjustment_other', storeid: null, code: 'adjustment_other', params: { count: r.n, value: Math.round(r.value) }, link: '/secure/store/stock' }] : [];
    },
  },
  {
    kind: 'weekly_review',
    label: 'Weekly review not signed',
    description: "A store that has traded in the last 60 days has not signed the weekly exceptions review (discounts, cancelled bills, returns) for the week just ended, this many days after the week closed.",
    params: [{ key: 'days', label: 'Warn when it is still unsigned this many days after the week ends', min: 0, max: 14, default: 3, unit: 'days' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const week = lastFullWeek(ctx.today);
      if (!reviewLate(week, ctx.today, p.days)) return [];
      const rows = await ctx.manager.query(
        `select s.id as store_id, s.location from stores s
          where s.business_id = $1 and s.active and not s.archive
            and exists (select 1 from sale x where x.store_id = s.id and x.created_on >= current_date - 60)
            and not exists (select 1 from weekly_review w where w.store_id = s.id and w.week_start = $2::date)`, [ctx.businessId, week]);
      return rows.map((r: any) => ({
        key: `review:${r.store_id}:${week}`, storeid: r.store_id, code: 'weekly_review_unsigned',
        params: { store: String(r.location).trim(), date: week }, link: '/secure/review',
      }));
    },
  },
];

export const kindOf = (kind: string): AlertKind | undefined => KINDS.find((k) => k.kind === kind);

/** the numbers of a rule as the kind defines them: only its own keys, each a whole number within its limits, defaults for the rest */
export function cleanParams(kind: AlertKind, input: Record<string, any> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of kind.params) {
    const raw = input?.[d.key];
    const n = raw === undefined || raw === null || raw === '' ? d.default : Number(raw);
    if (!Number.isInteger(n) || n < d.min || n > d.max) throw new Error(`${d.label} must be a whole number from ${d.min} to ${d.max}.`);
    out[d.key] = n;
  }
  return out;
}

/** the alerts a business starts with: each is a rule that can be edited or switched off, not deleted */
export const DEFAULT_RULES: { kind: string; name: string; severity: Severity }[] = [
  { kind: 'deposit_due', name: 'Bank deposit due', severity: 'warning' },
  { kind: 'licence_expiring', name: 'Store licence ending', severity: 'warning' },
  { kind: 'registration_expiring', name: 'Pharmacist registration ending', severity: 'warning' },
  { kind: 'shift_open_long', name: 'Shift left open', severity: 'warning' },
  { kind: 'approvals_pending', name: 'Stock adjustments waiting', severity: 'warning' },
  { kind: 'price_policy', name: 'Prices out of policy', severity: 'warning' },
  { kind: 'outage_kit', name: 'Outage kit not checked', severity: 'warning' },
  { kind: 'stock_count_overdue', name: 'Stock count overdue', severity: 'warning' },
  { kind: 'negative_stock', name: 'Negative stock', severity: 'warning' },
  { kind: 'expired_stock', name: 'Expired stock on the shelf', severity: 'warning' },
  { kind: 'adjustment_other', name: 'Unexplained write-offs', severity: 'warning' },
  { kind: 'weekly_review', name: 'Weekly review not signed', severity: 'warning' },
];
