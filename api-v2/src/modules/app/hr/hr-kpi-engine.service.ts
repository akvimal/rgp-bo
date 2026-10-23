import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** What the system can measure by itself. `direction` says whether a bigger figure is better. */
export const SYSTEM_MEASURES = [
  { key: 'SALES_VALUE', label: 'Sales value', unit: 'Rs', direction: 'higher', hint: 'Completed bills the person made in the month.' },
  { key: 'DISCARDED_BILLS', label: 'Discarded bills', unit: 'bills', direction: 'lower', hint: 'Pending bills the person discarded in the month.' },
  { key: 'CASH_VARIANCE', label: 'Cash short or excess', unit: 'Rs', direction: 'lower', hint: 'Total shortage plus excess on the shifts the person closed.' },
  { key: 'GRIEVANCES', label: 'Grievances about them', unit: 'count', direction: 'lower', hint: 'Customer grievances raised about the person in the month.' },
  { key: 'INQUIRIES_CLOSED', label: 'Customer inquiries closed', unit: 'inquiries', direction: 'higher', hint: 'Inquiries assigned to the person that they closed in the month.' },
  { key: 'INQUIRIES_LATE', label: 'Late or open inquiries', unit: 'inquiries', direction: 'lower', hint: 'Inquiries assigned to the person that were closed after the due date, or are still open past it.' },
  { key: 'AUDITS_DONE', label: 'Stock audits completed', unit: 'audits', direction: 'higher', hint: 'Routine stock audits the person completed in the month.' },
  { key: 'AUDITS_LATE', label: 'Late or overdue stock audits', unit: 'audits', direction: 'lower', hint: 'Stock audits assigned to the person that were finished after the due date, or are still open past it.' },
  { key: 'SUGGESTIONS_ADDED', label: 'Cross-sell / up-sell suggestions taken', unit: 'suggestions', direction: 'higher', hint: 'Suggestions shown at the counter that the person added to a bill in the month.' },
  { key: 'ABSENT_DAYS', label: 'Absent days', unit: 'days', direction: 'lower', hint: 'Marked absent in attendance (a half day counts as 0.5).' },
];
const MEASURE = (key: string) => SYSTEM_MEASURES.find(m => m.key === key);

/** a list of role names from a request body: trimmed, de-duplicated, null when empty (= every role) */
export function roleList(v: any): string[] | null {
  const a = Array.from(new Set((Array.isArray(v) ? v : []).map((x: any) => String(x).trim()).filter(Boolean))).slice(0, 20) as string[];
  return a.length ? a : null;
}

/** the share (0-100) of a measure's points a raw figure earns */
export function pctFor(rule: any, raw: number): number {
  if (rule?.kind === 'steps') {
    for (const s of rule.steps || []) if (raw <= Number(s.upto)) return Number(s.pct);
    return Number(rule.otherwise ?? 0);
  }
  if (rule?.kind === 'linear') {
    const target = Number(rule.target), floor = Number(rule.floor);
    if (target === floor) return 0;
    return Math.max(0, Math.min(1, (raw - floor) / (target - floor))) * 100;
  }
  return 0;
}

/** a rule must make sense for the measure it is attached to */
export function checkRule(key: string, rule: any) {
  const m = MEASURE(key);
  if (!m) throw new BadRequestException('Choose what the system should measure.');
  if (rule?.kind === 'steps') {
    if (m.direction !== 'lower') throw new BadRequestException(`${m.label}: use a target and a floor, since a bigger figure is better.`);
    const steps = Array.isArray(rule.steps) ? rule.steps : [];
    if (!steps.length) throw new BadRequestException('Add at least one step.');
    let prev = -1;
    for (const s of steps) {
      const u = Number(s.upto), p = Number(s.pct);
      if (!Number.isFinite(u) || u < 0) throw new BadRequestException('A step\'s limit must be zero or more.');
      if (!(u > prev)) throw new BadRequestException('Step limits must go up, each larger than the one before.');
      if (!Number.isFinite(p) || p < 0 || p > 100) throw new BadRequestException('A step earns between 0 and 100 per cent of the points.');
      prev = u;
    }
    const o = Number(rule.otherwise ?? 0);
    if (!Number.isFinite(o) || o < 0 || o > 100) throw new BadRequestException('Beyond the last step earns between 0 and 100 per cent.');
    return { kind: 'steps', steps: steps.map((s: any) => ({ upto: Number(s.upto), pct: Number(s.pct) })), otherwise: o };
  }
  if (rule?.kind === 'linear') {
    const t = Number(rule.target), f = Number(rule.floor);
    if (!Number.isFinite(t) || !Number.isFinite(f) || t === f) throw new BadRequestException('Give a target and a floor that differ.');
    if (m.direction === 'higher' && !(t > f)) throw new BadRequestException(`${m.label}: the target must be above the floor.`);
    if (m.direction === 'lower' && !(t < f)) throw new BadRequestException(`${m.label}: the target must be below the floor.`);
    return { kind: 'linear', target: t, floor: f };
  }
  throw new BadRequestException('Choose how the figure turns into points.');
}

