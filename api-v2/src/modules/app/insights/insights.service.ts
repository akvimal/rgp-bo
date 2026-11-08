import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser } from 'src/core/business-of-user';
import { AiProvider } from '../alerts/ai-provider';
import { resolveModel } from '../alerts/ai-models';
import { ShiftDigestService } from '../messaging/shift-digest.service';
import { InsightsData, REPORT_INFO, REPORT_KEYS, StoreScope } from './insights-data.service';
import {
  Brief, CoachingFacts, Narrative, PERIODS, PERIOD_LABELS, ReorderLine, RiskLine, addDays, change, cleanBrief, cleanCoaching, cleanNarrative, clip, list, periodRange, plainBrief,
  plainCoaching, plainWeekly, rupees, weekBounds,
} from './insights-rules';

const SYSTEM_BASE = `You help the owner of a small retail business (usually a pharmacy in India) understand their shop.
Use plain words an Indian shopkeeper would use. Be short and specific. Use only the facts you are given; never invent a figure, a name or a cause.
Amounts are in rupees. Always answer by calling the tool.`;

const ASK_TOOL = {
  name: 'answer_question',
  description: 'Choose the report that answers the question, with its period.',
  input_schema: {
    type: 'object',
    properties: {
      report: { type: 'string', enum: [...REPORT_KEYS, 'none'], description: 'The report that answers the question, or none when no report can.' },
      period: { type: 'string', enum: [...PERIODS], description: 'The period asked about. Use last_30_days when the question names none.' },
      limit: { type: 'integer', description: 'How many rows to show for a list (for example "top 5"). Default 10.' },
      days: { type: 'integer', description: 'For expiring_stock and dead_stock: the number of days asked about.' },
      understood: { type: 'string', description: 'The question restated in one short sentence, as the report will answer it.' },
      reason: { type: 'string', description: 'When report is none: why, and which report is the nearest.' },
    },
    required: ['report', 'understood'],
  },
};

const WEEKLY_TOOL = {
  name: 'write_weekly_summary',
  description: 'Write the short weekly summary for the owner.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One sentence on how the week went.' },
      wins: { type: 'array', items: { type: 'string' }, description: 'Up to 4 things that went well, each one sentence with its figure.' },
      watch: { type: 'array', items: { type: 'string' }, description: 'Up to 5 things that need attention, each one sentence with its figure.' },
      do_first: { type: 'array', items: { type: 'string' }, description: 'Up to 3 actions for this week, most important first, each starting with a verb.' },
    },
    required: ['headline', 'wins', 'watch', 'do_first'],
  },
};

const COACH_TOOL = {
  name: 'write_coaching_note',
  description: 'Write a coaching note for a manager to talk through with one staff member.',
  input_schema: {
    type: 'object',
    properties: {
      strengths: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things that went well, each with its figure.' },
      focus: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things to work on, kind and specific, each with its figure.' },
      tips: { type: 'array', items: { type: 'string' }, description: 'One practical thing to try for each focus.' },
      talk_points: { type: 'array', items: { type: 'string' }, description: 'Up to 3 things for the manager to say or ask in the conversation.' },
    },
    required: ['strengths', 'focus', 'tips', 'talk_points'],
  },
};

const BRIEF_TOOL = {
  name: 'write_buying_brief',
  description: 'Write a short buying brief for the owner.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string' },
      buy_first: { type: 'array', items: { type: 'string' }, description: 'Up to 6 products to order first, with the reason.' },
      clear: { type: 'array', items: { type: 'string' }, description: 'Up to 6 batches to return or discount, with what to do.' },
      watch_out: { type: 'array', items: { type: 'string' }, description: 'Up to 3 cautions, such as a slow mover that is on the reorder list.' },
    },
    required: ['headline', 'buy_first', 'clear'],
  },
};

