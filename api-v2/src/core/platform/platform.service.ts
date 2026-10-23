import { CanActivate, ExecutionContext, ForbiddenException, Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Entitlements, verifyEntitlements } from './entitlements';

/** how often the app asks the control plane (so a suspension or a plan change reaches it within about a minute) */
const REFRESH_MS = Math.max(15, Number(process.env.ENTITLEMENT_REFRESH_SECONDS || 60)) * 1000;

/**
 * The link to the control plane when this app runs as a customer's copy (TENANT_SLUG, TENANT_SECRET and CONTROL_PLANE_URL set).
 * It reports usage and receives the signed entitlements: status, plan, modules and limits. The last good answer is kept in the
 * database, so the app starts and trades without the control plane; only an explicit "suspended" from it stops the app.
 * Without those variables the app is standalone and nothing is limited.
 */
@Injectable()
export class PlatformService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Platform');
  private current: (Entitlements & { expired: boolean }) | null = null;
  private lastChecked: Date | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  get managed(): boolean {
    return !!(process.env.TENANT_SLUG && process.env.TENANT_SECRET && process.env.CONTROL_PLANE_URL);
  }

  async onModuleInit() {
    if (!this.managed) return;
    // the counters of uploads and scans (migration 080); made here too so a copy built before it still works
    await this.manager.query(`create table if not exists platform_counter (kind text not null, period text not null, n integer not null default 0, primary key (kind, period))`).catch(() => undefined);
    try {
      const [row] = await this.manager.query(`select token, fetched_on from platform_entitlement where id = 1`);
      if (row) {
        this.current = verifyEntitlements(row.token, process.env.TENANT_SECRET as string, process.env.TENANT_SLUG as string);
        this.lastChecked = row.fetched_on;
      }
    } catch (e: any) {
      this.log.warn(`could not read the saved entitlements: ${e.message}`);
    }
    this.refresh().catch(() => undefined);
    this.timer = setInterval(() => this.refresh().catch(() => undefined), REFRESH_MS);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** what the plan allows, or null when standalone (or the control plane has never answered) */
  entitlements(): Entitlements | null { return this.current; }

  /** safe to show the signed-in user */
  summary() {
    const e = this.current;
    if (!this.managed || !e) return null;
    return { plan: e.planLabel, status: e.status, reason: e.reason, trialEnds: e.trialEnds, demo: !!e.demo, limits: e.limits, checkedOn: this.lastChecked };
  }

  /** Asks the control plane for fresh entitlements, reporting what this copy uses. A failure keeps what was known. */
  async refresh(): Promise<void> {
    if (!this.managed) return;
    const slug = process.env.TENANT_SLUG as string;
    try {
      const res = await fetch(`${process.env.CONTROL_PLANE_URL}/tenants/${encodeURIComponent(slug)}/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-key': process.env.TENANT_SECRET as string },
        body: JSON.stringify({ usage: await this.usage(), version: process.env.APP_VERSION || null }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { this.log.warn(`control plane answered ${res.status}`); return; }
      const { token } = (await res.json()) as { token: string };
      const verified = verifyEntitlements(token, process.env.TENANT_SECRET as string, slug);
      if (!verified) { this.log.warn('the entitlements received could not be verified; keeping the last good ones'); return; }
      this.current = verified;
      this.lastChecked = new Date();
      await this.manager.query(
        `insert into platform_entitlement (id, token, fetched_on) values (1, $1, now()) on conflict (id) do update set token = excluded.token, fetched_on = excluded.fetched_on`, [token]);
    } catch (e: any) {
      this.log.warn(`control plane not reachable (${e.message}); keeping the last known entitlements`);
    }
  }

  /** Counted the same way the limits are: stores that are open for business, and people's logins (not the shared till or self-service). */
  async usage() {
    const [r] = await this.manager.query(
      `select (select count(*)::int from stores where active and not archive) as stores,
              (select count(*)::int from app_user u join app_role r on r.id = u.role_id where u.active and not u.archive and r.name not in ('Counter', 'Personal', 'Site Admin')) as users,
              (select count(*)::int from sale where status = 'COMPLETE' and bill_date >= date_trunc('month', now())) as bills_month`);
    return { ...r, documents: await this.counted('documents'), scans_month: await this.counted('scans') };
  }

  /** the call a customer makes when adding a store or a login; refuses when the plan's limit is used up */
  async assertRoom(what: 'stores' | 'users'): Promise<void> {
    const e = this.current;
    if (!this.managed || !e) return;
    const used = (await this.usage())[what] as number;
    const limit = e.limits[what];
    if (used >= limit) {
      throw new ForbiddenException(`Your ${e.planLabel} plan allows ${limit} ${what === 'stores' ? (limit === 1 ? 'store' : 'stores') : (limit === 1 ? 'login' : 'logins')}, and ${used} ${used === 1 ? 'is' : 'are'} in use. Ask your provider to change the plan.`);
    }
  }

  private periodOf(kind: 'documents' | 'scans'): string { return kind === 'documents' ? 'all' : new Date().toISOString().slice(0, 7); }

  async counted(kind: 'documents' | 'scans'): Promise<number> {
    try {
      const [r] = await this.manager.query(`select n from platform_counter where kind = $1 and period = $2`, [kind, this.periodOf(kind)]);
      return r?.n ?? 0;
    } catch { return 0; }
  }

  /** Records one more document stored or scan read. Counted whether or not it worked: reading a copy costs the same either way. */
  async bump(kind: 'documents' | 'scans'): Promise<void> {
    if (!this.managed) return;
    // a database restored from a template built before the counters existed has no table yet
    await this.manager.query(`create table if not exists platform_counter (kind text not null, period text not null, n integer not null default 0, primary key (kind, period))`).catch(() => undefined);
    await this.manager.query(
      `insert into platform_counter (kind, period, n) values ($1, $2, 1) on conflict (kind, period) do update set n = platform_counter.n + 1`, [kind, this.periodOf(kind)]).catch(() => undefined);
  }

  /** Refuses an upload or a scan once the plan's (or the trial's or demo's) allowance is used. */
  async assertQuota(kind: 'documents' | 'scans'): Promise<void> {
    const e = this.current;
    if (!this.managed || !e) return;
    const limit = e.limits[kind];
    if (limit === null || limit === undefined) return;
    const used = await this.counted(kind);
    if (used >= limit) {
      const who = e.demo ? 'This demo' : (e.status === 'trial' ? 'This trial' : `Your ${e.planLabel} plan`);
      const what = kind === 'documents' ? `${limit} uploaded document${limit === 1 ? '' : 's'}` : `${limit} invoice or statement read${limit === 1 ? '' : 's'} a month`;
      throw new ForbiddenException(`${who} allows ${what}, and ${used} ${used === 1 ? 'has' : 'have'} been used.${e.demo || e.status === 'trial' ? ' Contact your provider to continue after the trial.' : ' Ask your provider to change the plan.'}`);
    }
  }

  /** why every request must be refused, or null */
  blockedReason(): string | null {
    const e = this.current;
    if (!this.managed || !e) return null;
    if (e.status === 'suspended') return e.reason === 'trial_ended' ? 'Your trial has ended. Contact your provider to continue.' : 'This account is suspended. Contact your provider.';
    if (e.status === 'closed') return 'This account is closed.';
    return null;
  }
}

/** Put before a route that stores a document: the upload is refused before it is written once the allowance is used. */
@Injectable()
export class DocumentQuotaGuard implements CanActivate {
  constructor(private readonly platform: PlatformService) {}
  async canActivate(_: ExecutionContext) { await this.platform.assertQuota('documents'); return true; }
}

/** Put before a route that reads a document (an invoice copy, a payment statement). */
@Injectable()
export class ScanQuotaGuard implements CanActivate {
  constructor(private readonly platform: PlatformService) {}
  async canActivate(_: ExecutionContext) { await this.platform.assertQuota('scans'); return true; }
}

@Global()
@Module({ providers: [PlatformService, DocumentQuotaGuard, ScanQuotaGuard], exports: [PlatformService, DocumentQuotaGuard, ScanQuotaGuard] })
export class PlatformModule {}