/** The month's KPI: system figures and manager ratings turned into points, frozen when finalised. */
@Injectable()
export class HrKpiEngine {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  systemMeasures() { return SYSTEM_MEASURES; }

  private async payrollLocked(period: string) {
    const [paid] = await this.manager.query(`select 1 from hr_payroll_run where period = $1 and status = 'APPROVED'`, [period]);
    return !!paid;
  }

  /** a raw figure for one person, or null when it cannot be judged (no login, no activity) */
  private async raw(key: string, e: any, start: string, minActivity: number): Promise<{ raw: number; evidence: string } | { na: string }> {
    const needsLogin = key !== 'ABSENT_DAYS';
    if (needsLogin && !e.user_id) return { na: 'No login, so the system has nothing to measure' };
    // every login the person uses (their own, plus a counter or sales login linked to the same record)
    const uids: number[] = [e.user_id, ...(e.linked_user_ids || [])];
    const window = `>= $2::date and %s < ($2::date + interval '1 month')`;
    if (key === 'SALES_VALUE' || key === 'DISCARDED_BILLS') {
      const [b] = await this.manager.query(
        `select count(*) filter (where s.status = 'COMPLETE')::int as bills,
                coalesce(sum(s.total) filter (where s.status = 'COMPLETE'), 0)::float as value
           from sale s where coalesce(s.acting_user_id, s.created_by) = any($1::int[]) and s.bill_date >= $2::date and s.bill_date < ($2::date + interval '1 month')`, [uids, start]);
      if (key === 'SALES_VALUE') {
        if (b.bills < minActivity) return { na: `Only ${b.bills} bills; ${minActivity} needed` };
        return { raw: b.value, evidence: `${b.bills} bills, Rs ${Math.round(b.value).toLocaleString('en-IN')}` };
      }
      const [d] = await this.manager.query(
        `select count(*)::int as n from sale s where s.status = 'DISCARDED' and s.updated_by = any($1::int[]) and s.updated_on >= $2::date and s.updated_on < ($2::date + interval '1 month')`, [uids, start]);
      if (b.bills + d.n < minActivity) return { na: `Only ${b.bills + d.n} bills; ${minActivity} needed` };
      return { raw: d.n, evidence: `${d.n} discarded, ${b.bills} completed` };
    }
    if (key === 'CASH_VARIANCE') {
      const [c] = await this.manager.query(
        `select count(*)::int as closed, count(*) filter (where coalesce(sh.variance, 0) <> 0)::int as off,
                coalesce(sum(abs(sh.variance)), 0)::float as total
           from store_shifts sh
          where sh.status = 'CLOSED' and not sh.archive and sh.counted_cash is not null
            and coalesce(sh.closed_operator_id, sh.closed_by, sh.assigned_user_id) = any($1::int[])
            and sh.shift_date >= $2::date and sh.shift_date < ($2::date + interval '1 month')`, [uids, start]);
      if (c.closed === 0 || c.closed < minActivity) return { na: `${c.closed} shifts closed; ${Math.max(minActivity, 1)} needed` };
      return { raw: r2(c.total), evidence: `${c.off} of ${c.closed} shifts off, Rs ${r2(c.total)} in all` };
    }
    if (key === 'GRIEVANCES') {
      const [g] = await this.manager.query(
        `select count(*)::int as n from grievance where about_user_id = any($1::int[]) and created_on >= $2::date and created_on < ($2::date + interval '1 month')`, [uids, start]);
      return { raw: g.n, evidence: `${g.n} grievance${g.n === 1 ? '' : 's'}` };
    }
    if (key === 'INQUIRIES_CLOSED' || key === 'INQUIRIES_LATE') {
      const [q] = await this.manager.query(
        `select count(*) filter (where status = 'CLOSED' and closed_on >= $2::date and closed_on < ($2::date + interval '1 month'))::int as closed,
                count(*) filter (where (status = 'CLOSED' and closed_on::date > due_on and closed_on >= $2::date and closed_on < ($2::date + interval '1 month'))
                                    or (status = 'OPEN' and due_on < current_date and due_on >= $2::date and due_on < ($2::date + interval '1 month')))::int as late,
                count(*) filter (where raised_on >= $2::date and raised_on < ($2::date + interval '1 month') or (status = 'CLOSED' and closed_on >= $2::date and closed_on < ($2::date + interval '1 month')))::int as touched
           from customer_inquiry where assigned_to = any($1::int[])`, [uids, start]);
      if (q.touched < minActivity) return { na: `Only ${q.touched} inquiries; ${minActivity} needed` };
      return key === 'INQUIRIES_CLOSED'
        ? { raw: q.closed, evidence: `${q.closed} closed` }
        : { raw: q.late, evidence: `${q.late} late or overdue of ${q.touched}` };
    }
    if (key === 'AUDITS_DONE' || key === 'AUDITS_LATE') {
      const [a] = await this.manager.query(
        `select count(*) filter (where status = 'DONE' and completed_by = any($1::int[]) and completed_on >= $2::date and completed_on < ($2::date + interval '1 month'))::int as done,
                count(*) filter (where assigned_to = any($1::int[]) and ((status = 'DONE' and completed_on::date > due_on and completed_on >= $2::date and completed_on < ($2::date + interval '1 month'))
                                    or (status in ('PLANNED', 'IN_PROGRESS') and due_on < current_date and due_on < ($2::date + interval '1 month'))))::int as late,
                count(*) filter (where assigned_to = any($1::int[]) and due_on >= $2::date and due_on < ($2::date + interval '1 month'))::int as due
           from stock_audit`, [uids, start]);
      if (a.due + a.done < minActivity) return { na: `Only ${a.due + a.done} audits; ${minActivity} needed` };
      return key === 'AUDITS_DONE' ? { raw: a.done, evidence: `${a.done} completed` } : { raw: a.late, evidence: `${a.late} late or overdue of ${a.due} due` };
    }
    if (key === 'SUGGESTIONS_ADDED') {
      const [g] = await this.manager.query(
        `select count(*) filter (where action = 'ADDED')::int as added, count(*) filter (where action = 'SHOWN')::int as shown
           from sale_suggestion_event where user_id = any($1::int[]) and created_on >= $2::date and created_on < ($2::date + interval '1 month')`, [uids, start]);
      if (g.shown < minActivity) return { na: `Only ${g.shown} suggestions shown; ${minActivity} needed` };
      return { raw: g.added, evidence: `${g.added} taken of ${g.shown} shown` };
    }
    if (key === 'ABSENT_DAYS') {
      const [a] = await this.manager.query(
        `select coalesce(sum(case status when 'ABSENT' then 1 when 'HALF_DAY' then 0.5 else 0 end), 0)::float as d
           from hr_attendance where employee_id = $1 and att_date >= $2::date and att_date < ($2::date + interval '1 month')`, [e.id, start]);
      return { raw: a.d, evidence: `${a.d} day${a.d === 1 ? '' : 's'} absent` };
    }
    return { na: 'Unknown measure' };
  }

