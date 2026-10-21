import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
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
              u.full_name as name, u.email, s.location as store,
              (select coalesce(sum(l.amount) filter (where c.kind = 'EARNING'), 0)::float
                 from hr_salary_revision r join hr_salary_revision_line l on l.revision_id = r.id join hr_pay_component c on c.id = l.component_id
                where r.employee_id = e.id and r.effective_from = (select max(effective_from) from hr_salary_revision where employee_id = e.id and effective_from <= current_date)) as monthly_earnings
         from hr_employee e
         left join app_user u on u.id = e.user_id
         left join stores s on s.id = e.store_id
        order by (e.status = 'ACTIVE') desc, u.full_name`);
  }

  /** active logins that have no staff record yet */
  async candidates() {
    return this.manager.query(
      `select u.id, u.full_name as name, u.email from app_user u
        where u.active and not exists (select 1 from hr_employee e where e.user_id = u.id) order by u.full_name`);
  }

  async stores() {
    return this.manager.query(`select id, location as name from stores where active order by location`);
  }

  async get(id: number) {
    const [e] = await this.manager.query(
      `select e.*, u.full_name as name, u.email, u.phone, s.location as store
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
      if (!['SUNDAY', 'ROTATION'].includes(b.weekly_off)) throw new BadRequestException('Weekly off is Sunday or rotation.');
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
    const userId = Number(b?.user_id);
    if (!userId) throw new BadRequestException('Choose the login this staff member uses.');
    const [u] = await this.manager.query(`select id, full_name from app_user where id = $1 and active`, [userId]);
    if (!u) throw new BadRequestException('That login was not found or is not active.');
    const [dup] = await this.manager.query(`select id from hr_employee where user_id = $1`, [userId]);
    if (dup) throw new BadRequestException(`${u.full_name} already has a staff record.`);
    const f = this.validate(b, true);
    let code = clean(b.emp_code, 20);
    if (!code) {
      const [n] = await this.manager.query(`select coalesce(max(substring(emp_code from '[0-9]+$')::int), 0) + 1 as n from hr_employee where emp_code ~ '^E[0-9]+$'`);
      code = `E${String(n.n).padStart(3, '0')}`;
    }
    const [ex] = await this.manager.query(`select 1 from hr_employee where emp_code = $1`, [code]);
    if (ex) throw new BadRequestException(`Staff code ${code} is already used.`);
    const cols = { user_id: userId, emp_code: code, created_by: by.id, ...f };
    const keys = Object.keys(cols);
    const [row] = await this.manager.query(
      `insert into hr_employee (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning id`, keys.map(k => (cols as any)[k]));
    await this.audit.record({ userId: by.id, action: 'hr.staff_added', entityType: 'hr_employee', entityId: row.id, summary: `Staff record added: ${u.full_name} (${code})`, details: {} });
    return { id: row.id, emp_code: code };
  }

  async update(id: number, b: any, by: any) {
    const [cur] = await this.manager.query(`select e.id, u.full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [id]);
    if (!cur) throw new NotFoundException('Staff member not found.');
    const f = this.validate(b, false);
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
    const [cur] = await this.manager.query(`select e.id, e.join_date, u.full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [id]);
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

  // ------------------------------------------------------------------ pay components
  components() {
    return this.manager.query(`select id, code, name, kind, display_order, active from hr_pay_component order by kind, display_order, name`);
  }

  async saveComponent(id: number | null, b: any, by: any) {
    const name = clean(b?.name, 60);
    if (!name) throw new BadRequestException('Give the component a name.');
    if (!['EARNING', 'DEDUCTION'].includes(b?.kind)) throw new BadRequestException('A component is an earning or a deduction.');
    if (id) {
      const [cur] = await this.manager.query(`select kind from hr_pay_component where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Component not found.');
      if (cur.kind !== b.kind) throw new BadRequestException('A component cannot change between earning and deduction.');
      await this.manager.query(`update hr_pay_component set name = $2, display_order = $3, active = $4 where id = $1`,
        [id, name, Number(b.display_order) || 10, b.active !== false]);
    } else {
      const code = String(clean(b.code, 20) || name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
      if (!code) throw new BadRequestException('Give the component a code.');
      const [ex] = await this.manager.query(`select 1 from hr_pay_component where code = $1`, [code]);
      if (ex) throw new BadRequestException(`A component with code ${code} exists.`);
      const [r] = await this.manager.query(`insert into hr_pay_component (code, name, kind, display_order) values ($1,$2,$3,$4) returning id`, [code, name, b.kind, Number(b.display_order) || 10]);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'hr.component_saved', entityType: 'hr_pay_component', entityId: id, summary: `Pay component ${name} saved`, details: {} });
    return { id };
  }

  // ------------------------------------------------------------------ salary revisions
  async addRevision(employeeId: number, b: any, by: any) {
    const [emp] = await this.manager.query(`select e.id, u.full_name from hr_employee e left join app_user u on u.id = e.user_id where e.id = $1`, [employeeId]);
    if (!emp) throw new NotFoundException('Staff member not found.');
    if (!DATE.test(b?.effective_from || '')) throw new BadRequestException('Give the date the new salary applies from.');
    const lines: { component_id: number; amount: number }[] = (Array.isArray(b?.lines) ? b.lines : [])
      .map((l: any) => ({ component_id: Number(l.component_id), amount: Math.round(Number(l.amount) * 100) / 100 }))
      .filter((l: any) => l.component_id && Number.isFinite(l.amount) && l.amount > 0);
    if (!lines.length) throw new BadRequestException('Enter at least one component amount.');
    const comps = await this.manager.query(`select id, kind from hr_pay_component where id = any($1) and active`, [lines.map(l => l.component_id)]);
    if (comps.length !== new Set(lines.map(l => l.component_id)).size) throw new BadRequestException('A pay component in the list is not valid.');
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
