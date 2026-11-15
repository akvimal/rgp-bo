import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { EntityManager } from 'typeorm';

/** how many recent days the nightly run rebuilds */
export const REFRESH_DAYS = 100;
/** whole months this recent are always read live */
export const LIVE_MONTHS = 3;

/**
 * Where the matrix may read the roll-up instead of the view. Pure so it can be tested: given the roll-up's `through` date, today and the range asked for
 * (both "YYYY-MM-DD", the end exclusive), returns the date before which the roll-up is used (the rest is live), or null to read everything live.
 */
export function rollupCut(through: string | null, today: string, from: string): string | null {
  if (!through) return null;
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const t = y * 12 + (m - 1) - LIVE_MONTHS;
  const monthStart = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;      // the first day of the month three months back
  // the roll-up must reach the day before the cut, and the nightly rebuild window must not start before it
  const dayAfterThrough = new Date(Date.parse(through) + 86400000).toISOString().slice(0, 10);
  const cut = monthStart < dayAfterThrough ? monthStart : dayAfterThrough;
  return cut > from ? cut : null;
}

/** The nightly roll-up of the money stream (migration 202). A failure is logged and leaves the last good roll-up in place. */
@Injectable()
export class DashboardRollupService implements OnApplicationBootstrap {
  private readonly log = new Logger(DashboardRollupService.name);
  private running = false;

  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  /**
   * The first time (the roll-up has never been built) it is built in the background a minute and a half after the app starts, so the financial
   * figures do not read every bill line on each open. Set ROLLUP_AUTOBUILD=off to leave that to the owner's button or the first night.
   */
  onApplicationBootstrap() {
    if (String(process.env.ROLLUP_AUTOBUILD || 'on').toLowerCase() === 'off') return;
    setTimeout(async () => {
      try {
        if (!(await this.through())) await this.refresh(true);
      } catch (e: any) { this.log.warn(`The first roll-up was not built: ${e?.message}`); }
    }, 90_000).unref();
  }

  /** the date the roll-up is complete through, or null when it has never been built */
  async through(): Promise<string | null> {
    try {
      const [s] = await this.manager.query(`select through::text as through from metric_daily_state where id = 1`);
      return s?.through ?? null;
    } catch { return null; }
  }

  /** every night at 1:10 in India: yesterday and the days before it are final */
  @Cron('0 10 1 * * *', { timeZone: 'Asia/Kolkata' })
  async nightly() {
    try { await this.refresh(false); } catch (e: any) { this.log.warn(`The nightly roll-up failed: ${e?.message}`); }
  }

  /**
   * Rebuilds the roll-up through yesterday (India time). The first run, or `full`, rebuilds all history; later runs rebuild the last REFRESH_DAYS days.
   * Done in one transaction, so readers see the old roll-up or the new one.
   */
  async refresh(full: boolean): Promise<{ through: string; rows: number; full: boolean }> {
    if (this.running) throw new Error('The roll-up is already being built.');
    this.running = true;
    try {
      const yesterday = new Date(Date.now() + 5.5 * 3600000 - 86400000).toISOString().slice(0, 10);
      const before = await this.through();
      const everything = full || !before;
      return await this.manager.transaction(async (tx) => {
        if (everything) await tx.query(`delete from metric_daily`);
        else await tx.query(`delete from metric_daily where flow_date >= $1::date - ($2 || ' days')::interval`, [yesterday, String(REFRESH_DAYS)]);
        const res = await tx.query(
          `insert into metric_daily (flow_date, store_id, flow_class, grp, category, amount, gst, entries, unclassified)
           select flow_date, store_id, flow_class, grp, category, sum(amount), sum(gst), count(*)::int, bool_or(unclassified)
             from money_flow
            where flow_date <= $1::date and ($3::boolean or flow_date >= $1::date - ($2 || ' days')::interval)
            group by 1, 2, 3, 4, 5`, [yesterday, String(REFRESH_DAYS), everything]);
        await tx.query(`update metric_daily_state set through = $1::date, built_on = now(), full_on = case when $2::boolean then now() else full_on end where id = 1`, [yesterday, everything]);
        const [n] = await tx.query(`select count(*)::int as n from metric_daily`);
        this.log.log(`Roll-up built through ${yesterday} (${everything ? 'all history' : `last ${REFRESH_DAYS} days`}): ${n.n} rows`);
        return { through: yesterday, rows: n.n, full: everything };
      });
    } finally { this.running = false; }
  }
}
