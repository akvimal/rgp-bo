import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const WEEKLY_OFF = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'ROTATION'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^[0-9+\-\s]{7,20}$/;

const clean = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));

/** Staff records, pay components and dated salary revisions. */
@Injectable()
export class HrStaffService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------ staff
  async list() {
    return this.manager.query(
      `select e.id, e.emp_code, e.designation, e.emp_type, e.status, e.join_date, e.exit_date, e.weekly_off, e.user_id,
              coalesce(e.full_name, u.full_name) as name, coalesce(u.email, '') as email, (select r.name from app_role r where r.id = u.role_id) as role_name, e.work_days, to_char(e.work_start, 'HH24:MI') as work_start, to_char(e.work_end, 'HH24:MI') as work_end, s.location as store, (e.user_id is not null) as has_login,
              (select coalesce(json_agg(json_build_object('id', st.id, 'name', st.location) order by st.location), '[]'::json) from user_stores us join stores st on st.id = us.store_id where us.user_id = e.user_id and us.active and not us.archive) as stores,
              (select coalesce(sum(l.amount) filter (where c.kind = 'EARNING'), 0)::float
                 from hr_salary_revision r join hr_salary_revision_line l on l.revision_id = r.id join hr_pay_component c on c.id = l.component_id
                where r.employee_id = e.id and r.effective_from = (select max(effective_from) from hr_salary_revision where employee_id = e.id and effective_from <= current_date)) as monthly_earnings
         from hr_employee e
         left join app_user u on u.id = e.user_id
         left join stores s on s.id = e.store_id
        order by (e.status = 'ACTIVE') desc, coalesce(e.full_name, u.full_name)`);
  }

  /** active logins that have no staff record yet */
  async candidates() {
    return this.manager.query(
      `select u.id, u.full_name as name, u.email, (select coalesce(json_agg(json_build_object('id', st.id, 'name', st.location) order by st.location), '[]'::json) from user_stores us join stores st on st.id = us.store_id where us.user_id = u.id and us.active and not us.archive) as stores from app_user u
        where u.active and not exists (select 1 from hr_employee e where e.user_id = u.id) order by u.full_name`);
  }

  async stores() {
    return this.manager.query(`select id, location as name from stores where active order by location`);
  }

  async get(id: number) {
    const [e] = await this.manager.query(
      `select e.*, (select r.name from app_role r where r.id = u.role_id) as role_name, to_char(e.work_start, 'HH24:MI') as work_start, to_char(e.work_end, 'HH24:MI') as work_end, coalesce(e.full_name, u.full_name) as name, u.email, coalesce(e.phone, u.phone) as phone, (e.user_id is not null) as has_login, s.location as store,
              (select coalesce(json_agg(json_build_object('id', st.id, 'name', st.location) order by st.location), '[]'::json) from user_stores us join stores st on st.id = us.store_id where us.user_id = e.user_id and us.active and not us.archive) as stores
         from hr_employee e left join app_user u on u.id = e.user_id left join stores s on s.id = e.store_id where e.id = $1`, [id]);
    if (!e) throw new NotFoundException('Staff member not found.');
    const revisions = await this.manager.query(
      `select r.id, r.effective_from, r.reason, b.full_name as by_name,
              (select json_agg(json_build_object('component_id', c.id, 'code', c.code, 'name', c.name, 'kind', c.kind, 'amount', l.amount::float) order by c.display_order)
                 from hr_salary_revision_line l join hr_pay_component c on c.id = l.component_id where l.revision_id = r.id) as lines
         from hr_salary_revision r left join app_user b on b.id = r.created_by
        where r.employee_id = $1 order by r.effective_from desc`, [id]);
    return { ...e, revisions };
  }

  /** a staff member's stores are those their login is mapped to (Settings > Users); the base store must be one of them */
  private async checkBaseStore(userId: number, storeId?: number | null) {
    if (!storeId) return;
    const mine = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [userId]);
    if (mine.length && !mine.some((m: any) => Number(m.store_id) === Number(storeId))) {
      throw new BadRequestException('The base store must be one of the stores this login is mapped to.');
    }
  }

  /** working days and hours are a part-timer's; full-time staff follow the weekly off */
  private partTimeOnly(f: any, type: string) {
    if (type !== 'PART_TIME' && (f.work_days || f.work_start)) throw new BadRequestException('Working days and hours are for part-time staff.');
  }

  private validate(b: any, creating: boolean) {
    const out: any = {};
    if (creating) {
      if (!DATE.test(b?.join_date || '')) throw new BadRequestException('The joining date is required.');
      out.join_date = b.join_date;
    }
    if (b.designation !== undefined) out.designation = clean(b.designation, 60);
    if (b.store_id !== undefined) out.store_id = b.store_id ? Number(b.store_id) : null;
    if (b.emp_type !== undefined) {
      if (!['FULL_TIME', 'PART_TIME'].includes(b.emp_type)) throw new BadRequestException('Type must be full time or part time.');
      out.emp_type = b.emp_type;
    }
    if (b.weekly_off !== undefined) {
      if (!WEEKLY_OFF.includes(b.weekly_off)) throw new BadRequestException('Weekly off is a day of the week, or a rotation.');
      out.weekly_off = b.weekly_off;
    }
    if (b.dob !== undefined) {
      if (b.dob && !DATE.test(b.dob)) throw new BadRequestException('Date of birth is not a valid date.');
      out.dob = b.dob || null;
    }
    if (b.pan !== undefined) {
      const pan = clean(b.pan, 40)?.toUpperCase() ?? null;
      if (pan && !PAN.test(pan)) throw new BadRequestException('PAN should look like ABCDE1234F.');
      out.pan = pan;
    }
    if (b.aadhaar_last4 !== undefined) {
      const a = clean(b.aadhaar_last4, 20);
      if (a && !/^\d{4}$/.test(a)) throw new BadRequestException('Give the last 4 digits of Aadhaar only.');
      out.aadhaar_last4 = a;
    }
    if (b.ifsc !== undefined) {
      const i = clean(b.ifsc, 40)?.toUpperCase() ?? null;
      if (i && !IFSC.test(i)) throw new BadRequestException('IFSC should look like SBIN0001234.');
      out.ifsc = i;
    }
    if (b.work_days !== undefined) {
      const d = Array.isArray(b.work_days) ? b.work_days : [];
      if (d.some((x: any) => !WEEKLY_OFF.includes(x) || x === 'ROTATION')) throw new BadRequestException('Working days must be days of the week.');
      out.work_days = d.length ? Array.from(new Set(d)) : null;
    }
    if (b.work_start !== undefined || b.work_end !== undefined) {
      const st = clean(b.work_start, 5), en = clean(b.work_end, 5);
      if ((st && !TIME.test(st)) || (en && !TIME.test(en))) throw new BadRequestException('Working hours should look like 09:00.');
      if (!!st !== !!en) throw new BadRequestException('Give both the start and the end time, or neither.');
      if (st && en && en <= st) throw new BadRequestException('The end time must be after the start time.');
      out.work_start = st;
      out.work_end = en;
    }
    if (b.phone !== undefined) {
      const p = clean(b.phone, 40);
      if (p && !PHONE.test(p)) throw new BadRequestException('The phone number is not valid.');
      out.phone = p;
    }
    if (b.emergency_phone !== undefined) {
      const p = clean(b.emergency_phone, 40);
      if (p && !PHONE.test(p)) throw new BadRequestException('The emergency phone number is not valid.');
      out.emergency_phone = p;
    }
    if (b.account_no !== undefined) {
      const a = clean(b.account_no, 60);
      if (a && !/^[0-9A-Za-z]{6,30}$/.test(a)) throw new BadRequestException('The account number is not valid.');
      out.account_no = a;
    }
    for (const [k, n] of [['address', 300], ['emergency_name', 80], ['bank_name', 60], ['notes', 300]] as const) if (b[k] !== undefined) out[k] = clean(b[k], n);
    return out;
  }

  async create(b: any, by: any) {
    const userId = Number(b?.user_id) || null;
    let who: string | null = null;
    if (userId) {
      const [u] = await this.manager.query(`select id, full_name from app_user where id = $1 and active`, [userId]);
      if (!u) throw new BadRequestException('That login was not found or is not active.');
      who = u.full_name;
    } else {
      who = clean(b?.full_name, 80);
      if (!who) throw new BadRequestException('Choose the login this staff member uses, or enter their name if they have none.');
    }
    const u = { full_name: who };
    const [dup] = userId ? await this.manager.query(`select id from hr_employee where user_id = $1`, [userId]) : [null];
    if (dup) throw new BadRequestException(`${u.full_name} already has a staff record.`);
    const f = this.validate(b, true);
    this.partTimeOnly(f, f.emp_type || 'FULL_TIME');
    if (userId) await this.checkBaseStore(userId, f.store_id);
    let code = clean(b.emp_code, 20);
    if (!code) {
      const [n] = await this.manager.query(`select coalesce(max(substring(emp_code from '[0-9]+$')::int), 0) + 1 as n from hr_employee where emp_code ~ '^E[0-9]+$'`);
      code = `E${String(n.n).padStart(3, '0')}`;
    }
    const [ex] = await this.manager.query(`select 1 from hr_employee where emp_code = $1`, [code]);
    if (ex) throw new BadRequestException(`Staff code ${code} is already used.`);
    const cols = { user_id: userId, full_name: userId ? null : who, emp_code: code, created_by: by.id, ...f };
    const keys = Object.keys(cols);
    const [row] = await this.manager.query(
      `insert into hr_employee (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning id`, keys.map(k => (cols as any)[k]));
    await this.audit.record({ userId: by.id, action: 'hr.staff_added', entityType: 'hr_employee', entityId: row.id, summary: `Staff record added: ${u.full_name} (${code})`, details: {} });
    return { id: row.id, emp_code: code };
  }

  async update(id: number, b: any, by: any) {
    const [cur] = await this.manager.query(`select e.id, e.user_id, coalesce(e.full_name, u.full_name) as full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [id]);
    if (!cur) throw new NotFoundException('Staff member not found.');
    const f = this.validate(b, false);
    const [t] = await this.manager.query(`select emp_type from hr_employee where id = $1`, [id]);
    if (f.emp_type === 'FULL_TIME') Object.assign(f, { work_days: null, work_start: null, work_end: null });
    else this.partTimeOnly(f, f.emp_type || t.emp_type);
    if (cur.user_id) delete f.phone; // a login's own phone is kept in Settings > Users
    else if (b.full_name !== undefined) {
      const nm = clean(b.full_name, 80);
      if (!nm) throw new BadRequestException('The name cannot be empty.');
      f.full_name = nm;
    }
    if (f.store_id) {
      const [e] = await this.manager.query(`select user_id from hr_employee where id = $1`, [id]);
      if (e.user_id) await this.checkBaseStore(e.user_id, f.store_id);
    }
    if (b.join_date !== undefined) {
      if (!DATE.test(b.join_date)) throw new BadRequestException('The joining date is not a valid date.');
      f.join_date = b.join_date;
    }
    if (b.emp_code !== undefined) {
      const code = clean(b.emp_code, 20);
      if (!code) throw new BadRequestException('The staff code cannot be empty.');
      const [ex] = await this.manager.query(`select 1 from hr_employee where emp_code = $1 and id <> $2`, [code, id]);
      if (ex) throw new BadRequestException(`Staff code ${code} is already used.`);
      f.emp_code = code;
    }
    const keys = Object.keys(f);
    if (!keys.length) return { id };
    await this.manager.query(`update hr_employee set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_on = now() where id = $1`, [id, ...keys.map(k => f[k])]);
    await this.audit.record({ userId: by.id, action: 'hr.staff_updated', entityType: 'hr_employee', entityId: id, summary: `Staff record changed: ${cur.full_name} (${keys.join(', ')})`, details: { fields: keys } });
    return { id };
  }

  /** leaving: the record stays for history and the final payroll; no more payroll after the exit month */
  async exit(id: number, b: any, by: any) {
    if (!DATE.test(b?.exit_date || '')) throw new BadRequestException('Give the last working day.');
    const [cur] = await this.manager.query(`select e.id, e.join_date, coalesce(e.full_name, u.full_name) as full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [id]);
    if (!cur) throw new NotFoundException('Staff member not found.');
    if (b.exit_date < String(cur.join_date).slice(0, 10)) throw new BadRequestException('The last working day is before the joining date.');
    await this.manager.query(`update hr_employee set exit_date = $2, status = 'EXITED', updated_on = now() where id = $1`, [id, b.exit_date]);
    await this.audit.record({ userId: by.id, action: 'hr.staff_exit', entityType: 'hr_employee', entityId: id, summary: `${cur.full_name} left on ${b.exit_date}`, details: {} });
    return { id };
  }

  async rejoin(id: number, by: any) {
    await this.manager.query(`update hr_employee set exit_date = null, status = 'ACTIVE', updated_on = now() where id = $1`, [id]);
    await this.audit.record({ userId: by.id, action: 'hr.staff_rejoin', entityType: 'hr_employee', entityId: id, summary: 'Staff record reactivated', details: {} });
    return { id };
  }

  /** give a staff member without a login their login, once it exists; the login's name and details take over */
  async linkLogin(id: number, b: any, by: any) {
    const [e] = await this.manager.query(`select id, user_id, store_id, full_name from hr_employee where id = $1`, [id]);
    if (!e) throw new NotFoundException('Staff member not found.');
    if (e.user_id) throw new BadRequestException('This staff member already has a login.');
    const userId = Number(b?.user_id);
    if (!userId) throw new BadRequestException('Choose the login to link.');
    const [u] = await this.manager.query(`select id, full_name from app_user where id = $1 and active`, [userId]);
    if (!u) throw new BadRequestException('That login was not found or is not active.');
    const [dup] = await this.manager.query(`select 1 from hr_employee where user_id = $1`, [userId]);
    if (dup) throw new BadRequestException(`${u.full_name} already has a staff record.`);
    await this.checkBaseStore(userId, e.store_id);
    await this.manager.query(`update hr_employee set user_id = $2, full_name = null, updated_on = now() where id = $1`, [id, userId]);
    await this.audit.record({ userId: by.id, action: 'hr.staff_login_linked', entityType: 'hr_employee', entityId: id,
      summary: `Login linked: ${e.full_name} is now ${u.full_name}'s staff record`, details: { userId } });
    return { id };
  }

  // ------------------------------------------------------------------ pay components
  components() {
    return this.manager.query(`select id, code, name, kind, display_order, active, applies_roles from hr_pay_component order by kind, display_order, name`);
  }

  async saveComponent(id: number | null, b: any, by: any) {
    const name = clean(b?.name, 60);
    if (!name) throw new BadRequestException('Give the component a name.');
    if (!['EARNING', 'DEDUCTION'].includes(b?.kind)) throw new BadRequestException('A component is an earning or a deduction.');
    const roles = this.roleList(b?.applies_roles);
    await this.checkRoles(roles);
    if (id) {
      const [cur] = await this.manager.query(`select kind from hr_pay_component where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Component not found.');
      if (cur.kind !== b.kind) throw new BadRequestException('A component cannot change between earning and deduction.');
      await this.manager.query(`update hr_pay_component set name = $2, display_order = $3, active = $4, applies_roles = $5 where id = $1`,
        [id, name, Number(b.display_order) || 10, b.active !== false, roles]);
    } else {
      const code = String(clean(b.code, 20) || name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
      if (!code) throw new BadRequestException('Give the component a code.');
      const [ex] = await this.manager.query(`select 1 from hr_pay_component where code = $1`, [code]);
      if (ex) throw new BadRequestException(`A component with code ${code} exists.`);
      const [r] = await this.manager.query(`insert into hr_pay_component (code, name, kind, display_order, applies_roles) values ($1,$2,$3,$4,$5) returning id`, [code, name, b.kind, Number(b.display_order) || 10, roles]);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'hr.component_saved', entityType: 'hr_pay_component', entityId: id, summary: `Pay component ${name} saved`, details: {} });
    return { id };
  }

  /**
   * Take a pay component off the list. One never used in a salary is deleted; one in the salary history cannot be, since
   * past pay slips and revisions refer to it, so it is made inactive instead (it stays on the old slips, not on new salaries).
   */
  async removeComponent(id: number, by: any) {
    const [c] = await this.manager.query(`select id, name from hr_pay_component where id = $1`, [id]);
    if (!c) throw new NotFoundException('Component not found.');
    const [u] = await this.manager.query(`select count(*)::int as n from hr_salary_revision_line where component_id = $1`, [id]);
    if (u.n > 0) {
      await this.manager.query(`update hr_pay_component set active = false where id = $1`, [id]);
      await this.audit.record({ userId: by.id, action: 'hr.component_deactivated', entityType: 'hr_pay_component', entityId: id, summary: `Pay component ${c.name} made inactive (used in ${u.n} salary lines)`, details: {} });
      return { removed: false, deactivated: true, uses: u.n };
    }
    await this.manager.query(`delete from hr_pay_component where id = $1`, [id]);
    await this.audit.record({ userId: by.id, action: 'hr.component_removed', entityType: 'hr_pay_component', entityId: id, summary: `Pay component ${c.name} removed`, details: {} });
    return { removed: true, deactivated: false, uses: 0 };
  }

  roleList(v: any): string[] | null {
    const a = Array.from(new Set((Array.isArray(v) ? v : []).map((x: any) => String(x).trim()).filter(Boolean))).slice(0, 20) as string[];
    return a.length ? a : null;
  }

  async checkRoles(roles: string[] | null) {
    if (!roles) return;
    const known = await this.manager.query(`select name from app_role where name = any($1::text[]) and name <> 'Site Admin'`, [roles]);
    if (known.length !== roles.length) throw new BadRequestException('One of the roles is not a role in this system.');
  }

  // ------------------------------------------------------------------ salary revisions
  async addRevision(employeeId: number, b: any, by: any) {
    const [emp] = await this.manager.query(
      `select e.id, coalesce(e.full_name, u.full_name) as full_name, (select r.name from app_role r where r.id = u.role_id) as role_name
         from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [employeeId]);
    if (!emp) throw new NotFoundException('Staff member not found.');
    if (!DATE.test(b?.effective_from || '')) throw new BadRequestException('Give the date the new salary applies from.');
    const lines: { component_id: number; amount: number }[] = (Array.isArray(b?.lines) ? b.lines : [])
      .map((l: any) => ({ component_id: Number(l.component_id), amount: Math.round(Number(l.amount) * 100) / 100 }))
      .filter((l: any) => l.component_id && Number.isFinite(l.amount) && l.amount > 0);
    if (!lines.length) throw new BadRequestException('Enter at least one component amount.');
    const comps = await this.manager.query(`select id, kind, name, applies_roles from hr_pay_component where id = any($1) and active`, [lines.map(l => l.component_id)]);
    if (comps.length !== new Set(lines.map(l => l.component_id)).size) throw new BadRequestException('A pay component in the list is not valid.');
    const off = comps.find((c: any) => c.applies_roles?.length && !c.applies_roles.includes(emp.role_name));
    if (off) throw new BadRequestException(`${off.name} does not apply to ${emp.role_name ? 'the ' + emp.role_name + ' role' : 'staff without a login'}.`);
    const earn = lines.filter(l => comps.find((c: any) => c.id === l.component_id)?.kind === 'EARNING').reduce((t, l) => t + l.amount, 0);
    if (!(earn > 0)) throw new BadRequestException('A salary needs at least one earning.');
    const [dup] = await this.manager.query(`select 1 from hr_salary_revision where employee_id = $1 and effective_from = $2`, [employeeId, b.effective_from]);
    if (dup) throw new BadRequestException('There is already a revision from that date.');
    const id = await this.manager.transaction(async tm => {
      const [r] = await tm.query(`insert into hr_salary_revision (employee_id, effective_from, reason, created_by) values ($1,$2,$3,$4) returning id`,
        [employeeId, b.effective_from, clean(b.reason, 200), by.id]);
      for (const l of lines) await tm.query(`insert into hr_salary_revision_line (revision_id, component_id, amount) values ($1,$2,$3)`, [r.id, l.component_id, l.amount]);
      return r.id;
    });
    await this.audit.record({ userId: by.id, action: 'hr.salary_revised', entityType: 'hr_employee', entityId: employeeId,
      summary: `${emp.full_name}: salary revised from ${b.effective_from}, earnings ${earn.toFixed(2)}`, details: { revisionId: id, lines } });
    return { id };
  }

  /** only a revision that is still in the future can be removed; past ones are history */
  async deleteRevision(id: number, by: any) {
    const [r] = await this.manager.query(`select id, employee_id, effective_from from hr_salary_revision where id = $1`, [id]);
    if (!r) throw new NotFoundException('Revision not found.');
    if (new Date(r.effective_from) <= new Date(new Date().toISOString().slice(0, 10))) throw new BadRequestException('A revision that has taken effect stays as history; add a new revision instead.');
    await this.manager.query(`delete from hr_salary_revision where id = $1`, [id]);
    await this.audit.record({ userId: by.id, action: 'hr.revision_removed', entityType: 'hr_employee', entityId: r.employee_id, summary: 'Future salary revision removed', details: { revisionId: id } });
    return { id };
  }
}
