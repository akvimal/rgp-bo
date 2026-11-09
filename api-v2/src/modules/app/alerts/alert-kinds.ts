import { HrKpiEngine } from '../hr/hr-kpi-engine.service';
import { paceStatus } from '../hr/hr-kpi-pace';
import { EntityManager } from 'typeorm';
import { StoreService } from '../store/store.service';
import { PricingReader } from '../products/pricing-reader';
import { BATCH_BALANCE_SQL } from './stock-audit-alerts';
import { lastFullWeek, reviewLate } from '../review/review-rules';
import { BUSINESS_OF_USER_SQL } from '../../../core/business-of-user';
import { stageOf } from '../todos/todo-rules';
import { NOT_A_PERSON } from '../../../core/roles';

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
  /** who is told, when it is not the rule's recipients (a to-do's own person, or a store's staff) */
  recipients?: { roles: string[]; userids: number[] };
}

export interface Ctx {
  /** the KPI engine, for the alerts about staff KPIs */
  kpi?: HrKpiEngine;
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
  /** a kind of a business pack: watched only for a business that has the pack */
  pack?: string;
  evaluate(ctx: Ctx, params: Record<string, number>): Promise<Finding[]>;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

export const KINDS: AlertKind[] = [
  {
    kind: 'customer_request_arrived',
    label: 'Customer request arrived',
    description: "A product a customer asked for has been received (its purchase invoice is complete). The store is told to call the customer; the alert clears when the request is closed on the Requests page. The store is the one the goods were received at.",
    params: [],
    defaultSeverity: 'info',
    async evaluate(ctx) {
      const rows = await ctx.manager.query(
        `select pr.id, pr.customer_name, pr.customer_phone, pr.fulfilled_qty, coalesce(p.title, pr.requested_name) as product,
                st.id as store_id, st.location
           from purchase_request pr
           join app_user u on u.id = pr.created_by
           left join product p on p.id = pr.product_id
           left join lateral (select pi.store_id from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
                               where pii.request_id = pr.id and pi.status = 'COMPLETE' and pi.active and not pi.archive
                               order by pi.id desc limit 1) rcv on true
           left join stores st on st.id = rcv.store_id
          where pr.active and not pr.archive and pr.status = 'Received' and pr.customer_name is not null
            and ${BUSINESS_OF_USER_SQL} = $1`, [ctx.businessId]);
      return rows.map((r: any) => ({
        key: `request_arrived:${r.id}`,
        storeid: r.store_id ?? null,
        code: 'customer_request_arrived',
        params: { customer: String(r.customer_name).trim(), phone: r.customer_phone || '', product: r.product, qty: r.fulfilled_qty ?? 0, store: r.location ? String(r.location).trim() : 'the store' },
        link: '/secure/purchases/requests',
      }));
    },
  },
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
        // a store with a vault banks from the vault: the message names the vault and the link goes to its page
        code: (r.reason === 'amount' ? 'deposit_due_amount' : 'deposit_due_schedule') + (r.vault?.enabled ? '_vault' : ''),
        params: { store: r.location, balance: r.balance, excess: r.excess, since: r.since },
        link: r.vault?.enabled ? '/secure/store/vault' : '/secure/store/cash',
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
    pack: 'pharmacy',
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
    kind: 'gst_rate_change',
    label: 'GST rate change coming',
    description: 'A change of GST rate (Settings > GST > Rate changes) takes effect soon. Check the stock it covers and decide the prices.',
    params: [{ key: 'days', label: 'Warn this many days before', min: 1, max: 60, default: 7, unit: 'days' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select id, scope_type, scope_value, mode, rate::float8 as rate, to_char(effective_from, 'YYYY-MM-DD') as effective_from
           from gst_rate_change where cancelled_on is null and effective_from >= $1::date and effective_from <= $2::date order by effective_from`, [ctx.today, addDays(ctx.today, p.days)]);
      return rows.map((r: any) => {
        const what = r.scope_type === 'all' ? 'All products' : r.scope_type === 'category' ? `Category ${r.scope_value}` : r.scope_type === 'hsn_prefix' ? `HSN ${r.scope_value}` : `Product ${r.scope_value}`;
        return {
          key: `gstchange:${r.id}`,
          storeid: null,
          code: 'gst_rate_change_soon',
          params: { what, rate: r.rate, date: r.effective_from, days: daysBetween(ctx.today, r.effective_from) },
          link: '/secure/gst-filing',
        };
      });
    },
  },
  {
    kind: 'gst_filing_due',
    label: 'GST month not closed',
    description: 'A registered business has not closed last month under GST (the return is filed and the ARN is entered on the GST page). Warns from a few days before the usual filing date.',
    params: [{ key: 'days', label: 'Warn this many days before the 11th', min: 0, max: 10, default: 3, unit: 'days' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const [reg] = await ctx.manager.query(`select reg_type, to_char(go_live, 'YYYY-MM-DD') as go_live from gst_registration where business_id = $1`, [ctx.businessId]);
      if (!reg || reg.reg_type !== 'registered' || !reg.go_live) return [];
      const day = +ctx.today.slice(8, 10);
      if (day < 11 - p.days) return [];
      const y = +ctx.today.slice(0, 4), m = +ctx.today.slice(5, 7);
      const pm = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
      const month = `${pm.y}-${String(pm.m).padStart(2, '0')}`;
      if (month < reg.go_live.slice(0, 7)) return [];
      const [shut] = await ctx.manager.query(`select 1 from gst_filing_month where business_id = $1 and month = $2 and status = 'CLOSED'`, [ctx.businessId, month]);
      if (shut) return [];
      const dueDays = 11 - day;
      return [{
        key: `gstfiling:${month}`,
        storeid: null,
        code: dueDays >= 0 ? 'gst_filing_due' : 'gst_filing_late',
        severity: dueDays >= 0 ? undefined : 'critical' as Severity,
        params: { month, days: Math.abs(dueDays) },
        link: '/secure/gst-filing',
      }];
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
           from (${BATCH_BALANCE_SQL}) b where bal > 0 and public.expiry_end(exp_date) < current_date`, []);
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
  {
    kind: 'compliance_late',
    label: 'Compliance item gone unattended',
    description: 'An item in the compliance register has passed the business escalation days without being done or waived, or a parked bill has been left more than a day. Stock counts, licences and the weekly review also have their own alerts; this one is the escalation to the people who run the business.',
    params: [],
    defaultSeverity: 'critical',
    async evaluate(ctx) {
      const rows = await ctx.manager.query(
        `select i.id, i.item_key, i.step, i.store_id, s.location, to_char(i.due_on, 'YYYY-MM-DD') as due_on
           from compliance_instance i left join stores s on s.id = i.store_id
          where i.business_id = $1 and i.state = 'OPEN' and not i.not_mine and (i.step = 'escalated' or (i.item_key = 'parked_bill' and i.step = 'late'))`, [ctx.businessId]);
      const labels: Record<string, string> = { stock_count: 'The stock count', outage_check: 'The outage kit check', weekly_review: 'The weekly review', shift_close: 'Closing the shift', licence: 'The licence renewal', parked_bill: 'A parked bill' };
      return rows.map((r: any) => ({
        key: `compliance:${r.id}`, storeid: r.store_id, code: r.item_key === 'parked_bill' && r.step === 'late' ? 'compliance_parked' : 'compliance_escalated',
        params: { store: String(r.location ?? '').trim(), item: labels[r.item_key] || r.item_key, date: r.due_on, days: Math.max(0, daysBetween(r.due_on, ctx.today)) },
        link: '/secure/compliance', severity: r.step === 'escalated' ? 'critical' as Severity : 'warning' as Severity,
      }));
    },
  },
  {
    kind: 'customer_reveals_many',
    label: 'Many customers\' details shown',
    description: 'One login has shown the full contact details of many different customers within the period. A person serving customers shows a few; a long run is someone copying them out.',
    params: [
      { key: 'count', label: 'Alert at this many different customers', min: 3, max: 1000, default: 20, unit: 'customers' },
      { key: 'hours', label: 'within', min: 1, max: 168, default: 24, unit: 'hours' },
    ],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select u.id, u.full_name, count(distinct r.customer_id)::int as n
           from customer_reveal r join app_user u on u.id = r.user_id
          where r.created_on >= now() - ($2::int * interval '1 hour') and ${BUSINESS_OF_USER_SQL} = $1
          group by u.id, u.full_name having count(distinct r.customer_id) >= $3`, [ctx.businessId, p.hours, p.count]);
      return rows.map((r: any) => ({
        key: `reveals:${r.id}:${ctx.today}`, storeid: null, code: 'customer_reveals_many',
        params: { person: String(r.full_name).trim(), count: r.n, hours: p.hours }, link: '/secure/customers/cust/list',
        severity: r.n >= p.count * 2 ? 'critical' as Severity : undefined,
      }));
    },
  },
  {
    kind: 'customer_lookups_many',
    label: 'Heavy customer searching',
    description: 'One login has looked up or opened an unusually large number of customers within the period, for example by running through numbers at the counter lookup.',
    params: [
      { key: 'count', label: 'Alert at this many lookups', min: 20, max: 100000, default: 300, unit: 'lookups' },
      { key: 'hours', label: 'within', min: 1, max: 168, default: 1, unit: 'hours' },
    ],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      await ctx.manager.query(`delete from customer_access where created_on < now() - interval '30 days'`);   // the record is only for spotting a run, not for keeping
      const rows = await ctx.manager.query(
        `select u.id, u.full_name, count(*)::int as n
           from customer_access a join app_user u on u.id = a.user_id
          where a.created_on >= now() - ($2::int * interval '1 hour') and ${BUSINESS_OF_USER_SQL} = $1
          group by u.id, u.full_name having count(*) >= $3`, [ctx.businessId, p.hours, p.count]);
      return rows.map((r: any) => ({
        key: `lookups:${r.id}:${ctx.today}`, storeid: null, code: 'customer_lookups_many',
        params: { person: String(r.full_name).trim(), count: r.n, hours: p.hours }, link: '/secure/customers/cust/list',
        severity: r.n >= p.count * 2 ? 'critical' as Severity : undefined,
      }));
    },
  },
  {
    kind: 'customer_data_taken',
    label: 'Customer lists downloaded or printed',
    description: 'One login has downloaded customer lists or tried to print customer screens several times within the period.',
    params: [
      { key: 'count', label: 'Alert at this many downloads or prints', min: 1, max: 1000, default: 3, unit: 'times' },
      { key: 'hours', label: 'within', min: 1, max: 168, default: 24, unit: 'hours' },
    ],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      const rows = await ctx.manager.query(
        `select u.id, u.full_name, count(*)::int as n
           from audit_event a join app_user u on u.id = a.user_id
          where a.action in ('customer.exported', 'customer.print_attempt') and a.occurred_on >= now() - ($2::int * interval '1 hour') and ${BUSINESS_OF_USER_SQL} = $1
          group by u.id, u.full_name having count(*) >= $3`, [ctx.businessId, p.hours, p.count]);
      return rows.map((r: any) => ({
        key: `taken:${r.id}:${ctx.today}`, storeid: null, code: 'customer_data_taken',
        params: { person: String(r.full_name).trim(), count: r.n, hours: p.hours }, link: '/secure/quality/audit',
      }));
    },
  },
  {
    kind: 'todo_due',
    label: 'To-dos coming due',
    description: "A to-do is coming up, due, late, or very late. The person it is for is told (for a store's to-do, the store's staff and its head). A to-do that is very late is also raised to the person who gave it and the store head. The timing of each to-do is set on the to-do itself, under To-dos.",
    params: [],
    defaultSeverity: 'info',
    async evaluate(ctx) {
      const rows = await ctx.manager.query(
        `select i.id, i.title, i.store_id, i.pool, i.assignee_user_id, i.assigned_by, i.due_on, i.soon_days, i.escalate_days, i.priority, s.location, a.full_name as assignee
           from todo_item i left join stores s on s.id = i.store_id left join app_user a on a.id = i.assignee_user_id
          where i.business_id = $1 and i.status = 'OPEN' and not i.archive and i.due_on <= now() + (i.soon_days + 1) * interval '1 day'`, [ctx.businessId]);
      const now = new Date();
      const out: Finding[] = [];
      for (const r of rows) {
        const stage = stageOf(r.due_on, now, r.soon_days, r.escalate_days);
        if (stage === 'none') continue;
        const day = new Date(r.due_on.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
        const late = Math.max(0, daysBetween(day, ctx.today));
        const store = r.location ? String(r.location).trim() : '';
        const params = { title: r.title, date: day, days: late, person: r.pool ? (store || 'The store') : r.assignee, store };
        const mine = r.pool ? { roles: ['staff', 'managers'], userids: [] as number[] } : { roles: [] as string[], userids: [r.assignee_user_id] as number[] };
        const storeid = r.pool ? r.store_id : null;
        const high = r.priority === 'high';
        if (stage === 'soon') out.push({ key: `todo:${r.id}:soon`, storeid, code: 'todo_soon', params, link: '/secure/todos', recipients: mine, severity: high ? 'warning' : 'info' });
        else if (stage === 'due') out.push({ key: `todo:${r.id}:due`, storeid, code: 'todo_due', params, link: '/secure/todos', recipients: mine, severity: high ? 'warning' : 'info' });
        else {
          // late: said again each day, so it is not missed
          out.push({ key: `todo:${r.id}:overdue:${ctx.today}`, storeid, code: 'todo_overdue', params, link: '/secure/todos', recipients: mine, severity: 'warning' });
          if (stage === 'escalated' && r.assigned_by && r.assigned_by !== r.assignee_user_id) {
            out.push({ key: `todo:${r.id}:escalated`, storeid: r.store_id ?? null, code: 'todo_escalated', params, link: '/secure/todos',
              recipients: { roles: r.store_id ? ['managers'] : [], userids: [r.assigned_by] }, severity: 'critical' });
          }
        }
      }
      return out;
    },
  },
  {
    kind: 'feedback_reply',
    label: 'Reply to your report',
    description: 'Someone answered a report or question a person sent from Help and feedback, or changed its status. Only the person who sent it is told, until they open it.',
    params: [],
    defaultSeverity: 'info',
    async evaluate(ctx) {
      const rows = await ctx.manager.query(
        `select f.id, f.title, f.status, f.reporter_user_id from app_feedback f where f.business_id = $1 and not f.archive and f.reporter_unread`, [ctx.businessId]);
      return rows.map((r: any) => ({
        key: `feedback:${r.id}:reply`, storeid: null, code: 'feedback_reply',
        params: { title: String(r.title), status: String(r.status).toLowerCase().replace(/_/g, ' ') }, link: '/secure/feedback',
        recipients: { roles: [] as string[], userids: [r.reporter_user_id] as number[] },
      }));
    },
  },
  {
    kind: 'feedback_waiting',
    label: 'Report waiting for an answer',
    description: 'A report, question or suggestion sent from Help and feedback is new, or the person wrote back, and is waiting for a reply. Told to the people whose role may answer reports (the Inbox), until someone replies.',
    params: [],
    defaultSeverity: 'info',
    async evaluate(ctx) {
      const people = await ctx.manager.query(
        `select u.id from app_user u join app_role r on r.id = u.role_id
          where u.active and not u.archive and ${BUSINESS_OF_USER_SQL} = $1 and r.name <> all($2::text[])
            and exists (select 1 from json_array_elements(r.permissions) e, json_array_elements(e->'policies') p where e->>'resource' = 'feedback' and p->>'action' = 'manage')`,
        [ctx.businessId, NOT_A_PERSON]);
      if (!people.length) return [];
      const rows = await ctx.manager.query(
        `select f.id, f.title, f.kind, f.module_title, ru.full_name as reporter
           from app_feedback f join app_user ru on ru.id = f.reporter_user_id
          where f.business_id = $1 and not f.archive and f.awaiting_staff and f.status <> 'CLOSED'`, [ctx.businessId]);
      const userids = people.map((p: any) => p.id as number);
      return rows.map((r: any) => ({
        key: `feedback:${r.id}:waiting`, storeid: null, code: 'feedback_waiting',
        params: { title: String(r.title), person: String(r.reporter).trim(), module: String(r.module_title), kind: String(r.kind) }, link: '/secure/feedback',
        recipients: { roles: [] as string[], userids },
      }));
    },
  },
  {
    kind: 'kpi_behind_pace',
    label: 'KPI behind pace',
    description: 'Part-way through the month, a staff member is behind on a KPI the system measures (sales behind the pace needed for full marks, or a "lower is better" figure that has already cost half its points). They are told once for each measure each month.',
    params: [
      { key: 'from_day', label: 'Start checking from day', min: 3, max: 28, default: 10, unit: 'of the month' },
      { key: 'pace_pct', label: 'Count as behind below', min: 30, max: 95, default: 70, unit: '% of the pace' },
    ],
    defaultSeverity: 'info',
    async evaluate(ctx, p) {
      if (!ctx.kpi) return [];
      const day = Number(ctx.today.slice(8, 10));
      if (day < p.from_day) return [];
      const period = ctx.today.slice(0, 7);
      const dim = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate();
      const rows = await ctx.kpi.draft(period);
      const out: Finding[] = [];
      for (const r of rows) {
        if (!r.user_id || r.finalised) continue;
        for (const i of r.items) {
          if (i.source !== 'SYSTEM' || i.state !== 'SCORED' || i.raw === null) continue;
          const s = paceStatus({ rule: i.rule, direction: i.direction, raw: i.raw }, day, dim, p.pace_pct);
          if (!s.behind) continue;
          out.push({ key: `kpi:${r.employee_id}:${i.metric_id}:${period}`, storeid: r.store_id ?? null, code: 'kpi_behind',
            params: { measure: i.name, evidence: i.evidence || '', progress: s.progress ?? 0, name: r.name }, link: '/secure/kpi/mine',
            recipients: { roles: [], userids: [r.user_id] }, severity: 'info' });
        }
      }
      return out;
    },
  },
  {
    kind: 'kpi_rating_due',
    label: 'KPI ratings to give',
    description: 'The KPI ratings for last month that only a manager can give are still missing, and payroll for that month is not approved yet. The owners and managers are told.',
    params: [{ key: 'from_day', label: 'Start telling from day', min: 1, max: 28, default: 3, unit: 'of the month' }],
    defaultSeverity: 'warning',
    async evaluate(ctx, p) {
      if (!ctx.kpi || Number(ctx.today.slice(8, 10)) < p.from_day) return [];
      const d = new Date(Date.parse(ctx.today + 'T00:00:00Z'));
      const period = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
      const [paid] = await ctx.manager.query(`select 1 as x from hr_payroll_run where period = $1 and status = 'APPROVED'`, [period]);
      if (paid) return [];
      const rows = await ctx.kpi.draft(period);
      const missing = rows.filter((r) => !r.finalised && r.pending.length).reduce((t, r) => t + r.pending.length, 0);
      if (!missing) return [];
      return [{ key: `kpi_rating:${period}`, storeid: null, code: 'kpi_rating_due', params: { count: missing, period }, link: '/secure/kpi/rate',
        recipients: { roles: ['owners', 'managers'], userids: [] }, severity: 'warning' }];
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
export const DEFAULT_RULES: { kind: string; name: string; severity: Severity; recipients?: { roles: string[]; userids: number[] } }[] = [
  { kind: 'deposit_due', name: 'Bank deposit due', severity: 'warning' },
  { kind: 'licence_expiring', name: 'Store licence ending', severity: 'warning' },
  { kind: 'registration_expiring', name: 'Pharmacist registration ending', severity: 'warning' },
  { kind: 'gst_rate_change', name: 'GST rate change coming', severity: 'warning' },
  { kind: 'gst_filing_due', name: 'GST month not closed', severity: 'warning' },
  { kind: 'shift_open_long', name: 'Shift left open', severity: 'warning' },
  { kind: 'approvals_pending', name: 'Stock adjustments waiting', severity: 'warning' },
  { kind: 'price_policy', name: 'Prices out of policy', severity: 'warning' },
  { kind: 'outage_kit', name: 'Outage kit not checked', severity: 'warning' },
  { kind: 'stock_count_overdue', name: 'Stock count overdue', severity: 'warning' },
  { kind: 'negative_stock', name: 'Negative stock', severity: 'warning' },
  { kind: 'expired_stock', name: 'Expired stock on the shelf', severity: 'warning' },
  { kind: 'adjustment_other', name: 'Unexplained write-offs', severity: 'warning' },
  { kind: 'weekly_review', name: 'Weekly review not signed', severity: 'warning' },
  { kind: 'compliance_late', name: 'Compliance item gone unattended', severity: 'critical' },
  { kind: 'customer_reveals_many', name: 'Many customers\' details shown', severity: 'warning' },
  { kind: 'customer_lookups_many', name: 'Heavy customer searching', severity: 'warning' },
  { kind: 'customer_request_arrived', name: 'Customer request arrived', severity: 'info', recipients: { roles: ['owners', 'managers', 'staff'], userids: [] } },
  { kind: 'customer_data_taken', name: 'Customer lists downloaded or printed', severity: 'warning' },
  { kind: 'todo_due', name: 'To-dos coming due', severity: 'info' },
  { kind: 'feedback_reply', name: 'Reply to your report', severity: 'info' },
  { kind: 'feedback_waiting', name: 'Report waiting for an answer', severity: 'info' },
  { kind: 'kpi_behind_pace', name: 'KPI behind pace', severity: 'info' },
  { kind: 'kpi_rating_due', name: 'KPI ratings to give', severity: 'warning' },
];
