import { Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * How long a dashboard figure may be shown before it is worked out again, by how fast the data really changes:
 *   hourly  : findings, stock on the shelf, what needs a category
 *   daily   : money by category and month, cost ratios, GST estimate (worked out again on the first open of each day, India time)
 *   weekly  : sales patterns (worked out again on the first open of each week, weeks start on Monday)
 * A figure past its time is still shown at once, marked with when it was worked out, and is rebuilt in the background.
 */
export type Tier = 'hourly' | 'daily' | 'weekly';

const IST_MS = 5.5 * 3600_000;
const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

/** the longest a figure of the tier may be kept, in milliseconds (an owner can shorten or lengthen it in the server's settings) */
export const tierMaxAge = (tier: Tier): number =>
  tier === 'hourly' ? num(process.env.DASH_TTL_HOURLY_MIN, 60) * 60_000
    : tier === 'daily' ? num(process.env.DASH_TTL_DAILY_HOURS, 24) * 3600_000
      : num(process.env.DASH_TTL_WEEKLY_DAYS, 8) * 86400_000;

/** the India-time day number (days since 1970) of an instant */
const istDay = (ms: number) => Math.floor((ms + IST_MS) / 86400_000);
/** the India-time week number of an instant (weeks start on Monday; 1 Jan 1970 was a Thursday, so day 4 is the first Monday) */
const istWeek = (ms: number) => Math.floor((istDay(ms) - 4) / 7);

/**
 * Whether a figure worked out at `builtAt` may still be shown as current at `now` (both milliseconds). Pure, so it can be tested.
 * Hourly: built within the last hour. Daily: built on today's date in India and within a day. Weekly: built this week and within eight days.
 */
export function isFresh(tier: Tier, builtAt: number, now: number): boolean {
  if (builtAt > now + 60_000) return false;            // a clock that ran ahead: do not trust it
  const age = now - builtAt;
  if (age >= tierMaxAge(tier)) return false;
  if (tier === 'daily') return istDay(builtAt) === istDay(now);
  if (tier === 'weekly') return istWeek(builtAt) === istWeek(now);
  return true;
}

/** a figure may be asked for again at once only after this long: stops a Refresh button held down from reading every bill again */
export const REFRESH_COOLDOWN_MS = 30_000;
const MAX_PAYLOAD = 2_000_000;

export interface Stamped { asOf: string; refreshing?: boolean }

/** whether a request asked for the figure to be worked out again now (?refresh=1) */
export const wantsRefresh = (q: any): boolean => q?.refresh === '1' || q?.refresh === 'true' || q?.refresh === true;

/**
 * Dashboard figures kept in the database (migration 205), so they survive a restart and every person's open of the page is a single quick read instead of
 * a pass over the bills. Keys must carry everything a figure depends on (business, role, stores, period): build them with cacheKey().
 * A problem with the cache itself (the table not yet made, a failed save) is logged and the figure is simply worked out as before; the cache never stops
 * the dashboard from showing.
 */
export class StoredCache {
  private readonly log = new Logger('StoredCache');
  private readonly running = new Map<string, Promise<any>>();
  private downUntil = 0;

  constructor(private readonly manager: EntityManager) {}

  private get off() { return String(process.env.DASH_CACHE || 'on').toLowerCase() === 'off' || Date.now() < this.downUntil; }

  /** the figure for a key: kept, or worked out by `load` (and kept). The result carries `asOf` (when it was worked out) and, while it is being rebuilt, `refreshing`. */
  async get<T>(key: string, tier: Tier, load: () => Promise<T>, refresh = false): Promise<T & Stamped> {
    if (this.off) return this.stamp(await load(), Date.now());
    let row: { payload: any; built_at: Date; stale: boolean } | undefined;
    try {
      [row] = await this.manager.query(`select payload, built_at, stale from dashboard_cache where key = $1`, [key]);
    } catch (e: any) {
      this.down(e);
      return this.stamp(await load(), Date.now());
    }
    const now = Date.now();
    if (row) {
      const built = new Date(row.built_at).getTime();
      if (refresh && now - built < REFRESH_COOLDOWN_MS) return this.stamp(row.payload, built);   // just worked out: asking again changes nothing
      if (!refresh) {
        if (!row.stale && isFresh(tier, built, now)) return this.stamp(row.payload, built);
        void this.rebuild(key, tier, load).catch(() => undefined);          // past its time: show it now, work it out again behind
        return this.stamp(row.payload, built, true);
      }
    }
    const built = await this.rebuild(key, tier, load);
    return this.stamp(built.value, built.at);
  }

  /** forget the figures whose key starts with a prefix (after a change they depend on); no prefix forgets all */
  async clear(prefix = '') {
    if (this.off) return;
    try { await this.manager.query(`delete from dashboard_cache where key like $1 escape '\\'`, [prefix.replace(/[\\%_]/g, '\\$&') + '%']); }
    catch (e: any) { this.down(e); }
  }

  /** keep the figures (they stay on show) but have them worked out again on their next open */
  async markStale(tier?: Tier) {
    if (this.off) return;
    try { await this.manager.query(`update dashboard_cache set stale = true where ($1::text is null or tier = $1)`, [tier ?? null]); }
    catch (e: any) { this.down(e); }
  }

  private rebuild<T>(key: string, tier: Tier, load: () => Promise<T>): Promise<{ value: T; at: number }> {
    const running = this.running.get(key);
    if (running) return running;
    const p = (async () => {
      const value = await load();
      let at = Date.now();
      try {
        const json = JSON.stringify(value);
        if (json.length <= MAX_PAYLOAD) {
          // the time kept with the figure is the one the next open will show, so this reply carries the same one
          const [saved] = await this.manager.query(
            `insert into dashboard_cache (key, tier, payload, built_at, stale) values ($1, $2, $3::jsonb, now(), false)
             on conflict (key) do update set tier = excluded.tier, payload = excluded.payload, built_at = now(), stale = false
             returning built_at`, [key, tier, json]);
          if (saved?.built_at) at = new Date(saved.built_at).getTime();
        }
      } catch (e: any) { this.down(e); }
      return { value, at };
    })().finally(() => this.running.delete(key));
    this.running.set(key, p);
    return p;
  }

  /** the result as the page receives it: plain data, with when it was worked out */
  private stamp<T>(value: T, builtAt: number, refreshing = false): T & Stamped {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value as any;
    const plain: any = JSON.parse(JSON.stringify(value));
    plain.asOf = new Date(builtAt).toISOString();
    if (refreshing) plain.refreshing = true;
    return plain;
  }

  private down(e: any) {
    this.downUntil = Date.now() + 60_000;
    this.log.warn(`The dashboard cache is not used for a minute: ${String(e?.message || e).slice(0, 160)}`);
  }
}
