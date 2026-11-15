import { ServiceUnavailableException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * Short-lived cache for the dashboard's heavy figures. A figure is worked out once per key within the time to live, and several requests for the same
 * key that arrive together share one run (so ten people opening the dashboard at 9 am cost one query, not ten). A failure is never kept. The key must
 * carry everything the figure depends on: who may see what (business, role, stores) and the parameters.
 */
export class TtlCache {
  private readonly done = new Map<string, { at: number; value: any }>();
  private readonly running = new Map<string, Promise<any>>();

  constructor(private readonly ttlMs: number, private readonly max = 300) {}

  async get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.done.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value as T;
    const shared = this.running.get(key);
    if (shared) return shared as Promise<T>;
    const p = load().then((value) => {
      if (this.done.size >= this.max) this.done.delete(this.done.keys().next().value as string);
      this.done.set(key, { at: Date.now(), value });
      return value;
    }).finally(() => this.running.delete(key));
    this.running.set(key, p);
    return p;
  }

  /** forget everything, or what starts with a prefix (after a change the figures depend on) */
  clear(prefix = '') {
    for (const k of Array.from(this.done.keys())) if (!prefix || k.startsWith(prefix)) this.done.delete(k);
  }
}

/** a cache key from the parts that decide a figure */
export const cacheKey = (...parts: any[]): string => parts.map((p) => (Array.isArray(p) ? p.slice().sort().join(',') : p === null || p === undefined ? '-' : String(p))).join('|');

/**
 * Runs a heavy read with a time limit in the database, so a slow figure fails by itself instead of holding a connection and slowing the whole app.
 * The limit applies only to this transaction. A timeout is turned into a plain message.
 */
export async function heavy<T>(manager: EntityManager, ms: number, work: (tx: EntityManager) => Promise<T>): Promise<T> {
  try {
    return await manager.transaction(async (tx) => {
      await tx.query(`set local statement_timeout = ${Math.max(1000, Math.floor(ms))}`);
      return work(tx);
    });
  } catch (e: any) {
    if (e?.code === '57014' || /statement timeout/i.test(String(e?.message))) {
      throw new ServiceUnavailableException('That took too long to work out. Try again in a minute, or choose a shorter period.');
    }
    throw e;
  }
}
