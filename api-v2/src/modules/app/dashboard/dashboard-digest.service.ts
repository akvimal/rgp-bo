import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { EntityManager } from 'typeorm';
import { businessOfUser } from 'src/core/business-of-user';
import { OWNER_ROLES } from 'src/core/roles';
import { ShiftDigestService } from '../messaging/shift-digest.service';
import { DashboardFindingsService } from './dashboard-findings.service';
import { DashboardFinanceService } from './dashboard-finance.service';
import { DashboardStockService } from './dashboard-stock.service';
import { DigestFacts, financeDigest } from './finance-digest';

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const shiftMonth = (ym: string, by: number) => { const t = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + by; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The owner's Monday message: health status and what to fix first, last month's sales, running cost and estimated profit, costs above their usual share,
 * and the stock problems. Sent through Telegram to the owners who connected it (the outbox), on Mondays at 8:15 India time unless switched off
 * (app_setting `dashboard.digest_telegram` = off). E-mail is not sent: the app has no mail sender yet; the same text is returned as HTML for it.
 */
@Injectable()
export class DashboardDigestService {
  private readonly log = new Logger(DashboardDigestService.name);

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly findings: DashboardFindingsService,
    private readonly finance: DashboardFinanceService,
    private readonly stock: DashboardStockService,
    private readonly digest: ShiftDigestService,
  ) {}

  private async assertOwner(user: any) {
    const [r] = await this.manager.query(`select r.name from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [user?.id]);
    if (!OWNER_ROLES.includes(r?.name)) throw new ForbiddenException('The weekly digest is for the owner.');
  }

  /** the week's facts, read as this owner (so the scope and the rules are the ones the dashboard uses) */
  async facts(user: any): Promise<DigestFacts> {
    const businessId = await businessOfUser(this.manager, user.id);
    const f: any = await this.findings.findings(user, null);
    const [biz] = businessId ? await this.manager.query(`select name from business where id = $1`, [businessId]) : [];
    const [last] = businessId
      ? await this.manager.query(`select score from health_snapshot where business_id = $1 and store_id = 0 and area = 'all' and snap_date <= current_date - 7 order by snap_date desc limit 1`, [businessId])
      : [];

    const prev = shiftMonth(istToday().slice(0, 7), -1);
    let month: DigestFacts['month'] = null;
    let costFlags: string[] = [];
    try {
      const m: any = await this.finance.matrix(user, { from: prev, to: prev, compare: 'prev' });
      month = {
        label: `${MONTHS[+prev.slice(5, 7) - 1]} ${prev.slice(0, 4)}`, sales: m.summary.sales.total, runningCost: m.summary.runningCost.total, runningPct: m.summary.runningCost.pct,
        profit: m.summary.profit ? m.summary.profit.total : null, salesChange: m.summary.sales.change,
      };
    } catch (e: any) { this.log.warn(`digest month figures left out: ${e?.message}`); }
    try { costFlags = ((await this.finance.trend(user, {})) as any).notes.filter((n: string) => !n.startsWith('Not enough')); } catch (e: any) { this.log.warn(`digest cost flags left out: ${e?.message}`); }
    let stock: DigestFacts['stock'] = null;
    try { const s: any = await this.stock.value(user, null); stock = { total: s.total, expired: s.expired, expiring30: s.expiring30, dead: s.dead.value }; } catch (e: any) { this.log.warn(`digest stock left out: ${e?.message}`); }

    return {
      businessName: biz?.name,
      health: { score: f.score, status: f.status, counts: f.counts, fixFirst: (f.fixFirst || []).map((x: any) => ({ title: x.title, severity: x.severity, amount: x.amount, store: x.store, recovers: x.recovers })), newThisWeek: f.newThisWeek || 0, lastWeekScore: last ? Number(last.score) : null },
      month, stock, costFlags,
    };
  }

  /** what would be sent, as text and HTML (owner only) */
  async preview(user: any) {
    await this.assertOwner(user);
    return financeDigest(await this.facts(user));
  }

  /** sends it to the owners of the business now; a manual send replaces the one already queued for today */
  async send(user: any): Promise<{ queued: number }> {
    await this.assertOwner(user);
    const businessId = await businessOfUser(this.manager, user.id);
    return { queued: await this.queue(user, businessId, true) };
  }

  private async queue(user: any, businessId: number | null, replace: boolean): Promise<number> {
    const d = financeDigest(await this.facts(user));
    const today = istToday();
    return this.digest.queueToManagers({ businessId, storeId: 0, kind: 'FINANCE_DIGEST', refType: 'week', refId: Number(today.replace(/-/g, '')), title: d.title, body: d.body, replace });
  }

  private async switchedOn(): Promise<boolean> {
    const [s] = await this.manager.query(`select setting_value from app_setting where setting_key = 'dashboard.digest_telegram' and active and not archive`);
    return String(s?.setting_value ?? 'on').toLowerCase() !== 'off';
  }

  /** Mondays at 8:15 in India, after the older weekly summary at 8:00 */
  @Cron('0 15 8 * * 1', { timeZone: 'Asia/Kolkata' })
  async mondayTimer() {
    try {
      if (!(await this.switchedOn())) return;
      const businesses = await this.manager.query(`select id from business where active and not archive`);
      const owners = await this.manager.query(
        `select u.id from app_user u join app_role r on r.id = u.role_id where r.name = any($1::text[]) and u.active and not u.archive order by u.id`, [OWNER_ROLES]);
      for (const b of businesses) {
        for (const o of owners) {
          if ((await businessOfUser(this.manager, o.id)) !== b.id) continue;
          await this.queue({ id: o.id }, b.id, false);
          break;
        }
      }
    } catch (e: any) { this.log.warn(`The Monday money digest was not sent: ${e?.message}`); }
  }
}
