import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { appliesToPosition } from './hr-link';
import { Accrual, adviceNotes, creditedDays, eligibleFrom, longestStretch } from './hr-leave-policy';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const ATT_STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY'];

/** every date from..to as YYYY-MM-DD (UTC, so no timezone drift) */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
/** an off day: outside a part-timer's working days, or the weekly off of everyone else */
const isOffDay = (d: string, emp: { weekly_off: string; work_days?: string[] | null }) => {
  const day = DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()];
  return emp.work_days?.length ? !emp.work_days.includes(day) : day === emp.weekly_off;
};
const iso = (d: any) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

/** Leave types, holidays, leave requests, and the attendance grid. */
@Injectable()
export class HrLeaveService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------ leave types and holidays
  types() {
    return this.manager.query(`select id, code, name, paid, annual_days::float as annual_days, active, applies_roles, applies_positions, accrual_mode, wait_months, max_consecutive, stretch_counts_offs, advice_from_day, advice_to_day, advice_avoid_weekdays, advice_roles from hr_leave_type order by paid desc, name`);
  }

  /** deleted when no leave was ever asked for under it; otherwise made inactive, since the leave history refers to it */
  async removeType(id: number, by: any) {
    const [t] = await this.manager.query(`select id, name from hr_leave_type where id = $1`, [id]);
    if (!t) throw new NotFoundException('Leave type not found.');
    const [u] = await this.manager.query(`select count(*)::int as n from hr_leave_request where leave_type_id = $1`, [id]);
    if (u.n > 0) {
      await this.manager.query(`update hr_leave_type set active = false where id = $1`, [id]);
      await this.audit.record({ userId: by.id, action: 'hr.leave_type_deactivated', entityType: 'hr_leave_type', entityId: id, summary: `Leave type ${t.name} made inactive (${u.n} requests)`, details: {} });
      return { removed: false, deactivated: true, uses: u.n };
    }
    await this.manager.query(`delete from hr_leave_type where id = $1`, [id]);
    await this.audit.record({ userId: by.id, action: 'hr.leave_type_removed', entityType: 'hr_leave_type', entityId: id, summary: `Leave type ${t.name} removed`, details: {} });
    return { removed: true, deactivated: false, uses: 0 };
  }

  roleList(v: any): string[] | null {
    const a = Array.from(new Set((Array.isArray(v) ? v : []).map((x: any) => String(x).trim()).filter(Boolean))).slice(0, 20) as string[];
    return a.length ? a : null;
  }

  /** the job roles a leave type is limited to; none given means every job role */
  async checkPositions(v: any): Promise<number[] | null> {
    const ids = Array.from(new Set((Array.isArray(v) ? v : []).map((x: any) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0))) as number[];
    if (!ids.length) return null;
    const known = await this.manager.query(`select id from hr_position where id = any($1)`, [ids]);
    if (known.length !== ids.length) throw new BadRequestException('One of the job roles was not found.');
    return ids;
  }

  async checkRoles(roles: string[] | null) {
    if (!roles) return;
    const known = await this.manager.query(`select name from app_role where name = any($1::text[]) and name <> 'Site Admin'`, [roles]);
    if (known.length !== roles.length) throw new BadRequestException('One of the roles is not a role in this system.');
  }

  async saveType(id: number | null, b: any, by: any) {
    const name = String(b?.name || '').trim().slice(0, 40);
    if (!name) throw new BadRequestException('Give the leave type a name.');
    const paid = b?.paid !== false;
    const days = Number(b?.annual_days ?? 0);
    if (!Number.isFinite(days) || days < 0 || days > 366) throw new BadRequestException('Days a year must be between 0 and 366.');
    const roles = this.roleList(b?.applies_roles);
    await this.checkRoles(roles);
    const positions = await this.checkPositions(b?.applies_positions);
    const accrual: Accrual = b?.accrual_mode === 'MONTHLY' ? 'MONTHLY' : 'YEARLY';
    const wait = b?.wait_months === undefined || b?.wait_months === null || b?.wait_months === '' ? 0 : Number(b.wait_months);
    if (!Number.isInteger(wait) || wait < 0 || wait > 60) throw new BadRequestException('The months to wait after joining must be 0 to 60.');
    const together = b?.max_consecutive === undefined || b?.max_consecutive === null || b?.max_consecutive === '' ? null : Number(b.max_consecutive);
    if (together !== null && (!Number.isInteger(together) || together < 1 || together > 60)) throw new BadRequestException('The most days together must be 1 to 60, or empty for no limit.');
    const offs = b?.stretch_counts_offs !== false;
    const num = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));
    const adviceFrom = num(b?.advice_from_day), adviceTo = num(b?.advice_to_day);
    if ((adviceFrom === null) !== (adviceTo === null)) throw new BadRequestException('Give both the first and the last day of the month for the advised days, or neither.');
    if (adviceFrom !== null && (!Number.isInteger(adviceFrom) || !Number.isInteger(adviceTo) || adviceFrom < 1 || adviceTo! > 31 || adviceTo! < adviceFrom)) throw new BadRequestException('The advised days must be within 1 to 31, the last not before the first.');
    const avoid: number[] | null = Array.isArray(b?.advice_avoid_weekdays) && b.advice_avoid_weekdays.length
      ? Array.from(new Set(b.advice_avoid_weekdays.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))) as number[] : null;
    const adviceRoles = this.roleList(b?.advice_roles);
    await this.checkRoles(adviceRoles);
    if (id) {
      const [cur] = await this.manager.query(`select paid from hr_leave_type where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Leave type not found.');
      if (cur.paid !== paid) throw new BadRequestException('A leave type cannot change between paid and unpaid; add a new one.');
      await this.manager.query(`update hr_leave_type set name = $2, annual_days = $3, active = $4, applies_roles = $5, applies_positions = $6, accrual_mode = $7, wait_months = $8, max_consecutive = $9, stretch_counts_offs = $10,
        advice_from_day = $11, advice_to_day = $12, advice_avoid_weekdays = $13, advice_roles = $14 where id = $1`,
        [id, name, days, b.active !== false, roles, positions, accrual, wait, together, offs, adviceFrom, adviceTo, avoid, adviceRoles]);
    } else {
      const code = String(b?.code || name).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10);
      if (!code) throw new BadRequestException('Give the leave type a code.');
      const [ex] = await this.manager.query(`select 1 from hr_leave_type where code = $1`, [code]);
      if (ex) throw new BadRequestException(`A leave type with code ${code} exists.`);
      const [r] = await this.manager.query(`insert into hr_leave_type (code, name, paid, annual_days, applies_roles, applies_positions, accrual_mode, wait_months, max_consecutive, stretch_counts_offs, advice_from_day, advice_to_day, advice_avoid_weekdays, advice_roles)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
        [code, name, paid, days, roles, positions, accrual, wait, together, offs, adviceFrom, adviceTo, avoid, adviceRoles]);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'hr.leave_type_saved', entityType: 'hr_leave_type', entityId: id, summary: `Leave type ${name} saved`, details: {} });
    return { id };
  }

  holidays(year: number) {
    return this.manager.query(`select to_char(holiday_date, 'YYYY-MM-DD') as date, name from hr_holiday where extract(year from holiday_date) = $1 order by holiday_date`, [year]);
  }

  async addHoliday(b: any, by: any) {
    if (!DATE.test(b?.date || '')) throw new BadRequestException('Give the holiday date.');
    const name = String(b?.name || '').trim().slice(0, 60);
    if (!name) throw new BadRequestException('Give the holiday a name.');
    await this.manager.query(`insert into hr_holiday (holiday_date, name) values ($1,$2) on conflict (holiday_date) do update set name = excluded.name`, [b.date, name]);
    await this.audit.record({ userId: by.id, action: 'hr.holiday_saved', entityType: 'hr_holiday', entityId: null, summary: `Holiday ${b.date}: ${name}`, details: {} });
    return { date: b.date };
  }

  async removeHoliday(date: string, by: any) {
    if (!DATE.test(date)) throw new BadRequestException('Not a valid date.');
    await this.manager.query(`delete from hr_holiday where holiday_date = $1`, [date]);
    await this.audit.record({ userId: by.id, action: 'hr.holiday_removed', entityType: 'hr_holiday', entityId: null, summary: `Holiday ${date} removed`, details: {} });
    return { date };
  }

  // ------------------------------------------------------------------ leave requests
  /** working days a leave takes: not holidays, and not the weekly-off Sunday for staff who have a fixed one */
  private async countDays(emp: any, from: string, to: string, half: boolean) {
    const hol = new Set((await this.manager.query(`select to_char(holiday_date, 'YYYY-MM-DD') as d from hr_holiday where holiday_date between $1 and $2`, [from, to])).map((h: any) => h.d));
    const days = datesBetween(from, to).filter(d => !hol.has(d) && !isOffDay(d, emp));
    return { days, count: half ? 0.5 : days.length };
  }

  /**
   * The leave type's rules for a request: not before the waiting months have passed, not more than the days credited so far, and (when the type
   * limits it) not more days together than allowed. A manager may break the limit on days together by giving a reason; nothing else can be broken.
   * Returns whether the stretch limit was overridden.
   */
  private async policyCheck(
    emp: any, t: any, from: string, to: string, count: number, half: boolean,
    o: { excludeId: number | null; countPending: boolean; skipStretch?: boolean; override?: { allowed: boolean; reason: string | null } },
  ): Promise<{ overridden: boolean; notes: string[] }> {
    const join = iso(emp.join_date);
    const wait = Number(t.wait_months) || 0;
    if (wait > 0) {
      const first = eligibleFrom(join, wait);
      if (from < first) throw new BadRequestException(`${t.name} can be taken from ${first} (${wait} month${wait === 1 ? '' : 's'} after joining).`);
    }
    if (t.paid) {
      const credited = creditedDays({ annual: Number(t.annual_days), accrual: t.accrual_mode }, join, from);
      const [u] = await this.manager.query(
        `select coalesce(sum(days) filter (where status = 'APPROVED'), 0)::float as approved, coalesce(sum(days) filter (where status = 'PENDING'), 0)::float as pending
           from hr_leave_request where employee_id = $1 and leave_type_id = $2 and extract(year from from_date) = $3 and ($4::int is null or id <> $4)`,
        [emp.id, t.id, Number(from.slice(0, 4)), o.excludeId]);
      const used = u.approved + (o.countPending ? u.pending : 0);
      if (used + count > credited + 0.001) {
        const left = Math.max(credited - used, 0);
        throw new BadRequestException(`${emp.full_name} has ${left.toFixed(1)} days of ${t.name} available (${credited.toFixed(1)} credited so far this year, ${used.toFixed(1)} taken or waiting); this asks for ${count.toFixed(1)}.${t.accrual_mode === 'MONTHLY' ? ' The days build up each month.' : ''}`);
      }
    }
    const max = t.max_consecutive ? Number(t.max_consecutive) : 0;
    if (max > 0 && !o.skipStretch) {
      const { days: newDays } = await this.countDays(emp, from, to, half);
      const lo = new Date(Date.parse(from + 'T00:00:00Z') - 35 * 86400000).toISOString().slice(0, 10);
      const hi = new Date(Date.parse(to + 'T00:00:00Z') + 35 * 86400000).toISOString().slice(0, 10);
      const hol = new Set((await this.manager.query(`select to_char(holiday_date, 'YYYY-MM-DD') as d from hr_holiday where holiday_date between $1 and $2`, [lo, hi])).map((h: any) => h.d));
      const isOff = (d: string) => hol.has(d) || isOffDay(d, emp);
      const others = await this.manager.query(
        `select to_char(from_date, 'YYYY-MM-DD') as from_date, to_char(to_date, 'YYYY-MM-DD') as to_date from hr_leave_request where employee_id = $1 and leave_type_id = $2 and status = any($6::text[]) and ($3::int is null or id <> $3) and from_date <= $5 and to_date >= $4`,
        // asking counts what is waiting as well; deciding counts only what was approved (a waiting request is decided on its own turn)
        [emp.id, t.id, o.excludeId, lo, hi, o.countPending ? ['PENDING', 'APPROVED'] : ['APPROVED']]);
      const otherDays: string[] = [];
      for (const r of others) for (const d of datesBetween(iso(r.from_date), iso(r.to_date))) if (!isOff(d)) otherDays.push(d);
      const s = longestStretch(newDays, otherDays, isOff, t.stretch_counts_offs !== false);
      if (s.days > max) {
        const reason = (o.override?.reason || '').trim();
        if (o.override?.allowed && reason.length >= 5) return { overridden: true, notes: await this.advice(emp, t, from, to, half) };
        throw new BadRequestException(
          `${t.name} can be taken for at most ${max} day${max === 1 ? '' : 's'} together. This would make ${s.days} days together (${s.from} to ${s.to}${t.stretch_counts_offs !== false ? ', counting weekly offs and holidays in between' : ''}).`
          + (o.override?.allowed ? ' Give a reason (at least 5 characters) to allow it.' : ' A manager can allow a longer stretch with a reason.'));
      }
    }
    return { overridden: false, notes: await this.advice(emp, t, from, to, half) };
  }

  /** the advised days of the type for this person: what is outside them, as notes (advice only; nothing is refused) */
  private async advice(emp: any, t: any, from: string, to: string, half: boolean): Promise<string[]> {
    if (!(t.advice_from_day && t.advice_to_day) && !t.advice_avoid_weekdays?.length) return [];
    if (t.advice_roles?.length && !t.advice_roles.includes(emp.role_name)) return [];
    const { days } = await this.countDays(emp, from, to, half);
    return adviceNotes(days, { fromDay: t.advice_from_day, toDay: t.advice_to_day, avoidWeekdays: t.advice_avoid_weekdays });
  }

  async requests(q: { period?: string; status?: string; employee?: number }) {
    const where: string[] = [];
    const args: any[] = [];
    if (q.period && PERIOD.test(q.period)) { args.push(q.period + '-01'); where.push(`r.from_date <= (date_trunc('month', $${args.length}::date) + interval '1 month - 1 day') and r.to_date >= $${args.length}::date`); }
    if (q.status) { args.push(q.status); where.push(`r.status = $${args.length}`); }
    if (q.employee) { args.push(q.employee); where.push(`r.employee_id = $${args.length}`); }
    return this.manager.query(
      `select r.id, r.employee_id, coalesce(e.full_name, u.full_name) as name, t.name as type, t.code, t.paid, r.from_date, r.to_date, r.days::float as days, r.half_day,
              r.reason, r.status, r.decision_note, d.full_name as decided_by_name, r.decided_on, r.policy_note, r.override_reason
         from hr_leave_request r join hr_employee e on e.id = r.employee_id left join app_user u on u.id = e.user_id
         join hr_leave_type t on t.id = r.leave_type_id left join app_user d on d.id = r.decided_by
        ${where.length ? 'where ' + where.join(' and ') : ''} order by r.from_date desc, r.id desc limit 300`, args);
  }

  async create(b: any, by: any, opts: { canOverride?: boolean } = {}) {
    const [emp] = await this.manager.query(
      `select e.id, e.weekly_off, e.work_days, to_char(e.join_date, 'YYYY-MM-DD') as join_date, e.exit_date, e.position_id, coalesce(e.full_name, u.full_name) as full_name, (select r.name from app_role r where r.id = u.role_id) as role_name
         from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id)]);
    if (!emp) throw new BadRequestException('Choose the staff member.');
    const [type] = await this.manager.query(`select id, name, paid, applies_roles, applies_positions, annual_days::float as annual_days, accrual_mode, wait_months, max_consecutive, stretch_counts_offs, advice_from_day, advice_to_day, advice_avoid_weekdays, advice_roles from hr_leave_type where id = $1 and active`, [Number(b?.leave_type_id)]);
    if (!type) throw new BadRequestException('Choose the leave type.');
    if (type.applies_roles?.length && !type.applies_roles.includes(emp.role_name)) throw new BadRequestException(`${type.name} does not apply to ${emp.role_name ? 'the ' + emp.role_name + ' role' : 'staff without a login'}.`);
    if (!appliesToPosition(type.applies_positions, emp.position_id)) throw new BadRequestException(`${type.name} does not apply to ${emp.position_id ? 'this job role' : 'staff with no job role'}.`);
    if (!DATE.test(b?.from_date || '') || !DATE.test(b?.to_date || '')) throw new BadRequestException('Give the from and to dates.');
    if (b.to_date < b.from_date) throw new BadRequestException('The to date is before the from date.');
    if (iso(emp.join_date) > b.from_date) throw new BadRequestException('The leave starts before the joining date.');
    const half = !!b.half_day;
    if (half && b.from_date !== b.to_date) throw new BadRequestException('A half day is one day: use the same from and to date.');
    const { count } = await this.countDays(emp, b.from_date, b.to_date, half);
    if (!(count > 0)) throw new BadRequestException('Those dates have no working days (holidays or weekly off).');
    const [clash] = await this.manager.query(
      `select id from hr_leave_request where employee_id = $1 and status in ('PENDING','APPROVED') and from_date <= $3 and to_date >= $2 limit 1`, [emp.id, b.from_date, b.to_date]);
    if (clash) throw new BadRequestException('There is already a leave request covering some of those dates.');
    const overrideReason = String(b?.override_reason || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
    const { overridden, notes } = await this.policyCheck(emp, type, b.from_date, b.to_date, count, half, { excludeId: null, countPending: true, override: { allowed: !!opts.canOverride, reason: overrideReason } });
    const policyNote = notes.join(' ').slice(0, 300) || null;
    const [r] = await this.manager.query(
      `insert into hr_leave_request (employee_id, leave_type_id, from_date, to_date, days, half_day, reason, created_by, override_reason, policy_note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [emp.id, type.id, b.from_date, b.to_date, count, half, String(b.reason || '').trim().slice(0, 200) || null, by.id, overridden ? overrideReason : null, policyNote]);
    if (overridden) await this.audit.record({ userId: by.id, action: 'hr.leave_stretch_overridden', entityType: 'hr_leave_request', entityId: r.id,
      summary: `${emp.full_name}: ${type.name} ${b.from_date} to ${b.to_date} allowed beyond the ${type.max_consecutive} days together limit: ${overrideReason}`, details: { reason: overrideReason } });
    await this.audit.record({ userId: by.id, action: 'hr.leave_requested', entityType: 'hr_leave_request', entityId: r.id,
      summary: `${emp.full_name}: ${type.name} ${b.from_date} to ${b.to_date} (${count} days)`, details: {} });
    return { id: r.id, days: count, notes };
  }

  async decide(id: number, b: any, by: any) {
    const action = String(b?.action || '');
    if (!['approve', 'reject', 'cancel'].includes(action)) throw new BadRequestException('Approve, reject or cancel.');
    const [r] = await this.manager.query(
      `select r.*, to_char(r.from_date, 'YYYY-MM-DD') as from_txt, to_char(r.to_date, 'YYYY-MM-DD') as to_txt, e.weekly_off, e.work_days, to_char(e.join_date, 'YYYY-MM-DD') as join_date, t.paid, t.name as type_name, t.annual_days::float as annual, t.accrual_mode, t.wait_months, t.max_consecutive, t.stretch_counts_offs, coalesce(e.full_name, u.full_name) as full_name
         from hr_leave_request r join hr_employee e on e.id = r.employee_id join hr_leave_type t on t.id = r.leave_type_id left join app_user u on u.id = e.user_id where r.id = $1`, [id]);
    if (!r) throw new NotFoundException('Leave request not found.');
    r.from_date = r.from_txt; r.to_date = r.to_txt;          // as text: a server clock that is not UTC cannot shift them a day
    const note = String(b?.note || '').trim().slice(0, 200) || null;
    if (action === 'cancel') {
      if (!['PENDING', 'APPROVED'].includes(r.status)) throw new BadRequestException('Only a pending or approved leave can be cancelled.');
    } else if (r.status !== 'PENDING') throw new BadRequestException(`This request is already ${r.status.toLowerCase()}.`);
    if (action === 'reject' && !note) throw new BadRequestException('Say why it is rejected.');
    if (action !== 'reject') {
      const [locked] = await this.manager.query(
        `select period from hr_payroll_run where status = 'APPROVED' and period between $1 and $2 limit 1`, [iso(r.from_date).slice(0, 7), iso(r.to_date).slice(0, 7)]);
      if (locked) throw new BadRequestException(`Payroll for ${locked.period} is approved; reopen it before changing leave in that month.`);
    }

    await this.manager.transaction(async tm => {
      if (action === 'approve') {
        // the type's rules again, as they stand now: the waiting months, the days credited so far, and the days together (a manager may allow more, with a reason)
        const approveReason = String(b?.override_reason || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
        const { overridden } = await this.policyCheck({ ...r, id: r.employee_id }, { id: r.leave_type_id, name: r.type_name, paid: r.paid, annual_days: r.annual, accrual_mode: r.accrual_mode, wait_months: r.wait_months,
          max_consecutive: r.max_consecutive, stretch_counts_offs: r.stretch_counts_offs }, iso(r.from_date), iso(r.to_date), Number(r.days), r.half_day,
          { excludeId: r.id, countPending: false, skipStretch: !!r.override_reason, override: { allowed: true, reason: approveReason } });
        if (overridden) {
          await tm.query(`update hr_leave_request set override_reason = $2 where id = $1`, [r.id, approveReason]);
          await this.audit.record({ userId: by.id, action: 'hr.leave_stretch_overridden', entityType: 'hr_leave_request', entityId: r.id,
            summary: `${r.full_name}: ${r.type_name} ${iso(r.from_date)} to ${iso(r.to_date)} approved beyond the ${r.max_consecutive} days together limit: ${approveReason}`, details: { reason: approveReason } });
        }
        const { days } = await this.countDays(r, iso(r.from_date), iso(r.to_date), r.half_day);
        for (const d of days) {
          await tm.query(`insert into hr_leave_day (request_id, employee_id, leave_date, fraction, paid) values ($1,$2,$3,$4,$5) on conflict do nothing`,
            [r.id, r.employee_id, d, r.half_day ? 0.5 : 1, r.paid]);
        }
      } else if (r.status === 'APPROVED') {
        await tm.query(`delete from hr_leave_day where request_id = $1`, [r.id]);
      }
      await tm.query(`update hr_leave_request set status = $2, decided_by = $3, decided_on = now(), decision_note = $4 where id = $1`,
        [r.id, action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'CANCELLED', by.id, note]);
    });
    await this.audit.record({ userId: by.id, action: `hr.leave_${action}`, entityType: 'hr_leave_request', entityId: id, summary: `${r.full_name}: ${r.type_name} ${action}`, details: { note } });
    return { id };
  }

  /** entitlement, used and pending per person for a year */
  async balances(year: number) {
    const rows = await this.manager.query(
      `select e.id as employee_id, coalesce(e.full_name, u.full_name) as name, to_char(e.join_date, 'YYYY-MM-DD') as join_date, t.id as type_id, t.code, t.name as type, t.paid, t.annual_days::float as entitled,
              t.accrual_mode, t.wait_months, t.max_consecutive,
              coalesce(sum(r.days) filter (where r.status = 'APPROVED'), 0)::float as used,
              coalesce(sum(r.days) filter (where r.status = 'PENDING'), 0)::float as pending
         from hr_employee e left join app_user u on u.id = e.user_id left join app_role ro on ro.id = u.role_id
         cross join hr_leave_type t
         left join hr_leave_request r on r.employee_id = e.id and r.leave_type_id = t.id and extract(year from r.from_date) = $1
        where e.status = 'ACTIVE' and t.active and (t.applies_roles is null or cardinality(t.applies_roles) = 0 or ro.name = any(t.applies_roles))
          and (t.applies_positions is null or cardinality(t.applies_positions) = 0 or e.position_id = any(t.applies_positions))
        group by e.id, coalesce(e.full_name, u.full_name), e.join_date, t.id, t.code, t.name, t.paid, t.annual_days, t.accrual_mode, t.wait_months, t.max_consecutive
        order by coalesce(e.full_name, u.full_name), t.paid desc, t.name`, [year]);
    // how much is credited as of today (this year), the end of the year (a past one) or its start (a future one), and what can be taken now
    const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    const asOf = year === Number(today.slice(0, 4)) ? today : year < Number(today.slice(0, 4)) ? `${year}-12-31` : `${year}-01-01`;
    return rows.map((b: any) => {
      const credited = b.paid ? creditedDays({ annual: b.entitled, accrual: b.accrual_mode }, b.join_date, asOf) : 0;
      return { ...b, credited, available: b.paid ? Math.max(Math.round((credited - b.used - b.pending) * 100) / 100, 0) : 0, eligible_from: b.wait_months > 0 ? eligibleFrom(b.join_date, b.wait_months) : null };
    });
  }

  // ------------------------------------------------------------------ attendance
  /** the month grid: every person employed in the month, each day's mark, and approved leave */
  async grid(period: string) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const start = period + '-01';
    const emps = await this.manager.query(
      `select e.id, coalesce(e.full_name, u.full_name) as name, e.weekly_off, e.work_days, to_char(e.work_start, 'HH24:MI') as work_start, to_char(e.work_end, 'HH24:MI') as work_end, to_char(e.join_date, 'YYYY-MM-DD') as join_date, to_char(e.exit_date, 'YYYY-MM-DD') as exit_date
         from hr_employee e left join app_user u on u.id = e.user_id
        where e.join_date <= (date_trunc('month', $1::date) + interval '1 month - 1 day') and (e.exit_date is null or e.exit_date >= $1::date)
        order by coalesce(e.full_name, u.full_name)`, [start]);
    const marks = await this.manager.query(
      `select employee_id, to_char(att_date, 'YYYY-MM-DD') as d, status from hr_attendance
        where att_date >= $1::date and att_date < ($1::date + interval '1 month')`, [start]);
    const leave = await this.manager.query(
      `select employee_id, to_char(leave_date, 'YYYY-MM-DD') as d, paid, fraction::float as fraction from hr_leave_day
        where leave_date >= $1::date and leave_date < ($1::date + interval '1 month')`, [start]);
    const hol = await this.manager.query(
      `select to_char(holiday_date, 'YYYY-MM-DD') as d, name from hr_holiday where holiday_date >= $1::date and holiday_date < ($1::date + interval '1 month')`, [start]);
    const last = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)).getUTCDate();
    return {
      period, days: last, holidays: hol,
      staff: emps.map((e: any) => ({
        ...e,
        marks: Object.fromEntries(marks.filter((m: any) => m.employee_id === e.id).map((m: any) => [m.d, m.status])),
        leave: Object.fromEntries(leave.filter((l: any) => l.employee_id === e.id).map((l: any) => [l.d, { paid: l.paid, fraction: l.fraction }])),
      })),
    };
  }

  async mark(b: any, by: any) {
    const [emp] = await this.manager.query(`select e.id, e.join_date, e.exit_date, coalesce(e.full_name, u.full_name) as full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id)]);
    if (!emp) throw new BadRequestException('Choose the staff member.');
    if (!DATE.test(b?.date || '')) throw new BadRequestException('Give the date.');
    if (b.date > new Date().toISOString().slice(0, 10)) throw new BadRequestException('Attendance cannot be marked for a future date.');
    if (b.date < iso(emp.join_date) || (emp.exit_date && b.date > iso(emp.exit_date))) throw new BadRequestException('That date is outside their employment.');
    const [paidRun] = await this.manager.query(`select 1 from hr_payroll_run where period = $1 and status = 'APPROVED'`, [b.date.slice(0, 7)]);
    if (paidRun) throw new BadRequestException('That month\'s payroll is approved; reopen it to change attendance.');
    if (b.status === null || b.status === undefined || b.status === '') {
      await this.manager.query(`delete from hr_attendance where employee_id = $1 and att_date = $2`, [emp.id, b.date]);
    } else {
      if (!ATT_STATUSES.includes(b.status)) throw new BadRequestException('Not a valid attendance status.');
      await this.manager.query(
        `insert into hr_attendance (employee_id, att_date, status, note, created_by) values ($1,$2,$3,$4,$5)
         on conflict (employee_id, att_date) do update set status = excluded.status, note = excluded.note, created_by = excluded.created_by, created_on = now(),
           verification_status = case when hr_attendance.verification_status = 'PENDING' then 'CORRECTED' else hr_attendance.verification_status end`,
        [emp.id, b.date, b.status, String(b.note || '').trim().slice(0, 200) || null, by.id]);
    }
    await this.audit.record({ userId: by.id, action: 'hr.attendance_marked', entityType: 'hr_attendance', entityId: emp.id,
      summary: `${emp.full_name} ${b.date}: ${b.status || 'cleared'}`, details: {} });
    return { ok: true };
  }
}
