import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { ConfigService } from 'src/core/config/config.service';
import { ModulesService } from 'src/core/modules/modules.service';
import { MANAGER_ROLES, OWNER_ROLES } from 'src/core/roles';
import { StoreService } from '../store/store.service';
import { KINDS, cleanParams } from '../alerts/alert-kinds';
import { render } from '../alerts/alert-messages';
import { cacheKey } from 'src/core/heavy-query';
import { StoredCache } from 'src/core/stored-cache';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { ALERT_KINDS_USED, HFinding, daysBetween, findingsFromChecks, fromAlert, legalFloor, live, rollup, snoozeProblem, storeMatrix, varianceFinding } from './dashboard-findings';

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const inr = (n: number) => Math.round(n).toLocaleString('en-IN');

/**
 * The findings behind the health card (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 4). Providers: the alert kinds the business has switched on (the
 * same queries the alerts engine runs), the old ratio checks when they cross a threshold, and a few direct checks. A provider that fails is logged and
 * left out; it never blanks the card. Findings are scoped like the rest of the dashboard (`DashboardService.scope`).
 */
@Injectable()
export class DashboardFindingsService {
  private readonly log = new Logger(DashboardFindingsService.name);
  /** the findings run about twenty queries: kept for an hour per view (shown with when they were worked out), and setting one aside clears them */
  private readonly stored: StoredCache;

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly dash: DashboardService,
    private readonly metrics: DashboardMetricsService,
    private readonly config: ConfigService,
    private readonly stores: StoreService,
    private readonly modules: ModulesService,
    private readonly audit: AuditService,
  ) {
    this.stored = new StoredCache(manager);
  }

  private num(v: any): number | null {
    const n = Number(v);
    return v === undefined || v === null || v === '' || !Number.isFinite(n) ? null : n;
  }

  private async guard(user: any, storeid: any) {
    const sc = await this.dash.scope(user, this.num(storeid));
    if (!MANAGER_ROLES.includes(String(sc.role))) throw new ForbiddenException('These figures are for the people who run the business or a store.');
    return sc;
  }

  private async safe<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try { return await fn(); } catch (e: any) { this.log.warn(`finding provider ${name} failed: ${e?.message || e}`); return fallback; }
  }

  /** the alert kinds, run the way the alerts engine runs them (the business's own rule and thresholds when it has one) */
  private async fromAlerts(businessId: number, stores: number[] | null, today: string): Promise<HFinding[]> {
    const rules = await this.manager.query(`select kind, params, active from alert_rule where business_id = $1 and not archive and store_id is null`, [businessId]);
    const moduleState = await this.modules.forBusiness(businessId);
    const ctx: any = { manager: this.manager, stores: this.stores, businessId, today };
    const out: HFinding[] = [];
    for (const kind of KINDS.filter((k) => ALERT_KINDS_USED.includes(k.kind))) {
      const rule = rules.find((r: any) => r.kind === kind.kind);
      if (rule && !rule.active) continue;
      if (kind.pack && !(await this.modules.packOnForBusiness(businessId, kind.pack))) continue;
      if (kind.module && !moduleState[kind.module]) continue;
      const found = await this.safe(`alert:${kind.kind}`, async () => kind.evaluate(ctx, cleanParams(kind, rule?.params ?? {})), [] as any[]);
      for (const f of found) {
        if (stores !== null && f.storeid !== null && f.storeid !== undefined && !stores.includes(+f.storeid)) continue;
        const h = fromAlert(f, render(f.code, f.params, 'en'));
        if (h) out.push(h);
      }
    }
    return out;
  }

  private async direct(businessId: number, stores: number[] | null, owner: boolean, cfg: Record<string, any>, today: string): Promise<HFinding[]> {
    const out: HFinding[] = [];
    const tol = Number.isFinite(Number(cfg.cash_tolerance)) ? Number(cfg.cash_tolerance) : 100;

    // money owed to vendors and already late
    await this.safe('payables', async () => {
      const owed: any[] = await this.dash.getOutstandingInvoices(stores);
      const bal = (i: any) => Number(i.balance_amount) || 0;
      const late = owed.filter((i) => i.due_date && String(i.due_date).slice(0, 10) < today);
      const old = late.filter((i) => daysBetween(String(i.due_date).slice(0, 10), today) > 60);
      const sum = (l: any[]) => l.reduce((a, i) => a + bal(i), 0);
      if (late.length) out.push({ key: 'payables:overdue', code: 'payables_overdue', area: 'purchasing', severity: 'major', storeid: null, title: `${late.length} vendor invoice${late.length === 1 ? ' is' : 's are'} overdue`, detail: `Rs ${inr(sum(late))} is past its due date.`, count: late.length, amount: Math.round(sum(late)), link: '/secure/purchases', owner: 'Business Head', legal: false });
      if (old.length) out.push({ key: 'payables:overdue60', code: 'payables_overdue_60', area: 'purchasing', severity: 'major', storeid: null, title: `${old.length} invoice${old.length === 1 ? ' is' : 's are'} over 60 days late`, detail: `Rs ${inr(sum(old))} has been unpaid for more than two months past due: vendor supply and credit terms are at risk.`, count: old.length, amount: Math.round(sum(old)), link: '/secure/purchases', owner: 'Business Head', legal: false });
    }, undefined);

    // drawer differences at shift close in the last 30 days
    await this.safe('cash_variance', async () => {
      const rows = await this.manager.query(
        `select sh.store_id, s.location, count(*)::int as shifts,
                coalesce(sum(abs(coalesce(sh.variance, 0))), 0)::float8 as total,
                count(*) filter (where abs(coalesce(sh.variance, 0)) > $3 and coalesce(trim(sh.cash_variance_reason), '') = '')::int as unexplained
           from store_shifts sh join stores s on s.id = sh.store_id
          where s.business_id = $1 and sh.status = 'CLOSED' and sh.closed_on >= now() - interval '30 days'
            and ($2::int[] is null or sh.store_id = any($2::int[]))
            and (abs(coalesce(sh.variance, 0)) > $3
                 or exists (select 1 from jsonb_array_elements(coalesce(sh.closing_digital, '[]'::jsonb)) d where abs(coalesce((d->>'variance')::numeric, 0)) > $3))
          group by sh.store_id, s.location`, [businessId, stores, tol]);
      for (const r of rows) out.push(varianceFinding(r));
    }, undefined);

    // digital payments that are old enough to be on a statement and have not been checked
    await this.safe('digital_unchecked', async () => {
      const [r] = await this.manager.query(
        `select count(*)::int as n, coalesce(sum(s.digi_amount), 0)::float8 as amount
           from sale s join stores st on st.id = s.store_id
          where st.business_id = $1 and s.status = 'COMPLETE' and s.active and not s.archive and coalesce(s.digi_amount, 0) > 0
            and s.bill_date < now() - interval '7 days' and s.bill_date >= now() - interval '60 days'
            and ($2::int[] is null or s.store_id = any($2::int[]))
            and not exists (select 1 from payment_check k where k.sale_id = s.id and k.status = 'VERIFIED')`, [businessId, stores]);
      if (r.n > 0) out.push({ key: 'digital:unchecked', code: 'digital_unchecked', area: 'cash', severity: 'major', storeid: null, title: `${r.n} digital payment${r.n === 1 ? '' : 's'} not checked against a statement`, detail: `Rs ${inr(r.amount)} of card and UPI bills from 7 to 60 days ago has no VERIFIED check. Upload the provider statement and match them.`, count: r.n, amount: Math.round(r.amount), link: '/secure/digital-payments', owner: 'Store Head', legal: false });
    }, undefined);

    // stock close to expiry (not yet expired: that has its own finding) and fast movers with nothing on the shelf
    await this.safe('expiry', async () => {
      const [r] = await this.manager.query(
        `select coalesce(sum(available_qty * ptr_value / nullif(pack, 0)), 0)::float8 as total,
                coalesce(sum(available_qty * ptr_value / nullif(pack, 0)) filter (where expdate >= current_date and expdate <= current_date + interval '30 days'), 0)::float8 as d30,
                coalesce(sum(available_qty * ptr_value / nullif(pack, 0)) filter (where expdate >= current_date and expdate <= current_date + interval '90 days'), 0)::float8 as d90
           from stock_view where available_qty > 0`);
      if (r.total > 0 && r.d30 / r.total >= 0.02) out.push({ key: 'stock:expiry30', code: 'expiring_30', area: 'stock', severity: 'major', storeid: null, title: 'Stock expiring within 30 days', detail: `Rs ${inr(r.d30)} at cost (${Math.round((r.d30 / r.total) * 100)}% of stock) expires within a month. Return it to the vendor, push it, or plan the write-off.`, amount: Math.round(r.d30), link: '/secure/store/stock/expiry', owner: 'Store Head', legal: false });
      else if (r.total > 0 && r.d90 / r.total >= 0.05) out.push({ key: 'stock:expiry90', code: 'expiring_90', area: 'stock', severity: 'minor', storeid: null, title: 'Stock expiring within 90 days', detail: `Rs ${inr(r.d90)} at cost (${Math.round((r.d90 / r.total) * 100)}% of stock) expires within three months.`, amount: Math.round(r.d90), link: '/secure/store/stock/expiry', owner: 'Store Head', legal: false });
    }, undefined);
    await this.safe('fast_out', async () => {
      const [r] = await this.manager.query(
        `select count(*)::int as selling, count(*) filter (where coalesce(b.q, 0) <= 0)::int as out
           from (select si.product_id from sale_item si join sale s on s.id = si.sale_id
                  where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive and s.bill_date >= current_date - interval '30 days'
                    and ($1::int[] is null or s.store_id = any($1::int[])) group by si.product_id having sum(si.qty) > 0) sold
           left join (select product_id, sum(available_qty) as q from stock_view group by 1) b on b.product_id = sold.product_id`, [stores]);
      if (r.out > 0) out.push({ key: 'stock:fast_out', code: 'fast_out', area: 'stock', severity: r.out >= 3 ? 'major' : 'minor', storeid: null, title: `${r.out} product${r.out === 1 ? '' : 's'} that sold this month ${r.out === 1 ? 'is' : 'are'} out of stock`, detail: `${r.out} of ${r.selling} products sold in the last 30 days have no stock. Customers asking for them are being turned away.`, count: r.out, link: '/secure/purchases/requests', owner: 'Store Head', legal: false });
    }, undefined);

    // owner logins without two-step sign-in (when the business uses it)
    if (owner && String(process.env.MFA_MODE || '').toLowerCase() !== 'off') {
      await this.safe('mfa', async () => {
        const [r] = await this.manager.query(
          `select count(*)::int as n from app_user u join app_role r on r.id = u.role_id
            where u.business_id = $1 and u.active and not u.archive and r.name = any($2::text[]) and not coalesce(u.mfa_enabled, false)`, [businessId, OWNER_ROLES]);
        if (r.n > 0) out.push({ key: 'system:mfa_owner', code: 'mfa_owner_off', area: 'system', severity: 'major', storeid: null, title: `${r.n} owner login${r.n === 1 ? ' has' : 's have'} no two-step sign-in`, detail: 'Owner accounts see cost, margin and every store. Link an authenticator app on each.', count: r.n, link: '/secure/settings/users', owner: 'Business Head', legal: false });
      }, undefined);
    }
    return out;
  }

  /** the findings that are live today, with the figures the card draws */
  async findings(user: any, storeid?: any, refresh = false) {
    const sc = await this.guard(user, storeid);
    return this.stored.get(cacheKey('findings', sc.businessId, sc.owner, sc.role, sc.stores, this.num(storeid)), 'hourly', () => this.findingsNow(user, storeid), refresh);
  }

  private async findingsNow(user: any, storeid?: any) {
    const sc = await this.guard(user, storeid);
    const requested = this.num(storeid);
    if (!sc.businessId) return { score: null, status: null, counts: { critical: 0, major: 0, minor: 0, info: 0 }, areas: [], fixFirst: [], findings: [], snoozed: [], matrix: [], trend: [], newThisWeek: 0, asOf: new Date().toISOString() };
    const businessId = sc.businessId;
    const today = istToday();
    const cfg = await this.config.valuesFor(businessId, 'health');

    const [alerts, health, direct] = await Promise.all([
      this.fromAlerts(businessId, sc.stores, today),
      this.safe('measures', () => this.metrics.health(user, storeid), null as any),
      this.direct(businessId, sc.stores, sc.owner, cfg, today),
    ]);
    const measures = health ? findingsFromChecks(health.checks || [], { healthyMin: Number(cfg.healthy_min) || 80, holdBelow: Number(cfg.hold_below) || 60 }) : [];
    const storeNames = await this.manager.query(`select id, trim(location) as name from stores where business_id = $1 and active and not archive and ($2::int[] is null or id = any($2::int[])) order by location`, [businessId, sc.stores]);
    const nameOf = new Map<number, string>(storeNames.map((s: any) => [+s.id, s.name]));
    const all = [...alerts, ...direct, ...measures].map(legalFloor).map((f) => ({ ...f, store: f.store ?? (f.storeid !== null ? nameOf.get(+f.storeid) : undefined) }));

    // when each was first seen, and any snooze
    const keys = Array.from(new Set(all.map((f) => f.key)));
    const state = keys.length ? await this.manager.query(
      `insert into health_finding_state (business_id, fkey) select $1, k from unnest($2::text[]) k
       on conflict (business_id, fkey) do update set
         first_seen = case when health_finding_state.last_seen < current_date - 3 then current_date else health_finding_state.first_seen end,
         last_seen = current_date
       returning fkey, first_seen::text as first_seen, snoozed_until::text as snoozed_until, snooze_reason`, [businessId, keys]) : [];
    const st = new Map<string, any>(state.map((r: any) => [r.fkey, r]));
    const withState: HFinding[] = all.map((f) => ({ ...f, firstSeen: st.get(f.key)?.first_seen ?? today, snoozedUntil: st.get(f.key)?.snoozed_until ?? null, snoozeReason: st.get(f.key)?.snooze_reason ?? null }));

    const counted = live(withState, today);
    const countedKeys = new Set(counted.map((f) => f.key));
    const snoozed = withState.filter((f) => !countedKeys.has(f.key));
    const r = rollup(counted);

    // the trend: one snapshot per day for this scope, written when the card is read
    const scopeStore = requested ?? 0;
    await this.safe('snapshot', async () => {
      const rows = [{ area: 'all', score: r.score, critical: r.counts.critical, major: r.counts.major, minor: r.counts.minor }, ...r.areas.map((a) => ({ area: a.key, score: a.score, critical: a.critical, major: a.major, minor: a.minor }))];
      for (const x of rows) {
        await this.manager.query(
          `insert into health_snapshot (business_id, store_id, snap_date, area, score, critical, major, minor) values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (business_id, store_id, snap_date, area) do update set score = excluded.score, critical = excluded.critical, major = excluded.major, minor = excluded.minor`,
          [businessId, scopeStore, today, x.area, x.score, x.critical, x.major, x.minor]);
      }
    }, undefined);
    const trend = await this.safe('trend', () => this.manager.query(
      `select snap_date::text as date, score, critical, major, minor from health_snapshot
        where business_id = $1 and store_id = $2 and area = 'all' and snap_date >= current_date - 84 order by snap_date`, [businessId, scopeStore]), [] as any[]);

    const order = ['critical', 'major', 'minor', 'info'];
    const sorted = counted.slice().sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || (b.amount || 0) - (a.amount || 0) || (b.daysOpen || 0) - (a.daysOpen || 0));
    return {
      ...r,
      findings: sorted,
      snoozed,
      matrix: sc.owner && requested === null && storeNames.length > 1 ? storeMatrix(counted, storeNames.map((s: any) => ({ id: +s.id, name: s.name }))) : [],
      trend,
      newThisWeek: counted.filter((f) => f.severity !== 'info' && (f.daysOpen ?? 0) <= 7).length,
      asOf: new Date().toISOString(),
    };
  }

  /** put a finding aside for a while, with a reason (owner only; a legal duty cannot be snoozed) */
  async snooze(user: any, body: { key?: string; until?: string; reason?: string }) {
    const sc = await this.guard(user, null);
    if (!sc.owner || !sc.businessId) throw new ForbiddenException('Only the owner can set a finding aside.');
    const today = istToday();
    const key = String(body?.key || '');
    const reason = String(body?.reason || '').trim().slice(0, 300);
    const problem = snoozeProblem(String(body?.until || ''), reason, today);
    if (!key) throw new BadRequestException('Say which finding.');
    if (problem) throw new BadRequestException(problem);
    const current = await this.findings(user, null);
    const f = [...current.findings, ...current.snoozed].find((x: HFinding) => x.key === key);
    if (!f) throw new BadRequestException('That finding is not open any more.');
    if (f.legal) throw new BadRequestException('A legal or statutory item cannot be set aside. Put it right, or ask for a waiver in the compliance register.');
    await this.manager.query(
      `update health_finding_state set snoozed_until = $3, snooze_reason = $4, snoozed_by = $5, snoozed_on = now() where business_id = $1 and fkey = $2`,
      [sc.businessId, key, body.until, reason, user.id]);
    await this.stored.clear('findings|');
    await this.audit.record({ userId: user.id, action: 'health.finding_snoozed', entityType: 'health_finding', entityId: 0, summary: `Set aside until ${body.until}: ${f.title}`, details: { key, until: body.until, reason } });
    return { saved: true };
  }

  async unsnooze(user: any, key: string) {
    const sc = await this.guard(user, null);
    if (!sc.owner || !sc.businessId) throw new ForbiddenException('Only the owner can bring a finding back.');
    await this.manager.query(`update health_finding_state set snoozed_until = null, snooze_reason = null where business_id = $1 and fkey = $2`, [sc.businessId, String(key || '')]);
    await this.stored.clear('findings|');
    await this.audit.record({ userId: user.id, action: 'health.finding_unsnoozed', entityType: 'health_finding', entityId: 0, summary: `Brought back: ${key}`, details: { key } });
    return { saved: true };
  }
}
