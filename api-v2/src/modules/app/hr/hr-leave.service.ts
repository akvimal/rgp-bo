import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const ATT_STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'WEEKLY_OFF', 'HOLIDAY'];

/** every date from..to as YYYY-MM-DD (UTC, so no timezone drift) */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const isSunday = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay() === 0;
const iso = (d: any) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

/** Leave types, holidays, leave requests, and the attendance grid. */
@Injectable()
export class HrLeaveService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------ leave types and holidays
  types() {
    return this.manager.query(`select id, code, name, paid, annual_days::float as annual_days, active from hr_leave_type order by paid desc, name`);
  }

  async saveType(id: number | null, b: any, by: any) {
    const name = String(b?.name || '').trim().slice(0, 40);
    if (!name) throw new BadRequestException('Give the leave type a name.');
    const paid = b?.paid !== false;
    const days = Number(b?.annual_days ?? 0);
    if (!Number.isFinite(days) || days < 0 || days > 366) throw new BadRequestException('Days a year must be between 0 and 366.');
    if (id) {
      const [cur] = await this.manager.query(`select paid from hr_leave_type where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Leave type not found.');
      if (cur.paid !== paid) throw new BadRequestException('A leave type cannot change between paid and unpaid; add a new one.');
      await this.manager.query(`update hr_leave_type set name = $2, annual_days = $3, active = $4 where id = $1`, [id, name, days, b.active !== false]);
    } else {
      const code = String(b?.code || name).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10);
      if (!code) throw new BadRequestException('Give the leave type a code.');
      const [ex] = await this.manager.query(`select 1 from hr_leave_type where code = $1`, [code]);
      if (ex) throw new BadRequestException(`A leave type with code ${code} exists.`);
      const [r] = await this.manager.query(`insert into hr_leave_type (code, name, paid, annual_days) values ($1,$2,$3,$4) returning id`, [code, name, paid, days]);
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
    const days = datesBetween(from, to).filter(d => !hol.has(d) && !(emp.weekly_off === 'SUNDAY' && isSunday(d)));
    return { days, count: half ? 0.5 : days.length };
  }

  async requests(q: { period?: string; status?: string; employee?: number }) {
    const where: string[] = [];
    const args: any[] = [];
    if (q.period && PERIOD.test(q.period)) { args.push(q.period + '-01'); where.push(`r.from_date <= (date_trunc('month', $${args.length}::date) + interval '1 month - 1 day') and r.to_date >= $${args.length}::date`); }
    if (q.status) { args.push(q.status); where.push(`r.status = $${args.length}`); }
    if (q.employee) { args.push(q.employee); where.push(`r.employee_id = $${args.length}`); }
    return this.manager.query(
      `select r.id, r.employee_id, u.full_name as name, t.name as type, t.code, t.paid, r.from_date, r.to_date, r.days::float as days, r.half_day,
              r.reason, r.status, r.decision_note, d.full_name as decided_by_name, r.decided_on
         from hr_leave_request r join hr_employee e on e.id = r.employee_id left join app_user u on u.id = e.user_id
         join hr_leave_type t on t.id = r.leave_type_id left join app_user d on d.id = r.decided_by
        ${where.length ? 'where ' + where.join(' and ') : ''} order by r.from_date desc, r.id desc limit 300`, args);
  }

  async create(b: any, by: any) {
    const [emp] = await this.manager.query(`select e.id, e.weekly_off, e.join_date, e.exit_date, u.full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id)]);
    if (!emp) throw new BadRequestException('Choose the staff member.');
    const [type] = await this.manager.query(`select id, name, paid from hr_leave_type where id = $1 and active`, [Number(b?.leave_type_id)]);
    if (!type) throw new BadRequestException('Choose the leave type.');
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
      `select r.*, e.weekly_off, t.paid, t.name as type_name, t.annual_days::float as annual, u.full_name
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
      `select e.id as employee_id, u.full_name as name, t.id as type_id, t.code, t.name as type, t.paid, t.annual_days::float as entitled,
              coalesce(sum(r.days) filter (where r.status = 'APPROVED'), 0)::float as used,
              coalesce(sum(r.days) filter (where r.status = 'PENDING'), 0)::float as pending
         from hr_employee e left join app_user u on u.id = e.user_id
         cross join hr_leave_type t
         left join hr_leave_request r on r.employee_id = e.id and r.leave_type_id = t.id and extract(year from r.from_date) = $1
        where e.status = 'ACTIVE' and t.active
        group by e.id, u.full_name, t.id, t.code, t.name, t.paid, t.annual_days
        order by u.full_name, t.paid desc, t.name`, [year]);
  }

  // ------------------------------------------------------------------ attendance
  /** the month grid: every person employed in the month, each day's mark, and approved leave */
  async grid(period: string) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const start = period + '-01';
    const emps = await this.manager.query(
      `select e.id, u.full_name as name, e.weekly_off, to_char(e.join_date, 'YYYY-MM-DD') as join_date, to_char(e.exit_date, 'YYYY-MM-DD') as exit_date
         from hr_employee e left join app_user u on u.id = e.user_id
        where e.join_date <= (date_trunc('month', $1::date) + interval '1 month - 1 day') and (e.exit_date is null or e.exit_date >= $1::date)
        order by u.full_name`, [start]);
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
    const [emp] = await this.manager.query(`select e.id, e.join_date, e.exit_date, u.full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [Number(b?.employee_id)]);
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
