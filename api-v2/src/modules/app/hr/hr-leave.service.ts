import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { appliesToPosition } from './hr-link';

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
    return this.manager.query(`select id, code, name, paid, annual_days::float as annual_days, active, applies_roles, applies_positions from hr_leave_type order by paid desc, name`);
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
    if (id) {
      const [cur] = await this.manager.query(`select paid from hr_leave_type where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Leave type not found.');
      if (cur.paid !== paid) throw new BadRequestException('A leave type cannot change between paid and unpaid; add a new one.');
      await this.manager.query(`update hr_leave_type set name = $2, annual_days = $3, active = $4, applies_roles = $5, applies_positions = $6 where id = $1`, [id, name, days, b.active !== false, roles, positions]);
    } else {
      const code = String(b?.code || name).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10);
      if (!code) throw new BadRequestException('Give the leave type a code.');
      const [ex] = await this.manager.query(`select 1 from hr_leave_type where code = $1`, [code]);
      if (ex) throw new BadRequestException(`A leave type with code ${code} exists.`);
      const [r] = await this.manager.query(`insert into hr_leave_type (code, name, paid, annual_days, applies_roles, applies_positions) values ($1,$2,$3,$4,$5,$6) returning id`, [code, name, paid, days, roles, positions]);
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

  async requests(q: { period?: string; status?: string; employee?: number }) {
    const where: string[] = [];
    const args: any[] = [];
    if (q.period && PERIOD.test(q.period)) { args.push(q.period + '-01'); where.push(`r.from_date <= (date_trunc('month', $${args.length}::date) + interval '1 month - 1 day') and r.to_date >= $${args.length}::date`); }
    if (q.status) { args.push(q.status); where.push(`r.status = $${args.length}`); }
    if (q.employee) { args.push(q.employee); where.push(`r.employee_id = $${args.length}`); }
    return this.manager.query(
      `select r.id, r.employee_id, coalesce(e.full_name, u.full_name) as name, t.name as type, t.code, t.paid, r.from_date, r.to_date, r.days::float as days, r.half_day,
              r.reason, r.status, r.decision_note, d.full_name as decided_by_name, r.decided_on
         from hr_leave_request r join hr_employee e on e.id = r.employee_id left join app_user u on u.id = e.user_id
         join hr_leave_type t on t.id = r.leave_type_id left join app_user d on d.id = r.decided_by
        ${where.length ? 'where ' + where.join(' and ') : ''} order by r.from_date desc, r.id desc limit 300`, args);
  }

  async create(b: any, by: any) {
    const [emp] = await this.manager.query(
      `select e.id, e.weekly_off, e.work_days, e.join_date, e.exit_date, e.position_id, coalesce(e.full_name, u.full_name) as full_name, (select r.name from app_role r where r.id = u.role_id) as role_name
         from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id)]);
    if (!emp) throw new BadRequestException('Choose the staff member.');
    const [type] = await this.manager.query(`select id, name, paid, applies_roles, applies_positions from hr_leave_type where id = $1 and active`, [Number(b?.leave_type_id)]);
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
    const [r] = await this.manager.query(
      `insert into hr_leave_request (employee_id, leave_type_id, from_date, to_date, days, half_day, reason, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [emp.id, type.id, b.from_date, b.to_date, count, half, String(b.reason || '').trim().slice(0, 200) || null, by.id]);
    await this.audit.record({ userId: by.id, action: 'hr.leave_requested', entityType: 'hr_leave_request', entityId: r.id,
      summary: `${emp.full_name}: ${type.name} ${b.from_date} to ${b.to_date} (${count} days)`, details: {} });
    return { id: r.id, days: count };
  }

  async decide(id: number, b: any, by: any) {
    const action = String(b?.action || '');
    if (!['approve', 'reject', 'cancel'].includes(action)) throw new BadRequestException('Approve, reject or cancel.');
    const [r] = await this.manager.query(
      `select r.*, e.weekly_off, e.work_days, t.paid, t.name as type_name, t.annual_days::float as annual, coalesce(e.full_name, u.full_name) as full_name
         from hr_leave_request r join hr_employee e on e.id = r.employee_id join hr_leave_type t on t.id = r.leave_type_id left join app_user u on u.id = e.user_id where r.id = $1`, [id]);
    if (!r) throw new NotFoundException('Leave request not found.');
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
        if (r.paid) {
          const year = iso(r.from_date).slice(0, 4);
          const [used] = await tm.query(
            `select coalesce(sum(days), 0)::float as used from hr_leave_request where employee_id = $1 and leave_type_id = $2 and status = 'APPROVED' and extract(year from from_date) = $3`,
            [r.employee_id, r.leave_type_id, Number(year)]);
          if (used.used + Number(r.days) > r.annual + 0.001) {
            throw new BadRequestException(`${r.full_name} has ${(Math.max(r.annual - used.used, 0)).toFixed(1)} days of ${r.type_name} left this year; this asks for ${Number(r.days).toFixed(1)}. Reject it, or approve it as unpaid leave.`);
          }
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
    return this.manager.query(
      `select e.id as employee_id, coalesce(e.full_name, u.full_name) as name, t.id as type_id, t.code, t.name as type, t.paid, t.annual_days::float as entitled,
              coalesce(sum(r.days) filter (where r.status = 'APPROVED'), 0)::float as used,
              coalesce(sum(r.days) filter (where r.status = 'PENDING'), 0)::float as pending
         from hr_employee e left join app_user u on u.id = e.user_id left join app_role ro on ro.id = u.role_id
         cross join hr_leave_type t
         left join hr_leave_request r on r.employee_id = e.id and r.leave_type_id = t.id and extract(year from r.from_date) = $1
        where e.status = 'ACTIVE' and t.active and (t.applies_roles is null or cardinality(t.applies_roles) = 0 or ro.name = any(t.applies_roles))
          and (t.applies_positions is null or cardinality(t.applies_positions) = 0 or e.position_id = any(t.applies_positions))
        group by e.id, coalesce(e.full_name, u.full_name), t.id, t.code, t.name, t.paid, t.annual_days
        order by coalesce(e.full_name, u.full_name), t.paid desc, t.name`, [year]);
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
         on conflict (employee_id, att_date) do update set status = excluded.status, note = excluded.note, created_by = excluded.created_by, created_on = now()`,
        [emp.id, b.date, b.status, String(b.note || '').trim().slice(0, 200) || null, by.id]);
    }
    await this.audit.record({ userId: by.id, action: 'hr.attendance_marked', entityType: 'hr_attendance', entityId: emp.id,
      summary: `${emp.full_name} ${b.date}: ${b.status || 'cleared'}`, details: {} });
    return { ok: true };
  }
}
