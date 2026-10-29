import { appliesToPosition } from './hr-link';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { HrLeaveService } from './hr-leave.service';
import { HrPayrollService } from './hr-payroll.service';

import { isOwnerRole } from 'src/core/roles';
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const PHONE = /^[0-9+\-\s]{7,20}$/;
const text = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const mask = (v: string | null, keep: number) => (v ? 'X'.repeat(Math.max(String(v).length - keep, 0)) + String(v).slice(-keep) : null);
const iso = (d: any) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
/** how far back a staff member may ask for leave themselves */
const BACKDATE_DAYS = 7;

/**
 * "My HR": a staff member's own record, pay slips (once payroll is approved), leave, attendance and staff credit. Everything
 * is looked up from the signed-in user's own staff record; nothing here takes a staff id from the request.
 */
@Injectable()
export class HrSelfService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly leave: HrLeaveService,
    private readonly payroll: HrPayrollService,
  ) {}

  private async mine(user: any) {
    const [e] = await this.manager.query(
      `select e.id, e.status, e.position_id, coalesce(e.full_name, u.full_name) as name, (select r.name from app_role r where r.id = u.role_id) as role_name
         from hr_employee e join app_user u on u.id = e.user_id
        where e.user_id = $1 or e.id = (select a.employee_id from hr_employee_account a where a.user_id = $1)`, [user?.id || 0]);
    return e || null;
  }

  private async need(user: any) {
    const e = await this.mine(user);
    if (!e) throw new NotFoundException('You do not have a staff record yet.');
    return e;
  }

  // ------------------------------------------------------------------ the front page
  async summary(user: any) {
    const e = await this.mine(user);
    if (!e) return { staff: false };
    const [slip] = await this.manager.query(
      `select r.period, l.net::float as net from hr_payroll_line l join hr_payroll_run r on r.id = l.run_id where l.employee_id = $1 and r.status = 'APPROVED' order by r.period desc limit 1`, [e.id]);
    const [pending] = await this.manager.query(`select count(*)::int as n from hr_leave_request where employee_id = $1 and status = 'PENDING'`, [e.id]);
    const decided = await this.manager.query(
      `select r.id, t.name as type, r.status, to_char(r.from_date, 'YYYY-MM-DD') as from_date, to_char(r.to_date, 'YYYY-MM-DD') as to_date, r.decision_note
         from hr_leave_request r join hr_leave_type t on t.id = r.leave_type_id
        where r.employee_id = $1 and r.status in ('APPROVED', 'REJECTED') and r.decided_on >= now() - interval '14 days' order by r.decided_on desc limit 5`, [e.id]);
    const [credit] = await this.manager.query(
      `select coalesce((select monthly_cap from staff_credit_limit where user_id = $1), 0)::float as cap,
              coalesce((select sum(amount) from staff_credit_entry where user_id = $1), 0)::float as outstanding`, [user.id]);
    const [hol] = await this.manager.query(`select to_char(holiday_date, 'YYYY-MM-DD') as date, name from hr_holiday where holiday_date >= current_date order by holiday_date limit 1`);
    return { staff: true, name: e.name, role: e.role_name, latestPayslip: slip || null, pendingLeave: pending.n, recentDecisions: decided, credit, nextHoliday: hol || null };
  }

  // ------------------------------------------------------------------ profile
  async profile(user: any) {
    const e = await this.mine(user);
    if (!e) return { staff: false };
    const [p] = await this.manager.query(
      `select e.emp_code, e.designation, e.emp_type, e.status, to_char(e.join_date, 'YYYY-MM-DD') as join_date, e.weekly_off, e.work_days,
              to_char(e.work_start, 'HH24:MI') as work_start, to_char(e.work_end, 'HH24:MI') as work_end, e.address, e.emergency_name, e.emergency_phone,
              e.bank_name, e.account_no, e.ifsc, e.pan, e.aadhaar_last4, coalesce(e.full_name, u.full_name) as name, u.email, coalesce(e.phone, u.phone) as phone, s.location as base_store,
              (select coalesce(json_agg(st.location order by st.location), '[]'::json) from user_stores us join stores st on st.id = us.store_id where us.user_id = e.user_id and us.active and not us.archive) as stores
         from hr_employee e join app_user u on u.id = e.user_id left join stores s on s.id = e.store_id where e.id = $1`, [e.id]);
    return {
      staff: true, ...p, role: e.role_name,
      account_no: mask(p.account_no, 4), pan: mask(p.pan, 4), aadhaar: p.aadhaar_last4 ? 'XXXX XXXX ' + p.aadhaar_last4 : null, aadhaar_last4: undefined,
    };
  }

  /** what a person may change about themselves: where to reach them and who to call; bank and identity go through the Business Head */
  async updateProfile(b: any, user: any) {
    const e = await this.need(user);
    const phone = text(b?.emergency_phone, 40);
    if (phone && !PHONE.test(phone)) throw new BadRequestException('The emergency phone number is not valid.');
    await this.manager.query(
      `update hr_employee set address = $2, emergency_name = $3, emergency_phone = $4, updated_on = now() where id = $1`,
      [e.id, text(b?.address, 300), text(b?.emergency_name, 80), phone]);
    await this.audit.record({ userId: user.id, action: 'hr.self_profile_updated', entityType: 'hr_employee', entityId: e.id, summary: `${e.name} updated their address / emergency contact`, details: {} });
    return { ok: true };
  }

  // ------------------------------------------------------------------ pay slips: approved months only
  async payslips(user: any) {
    const e = await this.mine(user);
    if (!e) return { staff: false, rows: [] };
    const rows = await this.manager.query(
      `select l.id, r.period, l.net::float as net, l.payable_days::float as payable_days, r.approved_on
         from hr_payroll_line l join hr_payroll_run r on r.id = l.run_id where l.employee_id = $1 and r.status = 'APPROVED' order by r.period desc limit 36`, [e.id]);
    return { staff: true, rows };
  }

  async payslip(lineId: number, user: any) {
    const e = await this.need(user);
    const [own] = await this.manager.query(
      `select l.id from hr_payroll_line l join hr_payroll_run r on r.id = l.run_id where l.id = $1 and l.employee_id = $2 and r.status = 'APPROVED'`, [lineId, e.id]);
    if (!own) throw new NotFoundException('Pay slip not found.');
    const s = await this.payroll.stub(lineId);
    await this.audit.record({ userId: user.id, action: 'hr.payslip_viewed', entityType: 'hr_payroll_line', entityId: lineId, summary: `${e.name} viewed the pay slip for ${s.period}`, details: {} });
    return { ...s, pan: mask(s.pan, 4) };
  }

  // ------------------------------------------------------------------ leave
  async leaveOverview(year: number, user: any) {
    const e = await this.mine(user);
    if (!e) return { staff: false };
    const y = Number.isInteger(year) && year > 2000 && year < 2100 ? year : new Date().getFullYear();
    const types = (await this.leave.types()).filter((t: any) => t.active && (!t.applies_roles?.length || t.applies_roles.includes(e.role_name)) && appliesToPosition(t.applies_positions, e.position_id));
    const balances = (await this.leave.balances(y)).filter((b: any) => b.employee_id === e.id);
    const requests = await this.leave.requests({ employee: e.id });
    const holidays = await this.leave.holidays(y);
    return { staff: true, year: y, types, balances, requests, holidays };
  }

  async applyLeave(b: any, user: any) {
    const e = await this.need(user);
    if (e.status !== 'ACTIVE') throw new BadRequestException('Your staff record is not active.');
    const earliest = new Date(Date.now() - BACKDATE_DAYS * 86400000).toISOString().slice(0, 10);
    if (typeof b?.from_date === 'string' && b.from_date < earliest) throw new BadRequestException(`Leave can be asked for up to ${BACKDATE_DAYS} days back; ask your manager to record anything earlier.`);
    // always for oneself, whatever the request says
    return this.leave.create({ ...b, employee_id: e.id }, user);
  }

  async cancelLeave(id: number, user: any) {
    const e = await this.need(user);
    const [r] = await this.manager.query(`select employee_id, status from hr_leave_request where id = $1`, [id]);
    if (!r || r.employee_id !== e.id) throw new NotFoundException('Leave request not found.');
    if (r.status !== 'PENDING') throw new BadRequestException('Only a request still waiting for a decision can be withdrawn; ask your manager about the rest.');
    return this.leave.decide(id, { action: 'cancel', note: 'Withdrawn by the staff member' }, user);
  }

  // ------------------------------------------------------------------ attendance
  async attendance(period: string, user: any) {
    const e = await this.mine(user);
    if (!e) return { staff: false };
    const p = PERIOD.test(period || '') ? period : new Date().toISOString().slice(0, 7);
    const grid = await this.leave.grid(p);
    const me = grid.staff.find((s: any) => s.id === e.id) || null;
    const days = me ? Object.values(me.marks as Record<string, string>) : [];
    return {
      staff: true, period: p, days: grid.days, holidays: grid.holidays, me,
      totals: { present: days.filter(x => x === 'PRESENT').length, absent: days.filter(x => x === 'ABSENT').length, half: days.filter(x => x === 'HALF_DAY').length, leave: me ? Object.keys(me.leave).length : 0 },
    };
  }

  // ------------------------------------------------------------------ staff credit
  async credit(user: any) {
    const e = await this.mine(user);
    if (!e) return { staff: false };
    const period = new Date().toISOString().slice(0, 7);
    const [t] = await this.manager.query(
      `select coalesce((select monthly_cap from staff_credit_limit where user_id = $1), 0)::float as cap,
              coalesce(sum(amount) filter (where period = $2 and kind = 'CREDIT'), 0)::float as used_this_month,
              coalesce(sum(amount), 0)::float as outstanding from staff_credit_entry where user_id = $1`, [user.id, period]);
    const rows = await this.manager.query(
      `select id, to_char(entry_date, 'YYYY-MM-DD') as entry_date, kind, amount::float as amount, period, note from staff_credit_entry where user_id = $1 order by created_on desc, id desc limit 60`, [user.id]);
    return { staff: true, period, ...t, rows };
  }
}