  private applies(m: any, e: any) {
    if (m.applies_roles?.length && !m.applies_roles.some((x: string) => x === e.role_name)) return false;
    if (m.applies_types?.length && !m.applies_types.includes(e.emp_type)) return false;
    if (m.applies_designations?.length) {
      const d = String(e.designation || '').trim().toLowerCase();
      if (!m.applies_designations.some((x: string) => String(x).trim().toLowerCase() === d)) return false;
    }
    return true;
  }

  /**
   * Everyone employed in the month with their KPI worked out from the system figures, the manual ratings and any
   * overrides. `only` limits it to some staff. A finalised review is returned as it was frozen.
   */
  async draft(period: string, only?: (e: any) => boolean) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const start = period + '-01';
    const emps = await this.manager.query(
      `select e.id, e.user_id, e.emp_type, e.designation, e.store_id, coalesce(e.full_name, u.full_name) as name,
              (select r.name from app_user x join app_role r on r.id = x.role_id where x.id = e.user_id) as role_name,
              array(select us.store_id from user_stores us where us.user_id = e.user_id and us.active and not us.archive) as store_ids,
              array(select a.user_id from hr_employee_account a where a.employee_id = e.id) as linked_user_ids
         from hr_employee e left join app_user u on u.id = e.user_id
        where e.join_date < ($1::date + interval '1 month') and (e.exit_date is null or e.exit_date >= $1::date)
        order by coalesce(e.full_name, u.full_name)`, [start]);
    const metrics = await this.manager.query(
      `select id, name, description, max_points::float as max, source, system_key, rule, min_activity, rating_scale, applies_types, applies_designations, applies_roles
         from hr_kpi_metric where active order by display_order, name`);
    const ratings = await this.manager.query(
      `select employee_id, metric_id, rating::float as rating, override_points::float as override_points, override_reason, note from hr_kpi_rating where period = $1`, [period]);
    const reviews = await this.manager.query(`select * from hr_kpi_review where period = $1`, [period]);
    const allBands = await this.manager.query(`select role_name, label, min_percent::float as min, incentive_percent::float as pct from hr_kpi_band order by min_percent desc`);
    /** a role's own band set if it has one, otherwise the default set */
    const bandsFor = (role: string | null) => {
      const own = role ? allBands.filter((b: any) => b.role_name === role) : [];
      return own.length ? own : allBands.filter((b: any) => !b.role_name);
    };
    const locked = await this.payrollLocked(period);

