import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { cacheOn, decide, policyOf, refreshesLeft, refusalMessage } from './ai-cache-rules';

export interface CacheSpec {
  /** the tool the model is made to call, as the usage log names it */
  feature: string;
  /** whose answer it is */
  scope: string;
  fingerprint: string;
  userId: number | null;
  /** the person pressed "write it again" */
  refresh?: boolean;
  /** what the screen calls it, for the refusal message ("brief", "note") */
  what: string;
  model?: string | null;
}

export interface CacheResult<T> {
  value: T;
  fromCache: boolean;
  generatedAt: Date;
  /** refreshes left in the window; null when the feature has none */
  refreshesLeft: number | null;
  canRefresh: boolean;
  refreshReason: string | null;
}

/** a short, fixed-length scope from a list of ids (the stores in scope may be hundreds) */
export const scopeOf = (prefix: string, ids: number[] | null): string =>
  ids === null ? `${prefix}:all` : `${prefix}:${createHash('sha1').update([...ids].sort((a, b) => a - b).join(',')).digest('hex').slice(0, 16)}`;

/**
 * Keeps the assistant's answers so the same facts are not asked about twice, and limits how often one may be asked for again. It wraps the call to the model
 * and keeps only the model's answer under a fingerprint of what it was based on. When the cache tables are missing (migration 178 not run), or anything in
 * the cache fails, the request is simply made as it was before. See docs/planning/AI_CACHE.md.
 */
@Injectable()
export class AiCacheService {
  private readonly log = new Logger('AiCache');
  /** identical requests that arrive together share one request to the model */
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  private async event(feature: string, scope: string, userId: number | null, kind: string) {
    try { await this.manager.query(`insert into ai_cache_event (feature, scope, user_id, kind) values ($1, $2, $3, $4)`, [feature, scope, userId, kind]); }
    catch (e: any) { this.log.warn(`cache event not logged: ${e?.message}`); }
  }

  async run<T>(spec: CacheSpec, produce: () => Promise<T>): Promise<CacheResult<T>> {
    const policy = policyOf(spec.feature);
    const now = new Date();
    const plain = (value: T): CacheResult<T> => ({ value, fromCache: false, generatedAt: new Date(), refreshesLeft: null, canRefresh: true, refreshReason: null });
    if (!policy) return plain(await produce());

    let entry: { output: T; created_on: Date } | null = null;
    let refreshTimes: Date[] = [], callTimes: Date[] = [];
    try {
      // the Business Head can switch the cache and its limits off (ai.cache_mode): then every request is made, as before
      const [mode] = await this.manager.query(`select setting_value from app_setting where setting_key = 'ai.cache_mode' and active and not archive`);
      if (!cacheOn(mode?.setting_value)) return plain(await produce());
      const [e] = await this.manager.query(
        `select output, created_on from ai_result_cache where feature = $1 and scope = $2 and fingerprint = $3 and expires_on > now()`, [spec.feature, spec.scope, spec.fingerprint]);
      entry = e ? { output: e.output as T, created_on: new Date(e.created_on) } : null;
      if (policy.refresh) {
        refreshTimes = (await this.manager.query(
          `select created_on from ai_cache_event where feature = $1 and scope = $2 and kind = 'REFRESH' and created_on > now() - ($3 || ' hours')::interval`,
          [spec.feature, spec.scope, String(policy.refresh.perHours)])).map((r: any) => new Date(r.created_on));
      }
      if (policy.calls && spec.userId) {
        callTimes = (await this.manager.query(
          `select created_on from ai_cache_event where feature = $1 and user_id = $2 and kind in ('MISS', 'REFRESH') and created_on > now() - ($3 || ' hours')::interval`,
          [spec.feature, spec.userId, String(policy.calls.perHours)])).map((r: any) => new Date(r.created_on));
      }
    } catch (e: any) {
      this.log.warn(`AI cache not used (${spec.feature}): ${e?.message}`);
      return plain(await produce());
    }

    const meta = (left: number | null, created: Date, hasEntry: boolean) => {
      const limited = left !== null && left <= 0;
      const unchanged = hasEntry && !policy.refreshWhenUnchanged;
      return {
        refreshesLeft: left, generatedAt: created,
        canRefresh: !unchanged && !limited,
        refreshReason: unchanged ? refusalMessage('unchanged', null, now, spec.what) : limited ? refusalMessage('refresh_limit', null, now, spec.what) : null,
      };
    };

    const d = decide({ entry: entry ? { createdOn: entry.created_on } : null, now, refresh: !!spec.refresh, policy, refreshTimes, callTimes });

    if (d.action === 'serve') {
      await this.manager.query(`update ai_result_cache set hits = hits + 1, last_hit_on = now() where feature = $1 and scope = $2 and fingerprint = $3`, [spec.feature, spec.scope, spec.fingerprint]).catch(() => undefined);
      await this.event(spec.feature, spec.scope, spec.userId, 'HIT');
      return { value: entry!.output, fromCache: true, ...meta(refreshesLeft(policy, refreshTimes, now), entry!.created_on, true) };
    }

    if (d.action === 'refuse') {
      await this.event(spec.feature, spec.scope, spec.userId, 'REFUSED');
      throw new HttpException(refusalMessage(d.reason, d.nextAllowedAt, now, spec.what), 429);
    }

    // a request to the model; identical ones in flight at the same moment share it
    const key = `${spec.feature}|${spec.scope}|${spec.fingerprint}`;
    let pending = this.inflight.get(key);
    if (!pending) {
      pending = produce().finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    const value = (await pending) as T;
    const created = new Date();
    try {
      await this.manager.query(
        `insert into ai_result_cache (feature, scope, fingerprint, output, model, expires_on, created_by) values ($1, $2, $3, $4::jsonb, $5, now() + ($6 || ' hours')::interval, $7)
         on conflict (feature, scope, fingerprint) do update set output = excluded.output, model = excluded.model, created_on = now(), expires_on = excluded.expires_on, hits = 0, last_hit_on = null, created_by = excluded.created_by`,
        [spec.feature, spec.scope, spec.fingerprint, JSON.stringify(value ?? null), spec.model ? String(spec.model).slice(0, 120) : null, String(policy.ttlHours), spec.userId]);
      await this.event(spec.feature, spec.scope, spec.userId, d.kind);
      // tidy: expired answers and old events do not pile up
      if (Math.random() < 0.05) {
        await this.manager.query(`delete from ai_result_cache where expires_on < now() - interval '7 days'`).catch(() => undefined);
        await this.manager.query(`delete from ai_cache_event where created_on < now() - interval '120 days'`).catch(() => undefined);
      }
    } catch (e: any) { this.log.warn(`AI answer not kept (${spec.feature}): ${e?.message}`); }
    const left = policy.refresh ? Math.max(0, policy.refresh.max - refreshTimes.length - (d.kind === 'REFRESH' ? 1 : 0)) : null;
    return { value, fromCache: false, ...meta(left, created, true) };
  }
}