const ymd = (d: string) => Number(d.replace(/-/g, ''));
const day = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The insight features: ask the shop a question, the weekly owner summary, staff coaching notes and the buying brief. Every figure is computed here; the assistant only picks a report or words the figures. */
@Injectable()
export class InsightsService {
  private readonly log = new Logger(InsightsService.name);

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly data: InsightsData,
    private readonly ai: AiProvider,
    private readonly audit: AuditService,
    private readonly digest: ShiftDigestService,
  ) {}

  /** the model for a job when the assistant is switched on and has a model, else null (the plain version is used) */
  private async modelFor(task: string): Promise<string | null> {
    if (!this.ai.configured) return null;
    const m = await resolveModel(this.manager, this.ai, task);
    return m || null;
  }

  private async setting(key: string, dflt: string): Promise<string> {
    const [s] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive`, [key]);
    return String(s?.setting_value ?? dflt).toLowerCase();
  }

  // ------------------------------------------------------------------------------------------------ ask the shop
  async catalogue(user: any) {
    const sc = await this.data.scope(user);
    const reports = REPORT_KEYS.filter((k) => sc.owner || !REPORT_INFO[k].ownerOnly).map((k) => ({ key: k, ...REPORT_INFO[k] }));
    return { reports, periods: PERIODS.map((p) => ({ key: p, label: PERIOD_LABELS[p] })), assistant: !!(await this.modelFor('answer_question')) };
  }

  /** runs one report (no assistant needed): the buttons and the answer to a typed question both come here */
  async runReport(user: any, b: { report?: any; period?: any; limit?: any; days?: any }) {
    const sc = await this.data.scope(user);
    const key = String(b?.report || '');
    const info = REPORT_INFO[key];
    if (!info || !(REPORT_KEYS as readonly string[]).includes(key)) throw new BadRequestException('Choose one of the reports.');
    if (info.ownerOnly && !sc.owner) throw new ForbiddenException('Only the Business Head can see this report.');
    const today = await this.data.today();
    const p = periodRange(String(b?.period || 'last_30_days'), today) || periodRange('last_30_days', today)!;
    const limit = Math.min(50, Math.max(1, Math.round(Number(b?.limit) || 10)));
    const days = Math.min(365, Math.max(1, Math.round(Number(b?.days) || (key === 'expiring_stock' ? 60 : 90))));
    const res = await this.data.run(key, { from: p.from, to: p.to, limit, days, stores: sc.stores });
    if (!res) throw new BadRequestException('Choose one of the reports.');
    return { report: key, label: info.label, period: info.periodic ? { label: p.label, from: p.from, to: addDays(p.to, -1) } : null, days: info.periodic ? null : days, ...res };
  }

  async ask(user: any, question: any) {
    const sc = await this.data.scope(user);
    const q = clip(question, 300);
    if (q.length < 3) throw new BadRequestException('Type your question.');
    const model = await this.modelFor('answer_question');
    if (!model) throw new ServiceUnavailableException('Typing a question needs the assistant, which the Business Head switches on under Settings > AI assistant. You can still use the report buttons.');
    const today = await this.data.today();
    const catalogue = REPORT_KEYS.filter((k) => sc.owner || !REPORT_INFO[k].ownerOnly).map((k) => `- ${k}: ${REPORT_INFO[k].what}${REPORT_INFO[k].periodic ? ' (takes a period)' : ' (takes days)'}`).join('\n');
    const out = await this.ai.call(
      `${SYSTEM_BASE}\nYou do not answer questions yourself. You choose which report answers the question and for which period; the shop then runs it.\nToday is ${today} (India). Weeks run Monday to Sunday.\nReports:\n${catalogue}\nIf no report can answer, choose none.`,
      `Question: ${q}`, ASK_TOOL, model, 400);
    const report = String(out?.report || 'none');
    const understood = clip(out?.understood, 200);
    if (report === 'none' || !(REPORT_KEYS as readonly string[]).includes(report) || (REPORT_INFO[report].ownerOnly && !sc.owner)) {
      return { answered: false, understood, reason: clip(out?.reason, 300) || 'No report can answer that. Try one of the report buttons.' };
    }
    const res = await this.runReport(user, { report, period: out?.period, limit: out?.limit, days: out?.days });
    return { answered: true, understood, ...res };
  }

  // ------------------------------------------------------------------------------------------------ the buying brief
  async buyingBrief(user: any, body: any) {
    const sc = await this.data.scope(user);
    const reorder: ReorderLine[] = (Array.isArray(body?.reorder) ? body.reorder : []).slice(0, 40).map((r: any) => ({
      title: clip(r?.title, 80), qty: Math.max(0, Math.round(Number(r?.final_qty ?? r?.qty) || 0)),
      daysLeft: r?.stock_days_left === null || r?.stock_days_left === undefined || !Number.isFinite(Number(r.stock_days_left)) ? null : Math.round(Number(r.stock_days_left)), reasons: list(r?.reasons, 6, 30),
    })).filter((r: ReorderLine) => r.title);
    const risk = await this.data.expiryRisk(sc.stores, 180, 12);
    const riskLines: RiskLine[] = risk.rows.slice(0, 10).map((r: any) => ({ product: r.product, unsold: r.unsold, value: r.value, daysLeft: r.days_left, action: r.action }));
    const plain = plainBrief(reorder, riskLines);
    const model = await this.modelFor('write_buying_brief');
    if (!model || (!reorder.length && !riskLines.length)) return { ...plain, source: 'plain', risk: risk.rows.slice(0, 12), riskTotal: risk.totalValue };
    let brief: Brief = plain;
    try {
      const out = await this.ai.call(
        `${SYSTEM_BASE}\nYou write a buying brief: which products to order first, and which stock to return to the vendor or discount before it expires. Name products as given.`,
        `Reorder list (qty to order, days of stock left, reasons):\n${JSON.stringify(reorder)}\n\nStock that will not sell before it expires (units that will be left, value at cost, days left, suggested action):\n${JSON.stringify(riskLines)}`,
        BRIEF_TOOL, model, 900);
      brief = cleanBrief(out, plain);
    } catch (e: any) { this.log.warn(`Buying brief by the assistant failed: ${e?.message}`); }
    return { ...brief, source: brief === plain ? 'plain' : 'assistant', risk: risk.rows.slice(0, 12), riskTotal: risk.totalValue };
  }

  async expiryRisk(user: any, q: any) {
    const sc = await this.data.scope(user);
    const horizon = Math.min(365, Math.max(30, Math.round(Number(q?.days) || 180)));
    const r = await this.data.expiryRisk(sc.stores, horizon, 100);
    return { days: horizon, batches: r.batches, totalValue: r.totalValue, rows: r.rows };
  }

  // ------------------------------------------------------------------------------------------------ the weekly summary
  private async owner(user: any) {
    const sc = await this.data.scope(user);
    if (!sc.owner) throw new ForbiddenException('Only the Business Head can use this.');
    return sc;
  }

  private shape(r: any) {
    return r && { id: r.id, week_start: r.week_start, week_end: r.week_end, facts: r.facts, headline: r.headline, wins: r.wins, watch: r.watch, do_first: r.do_first, source: r.source, created_on: r.created_on, sent_on: r.sent_on, sent_to: r.sent_to };
  }

  private static readonly SUMMARY_COLUMNS = `id, to_char(week_start, 'YYYY-MM-DD') as week_start, to_char(week_end, 'YYYY-MM-DD') as week_end, facts, headline, wins, watch, do_first, source, created_on, sent_on, sent_to`;

  async weeklyList(user: any) {
    await this.owner(user);
    const rows = await this.manager.query(`select ${InsightsService.SUMMARY_COLUMNS} from weekly_summary order by week_start desc limit 12`);
    return { telegram: (await this.setting('insights.weekly_telegram', 'on')) !== 'off', assistant: !!(await this.modelFor('write_weekly_summary')), items: rows.map((r: any) => this.shape(r)) };
  }

  async setWeeklyTelegram(user: any, on: boolean) {
    await this.owner(user);
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, description, created_by, updated_by) values ('insights', 'insights.weekly_telegram', $1, 'Send the weekly summary to the owner on Telegram every Monday', $2, $2)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [on ? 'on' : 'off', user.id]);
    return this.weeklyList(user);
  }

  /** builds the summary of the last full week (a person asking, or the Monday timer); a week already made is kept unless `force` */
  async generateWeekly(user: any | null, opts: { force?: boolean } = {}) {
    if (user) await this.owner(user);
    const today = await this.data.today();
    const w = weekBounds(today);
    const [have] = await this.manager.query(`select ${InsightsService.SUMMARY_COLUMNS} from weekly_summary where week_start = $1::date`, [w.start]);
    if (have && !opts.force) return this.shape(have);
    const facts = await this.data.weekly(w, null);
    const plain = plainWeekly(facts);
    let n: Narrative = plain;
    let source = 'plain';
    const model = await this.modelFor('write_weekly_summary');
    if (model && facts.sales.bills + facts.sales.prevBills > 0) {
      try {
        // no staff names leave the server: only the figures
        const { topStaff, ...safe } = facts as any;
        const out = await this.ai.call(
          `${SYSTEM_BASE}\nYou write the weekly summary the owner reads on Monday morning: how the week went, what went well, what needs attention, and what to do first. Mention a figure with each point. Do not repeat the same point twice.`,
          `The shop's figures for the week ${facts.week.start} to ${facts.week.end} (money in rupees; "prev" is the week before):\n${JSON.stringify({ ...safe, staffServed: topStaff.length })}`, WEEKLY_TOOL, model, 900);
        n = cleanNarrative(out, plain);
        source = n === plain ? 'plain' : 'assistant';
      } catch (e: any) { this.log.warn(`Weekly summary by the assistant failed: ${e?.message}`); }
    }
    const [row] = await this.manager.query(
      `insert into weekly_summary (week_start, week_end, facts, headline, wins, watch, do_first, source, created_by) values ($1::date, $2::date, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
       on conflict (week_start) do update set facts = excluded.facts, headline = excluded.headline, wins = excluded.wins, watch = excluded.watch, do_first = excluded.do_first, source = excluded.source, created_on = now(), created_by = excluded.created_by, sent_on = null, sent_to = 0
       returning ${InsightsService.SUMMARY_COLUMNS}`,
      [w.start, w.end, JSON.stringify(facts), n.headline, JSON.stringify(n.wins), JSON.stringify(n.watch), JSON.stringify(n.doFirst), source, user?.id ?? null]);
    if (user) await this.audit.record({ userId: user.id, action: 'insights.weekly_made', summary: `weekly summary made for ${w.start} to ${w.end} (${source})`, details: { week: w.start, source, forced: !!opts.force } });
    return this.shape(row);
  }

  /** the summary as a Telegram message */
  weeklyText(s: { week_start: string; week_end: string; headline: string; wins: string[]; watch: string[]; do_first: string[] }): { title: string; body: string } {
    const lines: string[] = [s.headline, ''];
    if (s.wins.length) { lines.push('Went well:'); s.wins.forEach((x) => lines.push(`• ${x}`)); lines.push(''); }
    if (s.watch.length) { lines.push('Watch:'); s.watch.forEach((x) => lines.push(`• ${x}`)); lines.push(''); }
    if (s.do_first.length) { lines.push('Do first:'); s.do_first.forEach((x, i) => lines.push(`${i + 1}. ${x}`)); }
    return { title: `Weekly summary, ${day(s.week_start)} to ${day(s.week_end)}`, body: lines.join('\n').trim().slice(0, 3800) };
  }

  /** sends the week's summary to the owners who connected Telegram; returns how many it was queued for */
  async sendWeekly(user: any | null, id?: number, businessId?: number | null): Promise<{ sent: number }> {
    if (user) await this.owner(user);
    const [row] = await this.manager.query(`select ${InsightsService.SUMMARY_COLUMNS} from weekly_summary ${id ? 'where id = $1' : 'order by week_start desc limit 1'}`, id ? [id] : []);
    if (!row) throw new NotFoundException('There is no summary to send yet.');
    const biz = businessId ?? (user ? await businessOfUser(this.manager, user.id) : null);
    const t = this.weeklyText(row);
    // store 0: only the owners (a store head is held to the stores they work in)
    const sent = await this.digest.queueToManagers({ businessId: biz, storeId: 0, kind: 'WEEKLY_SUMMARY', refType: 'week', refId: ymd(row.week_start), title: t.title, body: t.body, replace: !!user });
    await this.manager.query(`update weekly_summary set sent_on = now(), sent_to = $2 where id = $1`, [row.id, sent]);
    return { sent };
  }

  /** every Monday at 8 in the morning (India time): make last week's summary and send it to the owners on Telegram, unless the owner switched that off */
  @Cron('0 8 * * 1', { timeZone: 'Asia/Kolkata' })
  async mondayTimer() {
    try {
      if ((await this.setting('insights.weekly_telegram', 'on')) === 'off') return;
      const s = await this.generateWeekly(null);
      const businesses = await this.manager.query(`select id from business where active and not archive`);
      for (const b of businesses) await this.sendWeekly(null, s.id, b.id);
    } catch (e: any) { this.log.warn(`The Monday summary was not sent: ${e?.message}`); }
  }

  // ------------------------------------------------------------------------------------------------ staff coaching
  private async people(sc: { owner: boolean; stores: StoreScope }, period: string) {
    return this.manager.query(
      `select e.id, e.full_name as name, e.designation, coalesce(pos.name, e.designation) as role, e.user_id,
              n.id as note_id, coalesce(n.shared, false) as shared, n.source, k.percent::float8 as percent
         from hr_employee e left join hr_position pos on pos.id = e.position_id
         left join hr_coaching_note n on n.employee_id = e.id and n.period = $1
         left join hr_kpi_review k on k.employee_id = e.id and k.period = $1
        where e.status = 'ACTIVE' and e.on_payroll and ($2::int[] is null or e.store_id = any($2::int[])) order by e.full_name`, [period, sc.stores]);
  }

  private period(p: any, today: string): string {
    const v = String(p || '');
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
    const d = new Date(today.slice(0, 8) + '01T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  }

  async coachingPeople(user: any, q: any) {
    const sc = await this.data.scope(user);
    const period = this.period(q?.period, await this.data.today());
    return { period, assistant: !!(await this.modelFor('write_coaching_note')), people: (await this.people(sc, period)).map((p: any) => ({ id: p.id, name: p.name, role: p.role, percent: p.percent, has_note: !!p.note_id, shared: p.shared, source: p.source })) };
  }

  private async employeeIn(sc: { stores: StoreScope }, id: number) {
    const [e] = await this.manager.query(
      `select e.id, e.user_id, e.full_name as name, coalesce(pos.name, e.designation) as role, e.position_id, e.store_id from hr_employee e left join hr_position pos on pos.id = e.position_id where e.id = $1`, [id]);
    if (!e) throw new NotFoundException('Staff member not found.');
    if (sc.stores !== null && !sc.stores.includes(e.store_id)) throw new ForbiddenException('You can only see the staff of your own stores.');
    return e;
  }

  /** the figures a coaching note is made from, for one person and month */
  async coachingFacts(e: { id: number; user_id: number | null; role: string | null; position_id: number | null }, period: string): Promise<CoachingFacts> {
    const start = `${period}-01`;
    const prevStart = (() => { const d = new Date(start + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
    const prevPeriod = prevStart.slice(0, 7);
    const [k] = await this.manager.query(`select percent::float8 as percent, band_label, scores from hr_kpi_review where employee_id = $1 and period = $2`, [e.id, period]);
    const [kp] = await this.manager.query(`select percent::float8 as percent from hr_kpi_review where employee_id = $1 and period = $2`, [e.id, prevPeriod]);
    const [team] = await this.manager.query(
      `select round(avg(k.percent)::numeric, 1)::float8 as avg from hr_kpi_review k join hr_employee x on x.id = k.employee_id where k.period = $1 and x.id <> $2 and (x.position_id is not distinct from $3)`, [period, e.id, e.position_id]);
    const att = async (from: string) => (await this.manager.query(
      `select count(*) filter (where status = 'PRESENT')::int as present, count(*) filter (where 'LATE' = any(flags))::int as late, count(*) filter (where 'EARLY_OUT' = any(flags))::int as early_out
         from hr_attendance where employee_id = $1 and att_date >= $2::date and att_date < ($2::date + interval '1 month')`, [e.id, from]))[0];
    const a0 = await att(start), a1 = await att(prevStart);
    let sales: CoachingFacts['sales'] = null;
    if (e.user_id) {
      const s = async (from: string) => (await this.manager.query(
        `select count(*)::int as bills, coalesce(sum(total), 0)::float8 as value from sale where status = 'COMPLETE' and active and not archive and coalesce(acting_user_id, created_by) = $1 and bill_date >= $2::date and bill_date < ($2::date + interval '1 month')`, [e.user_id, from]))[0];
      const s0 = await s(start), s1 = await s(prevStart);
      const [t] = await this.manager.query(
        `select round(avg(c)::numeric, 0)::float8 as avg from (select count(*) as c from sale where status = 'COMPLETE' and active and not archive and bill_date >= $1::date and bill_date < ($1::date + interval '1 month') group by coalesce(acting_user_id, created_by)) x`, [start]);
      if (s0.bills + s1.bills > 0) sales = { bills: s0.bills, value: s0.value, prevBills: s1.bills, prevValue: s1.value, teamAvgBills: t?.avg ?? null };
    }
    const [lv] = await this.manager.query(
      `select coalesce(sum(days), 0)::float8 as d from hr_leave_request where employee_id = $1 and status = 'APPROVED' and from_date >= $2::date and from_date < ($2::date + interval '1 month')`, [e.id, start]);
    return {
      period, role: e.role,
      kpi: k ? { percent: k.percent, band: k.band_label, prevPercent: kp?.percent ?? null, teamAvg: team?.avg ?? null, measures: (Array.isArray(k.scores) ? k.scores : []).map((m: any) => ({ name: clip(m.name, 60), points: Number(m.points) || 0, max: Number(m.max) || 0 })) } : null,
      attendance: { present: a0.present, late: a0.late, earlyOut: a0.early_out, prevPresent: a1.present },
      sales, leaveDays: lv.d,
    };
  }

  private noteShape(n: any) { return n && { id: n.id, period: n.period, strengths: n.strengths, focus: n.focus, tips: n.tips, talk_points: n.talk_points, source: n.source, shared: n.shared, shared_on: n.shared_on, updated_on: n.updated_on }; }

  async coaching(user: any, employeeId: number, q: any) {
    const sc = await this.data.scope(user);
    const e = await this.employeeIn(sc, employeeId);
    const period = this.period(q?.period, await this.data.today());
    const [n] = await this.manager.query(`select * from hr_coaching_note where employee_id = $1 and period = $2`, [e.id, period]);
    return { employee: { id: e.id, name: e.name, role: e.role }, period, facts: await this.coachingFacts(e, period), note: this.noteShape(n) || null, assistant: !!(await this.modelFor('write_coaching_note')) };
  }

  /** writes (or rewrites) the note from the figures; saved unshared, for the manager to read and edit */
  async draftCoaching(user: any, employeeId: number, body: any) {
    const sc = await this.data.scope(user);
    const e = await this.employeeIn(sc, employeeId);
    const period = this.period(body?.period, await this.data.today());
    const facts = await this.coachingFacts(e, period);
    const plain = plainCoaching(facts);
    let c = plain;
    let source = 'plain';
    const model = await this.modelFor('write_coaching_note');
    if (model && (facts.kpi || facts.sales || facts.attendance.present)) {
      try {
        // no name or number of the person leaves the server: the role and the figures only
        const out = await this.ai.call(
          `${SYSTEM_BASE}\nYou write a coaching note for a shop manager to talk through with one staff member. Be kind, specific and fair: start from what went well, name one or two things to work on, give one small practical thing to try for each, and suggest how to open the conversation. Never blame; never mention pay or dismissal; never guess at the person's reasons or life.`,
          `Figures for one ${facts.role || 'staff member'} for ${period} ("prev" is the month before; "team" is the average of the others in the same role):\n${JSON.stringify(facts)}`, COACH_TOOL, model, 900);
        c = cleanCoaching(out, plain);
        source = c === plain ? 'plain' : 'assistant';
      } catch (err: any) { this.log.warn(`Coaching note by the assistant failed: ${err?.message}`); }
    }
    const [row] = await this.manager.query(
      `insert into hr_coaching_note (employee_id, period, facts, strengths, focus, tips, talk_points, source, shared, created_by, updated_by) values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, false, $9, $9)
       on conflict (employee_id, period) do update set facts = excluded.facts, strengths = excluded.strengths, focus = excluded.focus, tips = excluded.tips, talk_points = excluded.talk_points, source = excluded.source,
         shared = false, shared_on = null, updated_on = now(), updated_by = excluded.updated_by returning *`,
      [e.id, period, JSON.stringify(facts), JSON.stringify(c.strengths), JSON.stringify(c.focus), JSON.stringify(c.tips), JSON.stringify(c.talk), source, user.id]);
    await this.audit.record({ userId: user.id, action: 'insights.coaching_drafted', entityType: 'hr_employee', entityId: e.id, summary: `coaching note drafted for ${e.name}, ${period} (${source})`, details: { period, source } });
    return { employee: { id: e.id, name: e.name, role: e.role }, period, facts, note: this.noteShape(row), assistant: !!model };
  }

  /** the manager's edits, and whether the person may read it */
  async saveCoaching(user: any, employeeId: number, body: any) {
    const sc = await this.data.scope(user);
    const e = await this.employeeIn(sc, employeeId);
    const period = this.period(body?.period, await this.data.today());
    const [have] = await this.manager.query(`select * from hr_coaching_note where employee_id = $1 and period = $2`, [e.id, period]);
    if (!have) throw new BadRequestException('Write the note first.');
    const strengths = list(body?.strengths, 6, 400), focus = list(body?.focus, 6, 400), tips = list(body?.tips, 6, 400), talk = list(body?.talk_points, 6, 400);
    if (!strengths.length && !focus.length) throw new BadRequestException('A note needs at least one point.');
    const shared = body?.shared === true;
    const res = await this.manager.query(
      `update hr_coaching_note set strengths = $3::jsonb, focus = $4::jsonb, tips = $5::jsonb, talk_points = $6::jsonb, shared = $7, shared_on = case when $7 and not shared then now() when not $7 then null else shared_on end,
              source = case when source = 'assistant' then 'edited' else source end, updated_on = now(), updated_by = $8 where employee_id = $1 and period = $2 returning *`,
      [e.id, period, JSON.stringify(strengths), JSON.stringify(focus), JSON.stringify(tips), JSON.stringify(talk), shared, user.id]);
    const row = (Array.isArray(res[0]) ? res[0] : res)[0];                     // an UPDATE ... RETURNING comes back as [rows, count]
    await this.audit.record({ userId: user.id, action: shared && !have.shared ? 'insights.coaching_shared' : 'insights.coaching_saved', entityType: 'hr_employee', entityId: e.id, summary: `${shared ? 'shared' : 'saved'} the coaching note for ${e.name}, ${period}`, details: { period, shared } });
    return this.noteShape(row);
  }

  /** the person's own: the notes a manager chose to share (not the manager's talking points) */
  async myCoaching(user: any) {
    const [emp] = await this.manager.query(`select id from hr_employee where user_id = $1 or id = (select employee_id from hr_employee_account where user_id = $1)`, [user?.id || 0]);
    if (!emp) return { staff: false, notes: [] };
    const notes = await this.manager.query(
      `select period, strengths, focus, tips, shared_on from hr_coaching_note where employee_id = $1 and shared order by period desc limit 6`, [emp.id]);
    return { staff: true, notes };
  }
}