    const out: any[] = [];
    for (const e of emps) {
      if (only && !only(e)) continue;
      const review = reviews.find((r: any) => r.employee_id === e.id) || null;
      const items: any[] = [];
      for (const m of metrics) {
        if (!this.applies(m, e)) continue;
        const rt = ratings.find((r: any) => r.employee_id === e.id && r.metric_id === m.id);
        const item: any = {
          metric_id: m.id, name: m.name, description: m.description, max: m.max, source: m.source, system_key: m.system_key,
          unit: MEASURE(m.system_key)?.unit || null, scale: m.rating_scale,
          rating: rt?.rating ?? null, note: rt?.note ?? null, override_points: rt?.override_points ?? null, override_reason: rt?.override_reason ?? null,
          state: 'SCORED', na_reason: null, raw: null, evidence: null, points: null, final_points: null,
        };
        if (m.source === 'SYSTEM') {
          const r: any = await this.raw(m.system_key, e, start, m.min_activity || 0);
          if (r.na) { item.state = 'NA'; item.na_reason = r.na; }
          else { item.raw = r.raw; item.evidence = r.evidence; item.points = r1(m.max * pctFor(m.rule, r.raw) / 100); }
        } else if (item.rating === null) {
          item.state = 'PENDING';
        } else {
          item.points = r1(m.max * item.rating / m.rating_scale);
        }
        if (item.override_points !== null && item.state !== 'PENDING') { item.state = 'SCORED'; item.final_points = item.override_points; item.na_reason = null; }
        else if (item.state === 'SCORED') item.final_points = item.points;
        items.push(item);
      }
      const scored = items.filter(i => i.state === 'SCORED');
      const total = r1(scored.reduce((t, i) => t + i.final_points, 0));
      const max = r1(scored.reduce((t, i) => t + i.max, 0));
      const percent = r1(max > 0 ? total * 100 / max : 0);
      const band = bandsFor(e.role_name).find((b: any) => b.min <= percent);
      out.push({
        employee_id: e.id, user_id: e.user_id, role_name: e.role_name, name: e.name, designation: e.designation, emp_type: e.emp_type, store_id: e.store_id, store_ids: e.store_ids,
        items, pending: items.filter(i => i.state === 'PENDING').map(i => i.name),
        draft: { total, max, percent, band_label: band?.label ?? null, incentive_percent: band?.pct ?? 0 },
        finalised: !!review, review: review && {
          id: review.id, total_points: +review.total_points, max_points: +review.max_points, percent: +review.percent, band_label: review.band_label,
          incentive_percent: +review.incentive_percent, scores: review.scores, note: review.note, scored_on: review.scored_on,
        },
        locked: !!review || locked, payroll_locked: locked,
      });
    }
    return out;
  }

  // ------------------------------------------------------------------ ratings (managers)
  /** a manager's rating of one manual measure; the Business Head can rate anyone, a Store Head their own stores' staff */
  async rate(b: any, by: any, scope: (e: any) => boolean) {
    if (!PERIOD.test(b?.period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const [m] = await this.manager.query(`select id, name, source, rating_scale from hr_kpi_metric where id = $1 and active`, [Number(b?.metric_id)]);
    if (!m) throw new BadRequestException('Choose a measure.');
    if (m.source !== 'MANUAL') throw new BadRequestException(`${m.name} is measured by the system; it cannot be rated by hand.`);
    const [d] = (await this.draft(b.period, e => e.id === Number(b?.employee_id)));
    if (!d) throw new NotFoundException('That staff member was not employed in that month.');
    if (!scope(d)) throw new ForbiddenException('You can rate staff of your own stores only.');
    if (by.id && d.user_id === by.id) throw new ForbiddenException('You cannot rate yourself.');
    if (d.locked) throw new BadRequestException(d.payroll_locked ? 'Payroll for that month is approved.' : 'That month is finalised; the Business Head can reopen it.');
    if (!d.items.some((i: any) => i.metric_id === m.id)) throw new BadRequestException(`${m.name} does not apply to this person.`);
    const clearing = b.rating === null || b.rating === '' || b.rating === undefined;
    const rating = clearing ? null : Number(b.rating);
    if (!clearing && (!Number.isFinite(rating) || rating! < 1 || rating! > m.rating_scale)) throw new BadRequestException(`${m.name}: rate from 1 to ${m.rating_scale}.`);
    const note = String(b.note || '').trim().slice(0, 200) || null;
    await this.manager.query(
      `insert into hr_kpi_rating (employee_id, period, metric_id, rating, note, rated_by) values ($1,$2,$3,$4,$5,$6)
       on conflict (employee_id, period, metric_id) do update set rating = excluded.rating, note = excluded.note, rated_by = excluded.rated_by, rated_on = now()`,
      [d.employee_id, b.period, m.id, rating, note, by.id]);
    await this.audit.record({ userId: by.id, action: 'hr.kpi_rated', entityType: 'hr_kpi_rating', entityId: d.employee_id,
      summary: `${d.name} ${b.period}: ${m.name} ${rating === null ? 'rating cleared' : rating + '/' + m.rating_scale}`, details: { note } });
    return { ok: true };
  }

  /** the Business Head replaces a computed or rated score, with a reason */
  async override(b: any, by: any) {
    if (!PERIOD.test(b?.period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const [d] = (await this.draft(b.period, e => e.id === Number(b?.employee_id)));
    if (!d) throw new NotFoundException('That staff member was not employed in that month.');
    const it = d.items.find((i: any) => i.metric_id === Number(b?.metric_id));
    if (!it) throw new BadRequestException('That measure does not apply to this person.');
    if (d.locked) throw new BadRequestException(d.payroll_locked ? 'Payroll for that month is approved.' : 'That month is finalised; reopen it first.');
    const clearing = b.points === null || b.points === '' || b.points === undefined;
    const pts = clearing ? null : Number(b.points);
    const reason = String(b.reason || '').trim().slice(0, 200);
    if (!clearing) {
      if (!Number.isFinite(pts) || pts! < 0 || pts! > it.max) throw new BadRequestException(`${it.name}: points between 0 and ${it.max}.`);
      if (!reason) throw new BadRequestException('Say why the score is being overridden.');
    }
    await this.manager.query(
      `insert into hr_kpi_rating (employee_id, period, metric_id, override_points, override_reason, rated_by) values ($1,$2,$3,$4,$5,$6)
       on conflict (employee_id, period, metric_id) do update set override_points = excluded.override_points, override_reason = excluded.override_reason, rated_by = excluded.rated_by, rated_on = now()`,
      [d.employee_id, b.period, it.metric_id, pts, clearing ? null : reason, by.id]);
    await this.audit.record({ userId: by.id, action: 'hr.kpi_overridden', entityType: 'hr_kpi_rating', entityId: d.employee_id,
      summary: `${d.name} ${b.period}: ${it.name} ${clearing ? 'override removed' : 'set to ' + pts + '/' + it.max}`, details: { reason } });
    return { ok: true };
  }

  // ------------------------------------------------------------------ finalise / reopen
  /** freeze the month for one person (or everyone): the points, the figures behind them and who rated */
  async finalise(b: any, by: any) {
    if (!PERIOD.test(b?.period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    if (await this.payrollLocked(b.period)) throw new BadRequestException('That month\'s payroll is approved; reopen it to change KPI.');
    const one = b.employee_id ? Number(b.employee_id) : null;
    const rows = await this.draft(b.period, e => !one || e.id === one);
    if (one && !rows.length) throw new NotFoundException('That staff member was not employed in that month.');
    const skipped: any[] = [];
    let done = 0;
    for (const d of rows) {
      if (d.finalised) continue;
      if (!d.items.some((i: any) => i.state === 'SCORED')) { skipped.push({ name: d.name, reason: 'nothing to score yet' }); continue; }
      if (d.pending.length && !b.allow_unrated) { skipped.push({ name: d.name, reason: `not rated: ${d.pending.join(', ')}` }); continue; }
      const scores = d.items.filter((i: any) => i.state === 'SCORED').map((i: any) => ({
        metric_id: i.metric_id, name: i.name, max: i.max, points: i.final_points, source: i.source, raw: i.raw, unit: i.unit, evidence: i.evidence,
        rating: i.rating, scale: i.source === 'MANUAL' ? i.scale : null, computed: i.points, overridden: i.override_points !== null, override_reason: i.override_reason, note: i.note,
      }));
      await this.manager.query(
        `insert into hr_kpi_review (employee_id, period, scores, total_points, max_points, percent, band_label, incentive_percent, note, scored_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (employee_id, period) do update set scores = excluded.scores, total_points = excluded.total_points, max_points = excluded.max_points,
           percent = excluded.percent, band_label = excluded.band_label, incentive_percent = excluded.incentive_percent, note = excluded.note, scored_by = excluded.scored_by, scored_on = now()`,
        [d.employee_id, b.period, JSON.stringify(scores), d.draft.total, d.draft.max, d.draft.percent, d.draft.band_label, d.draft.incentive_percent,
          String(b.note || '').trim().slice(0, 200) || null, by.id]);
      await this.audit.record({ userId: by.id, action: 'hr.kpi_finalised', entityType: 'hr_kpi_review', entityId: d.employee_id,
        summary: `${d.name} ${b.period}: KPI ${d.draft.percent}% ${d.draft.band_label ?? ''} finalised`, details: { total: d.draft.total, max: d.draft.max } });
      done++;
    }
    return { finalised: done, skipped };
  }

  async reopen(b: any, by: any) {
    if (!PERIOD.test(b?.period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    if (await this.payrollLocked(b.period)) throw new BadRequestException('That month\'s payroll is approved; reopen it to change KPI.');
    const [r] = await this.manager.query(`delete from hr_kpi_review where employee_id = $1 and period = $2 returning employee_id`, [Number(b?.employee_id), b.period]);
    if (!r) throw new NotFoundException('That month has not been finalised for this person.');
    await this.audit.record({ userId: by.id, action: 'hr.kpi_reopened', entityType: 'hr_kpi_review', entityId: r.employee_id, summary: `KPI ${b.period} reopened`, details: {} });
    return { ok: true };
  }

  // ------------------------------------------------------------------ a person's own finalised scores
  async mine(user: any) {
    const [emp] = await this.manager.query(`select id from hr_employee where user_id = $1 or id = (select employee_id from hr_employee_account where user_id = $1)`, [user?.id || 0]);
    if (!emp) return { staff: false, months: [] };
    const months = await this.manager.query(
      `select period, percent::float as percent, band_label, incentive_percent::float as incentive_percent, total_points::float as total_points, max_points::float as max_points,
              scores, note from hr_kpi_review where employee_id = $1 order by period desc limit 24`, [emp.id]);
    return { staff: true, months };
  }
}