/** The inbox for the Business Head and Store Heads: leave requests of the staff they are responsible for. */
@Injectable()
export class LeaveApprovalService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly leave: HrLeaveService) {}

  private async ctx(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { id: user.id, all: isOwnerRole(r?.name), stores: s.map((x: any) => x.store_id) as number[] };
  }

  /** SQL that limits requests (alias r, employee e) to people the approver answers for, and never themselves */
  private scope(c: { id: number; all: boolean; stores: number[] }, args: any[]): string {
    args.push(c.id);
    const notMe = `e.user_id is distinct from $${args.length}`;
    if (c.all) return notMe;
    args.push(c.stores.length ? c.stores : [0]);
    const st = `$${args.length}`;
    return `${notMe} and (e.store_id = any(${st}::int[]) or exists (select 1 from user_stores us where us.user_id = e.user_id and us.active and not us.archive and us.store_id = any(${st}::int[])))`;
  }

  async list(q: any, user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const where = [this.scope(c, args)];
    const status = String(q?.status || 'PENDING').toUpperCase();
    if (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) { args.push(status); where.push(`r.status = $${args.length}`); }
    return this.manager.query(
      `select r.id, r.employee_id, coalesce(e.full_name, u.full_name) as name, e.designation, t.name as type, t.paid,
              to_char(r.from_date, 'YYYY-MM-DD') as from_date, to_char(r.to_date, 'YYYY-MM-DD') as to_date, r.days::float as days, r.half_day, r.reason, r.status, r.decision_note,
              d.full_name as decided_by_name, r.decided_on, r.created_on,
              case when t.paid then greatest(t.annual_days - coalesce((select sum(x.days) from hr_leave_request x where x.employee_id = r.employee_id and x.leave_type_id = r.leave_type_id
                    and x.status = 'APPROVED' and extract(year from x.from_date) = extract(year from r.from_date)), 0), 0)::float end as left_days
         from hr_leave_request r join hr_employee e on e.id = r.employee_id left join app_user u on u.id = e.user_id join hr_leave_type t on t.id = r.leave_type_id left join app_user d on d.id = r.decided_by
        where ${where.join(' and ')} order by (r.status = 'PENDING') desc, r.from_date, r.id limit 200`, args);
  }

  async pendingCount(user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const [n] = await this.manager.query(`select count(*)::int as n from hr_leave_request r join hr_employee e on e.id = r.employee_id where r.status = 'PENDING' and ${this.scope(c, args)}`, args);
    return n;
  }

  async decide(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const args: any[] = [id];
    const [ok] = await this.manager.query(`select r.id from hr_leave_request r join hr_employee e on e.id = r.employee_id where r.id = $1 and ${this.scope(c, args)}`, args);
    if (!ok) throw new ForbiddenException('That request is not one you decide: it is your own, or from another store.');
    return this.leave.decide(id, b, user);
  }
}
