import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { BUSINESS_OF_USER_SQL, businessOfUser } from 'src/core/business-of-user';
import { NOT_A_PERSON, isManagerRole, isOwnerRole } from 'src/core/roles';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[0-9+() -]{6,20}$/;
const REG = /^[A-Za-z0-9/.-]{3,30}$/;

const clean = (v: any, max: number): string | null => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (t.length > max) throw new BadRequestException(`That is longer than ${max} characters.`);
  return t || null;
};

/**
 * Whether a person works at a pharmacy store: one of their stores is a pharmacy, or they have no store of their own (which
 * means every store of the business) and the business has a pharmacy store. Uses the alias u of the user table.
 */
const WORKS_AT_PHARMACY = `(
  exists (select 1 from user_stores us join stores s on s.id = us.store_id
           where us.user_id = u.id and us.active and not us.archive and s.active and not s.archive and s.store_type = 'pharmacy')
  or (not exists (select 1 from user_stores us2 where us2.user_id = u.id and us2.active and not us2.archive)
      and exists (select 1 from stores s2 where s2.business_id = ${BUSINESS_OF_USER_SQL} and s2.active and not s2.archive and s2.store_type = 'pharmacy')))`;

/** How near a registration's end date is: lapsed, within 60 days, fine, or none recorded. */
export function registrationStatus(regNo: string | null, validTo: string | null, today = new Date().toISOString().slice(0, 10)): 'NONE' | 'VALID' | 'EXPIRING' | 'EXPIRED' {
  if (!regNo) return 'NONE';
  if (!validTo) return 'VALID';
  if (validTo < today) return 'EXPIRED';
  const soon = new Date(new Date(today + 'T00:00:00Z').getTime() + 60 * 86400000).toISOString().slice(0, 10);
  return validTo <= soon ? 'EXPIRING' : 'VALID';
}

/**
 * The few staff details a shop wants even without the HR module: who may dispense (the pharmacist registration and when it
 * lapses), when they joined, their designation and an emergency contact. They are kept on the same staff record the HR module
 * uses, so a shop that turns HR on later finds them there. Pay, bank, ID numbers, leave and attendance are not part of this.
 */
@Injectable()
export class StaffDetailsService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async caller(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const role: string = r?.name || '';
    if (!isManagerRole(role)) throw new ForbiddenException('Only the owner or a Store Head can see staff details.');
    const stores: number[] = (await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id])).map((x: any) => x.store_id);
    return { id: user.id as number, role, owner: isOwnerRole(role), stores, businessId: await businessOfUser(this.manager, user.id) };
  }

  /** the people this caller may see: the whole business for an owner, the people of their own stores for a Store Head */
  private scope(c: { owner: boolean; stores: number[]; businessId: number | null; id: number }, args: any[]): string {
    const who = `u.active and not u.archive and r.name <> all($${args.push(NOT_A_PERSON)}::text[])`;
    if (c.owner) { args.push(c.businessId); return `${who} and ${BUSINESS_OF_USER_SQL} = $${args.length}`; }
    args.push(c.stores);
    return `${who} and r.name not in ('Business Head', 'Owner-operator', 'Store Head')
            and exists (select 1 from user_stores us where us.user_id = u.id and us.active and not us.archive and us.store_id = any($${args.length}::int[]))`;
  }

  private row(r: any) {
    return { ...r, reg_status: registrationStatus(r.pharmacist_reg_no, r.pharmacist_valid_to) };
  }

  async list(user: any) {
    const c = await this.caller(user);
    const args: any[] = [];
    const where = this.scope(c, args);
    const rows = await this.manager.query(
      `select u.id as user_id, u.full_name, u.email, r.name as role, e.id as employee_id, e.designation, to_char(e.join_date, 'YYYY-MM-DD') as join_date,
              e.emergency_name, e.emergency_phone, e.pharmacist_reg_no, e.pharmacist_council, to_char(e.pharmacist_valid_to, 'YYYY-MM-DD') as pharmacist_valid_to,
              ${WORKS_AT_PHARMACY} as pharmacy
         from app_user u join app_role r on r.id = u.role_id left join hr_employee e on e.user_id = u.id
        where ${where} order by u.full_name`, args);
    const people = rows.map((x: any) => this.row(x));
    return {
      people,
      attention: people.filter((p: any) => p.reg_status === 'EXPIRED' || p.reg_status === 'EXPIRING').length,
    };
  }

  async save(userId: number, b: any, user: any) {
    const c = await this.caller(user);
    const args: any[] = [userId];
    const allowed = await this.manager.query(
      `select u.id, u.full_name, ${WORKS_AT_PHARMACY} as pharmacy from app_user u join app_role r on r.id = u.role_id where u.id = $1 and ${this.scope(c, args)}`, args);
    if (!allowed[0]) throw new NotFoundException('That person was not found, or is not one you manage.');

    const f: Record<string, any> = {};
    if (b.designation !== undefined) f.designation = clean(b.designation, 60);
    if (b.emergency_name !== undefined) f.emergency_name = clean(b.emergency_name, 80);
    if (b.emergency_phone !== undefined) {
      const p = clean(b.emergency_phone, 20);
      if (p && !PHONE.test(p)) throw new BadRequestException('The emergency phone number is not valid.');
      f.emergency_phone = p;
    }
    if (b.join_date !== undefined) {
      if (b.join_date && (!DATE.test(b.join_date) || isNaN(Date.parse(b.join_date)))) throw new BadRequestException('The joining date is not a valid date.');
      if (b.join_date && b.join_date > new Date().toISOString().slice(0, 10)) throw new BadRequestException('The joining date cannot be in the future.');
      f.join_date = b.join_date || null;
    }
    if (b.pharmacist_reg_no !== undefined) {
      const n = clean(b.pharmacist_reg_no, 30);
      if (n && !REG.test(n)) throw new BadRequestException('The registration number can have letters, digits, / . and - only (3 to 30 characters).');
      f.pharmacist_reg_no = n ? n.toUpperCase() : null;
    }
    if (b.pharmacist_council !== undefined) f.pharmacist_council = clean(b.pharmacist_council, 60);
    if (b.pharmacist_valid_to !== undefined) {
      if (b.pharmacist_valid_to && (!DATE.test(b.pharmacist_valid_to) || isNaN(Date.parse(b.pharmacist_valid_to)))) throw new BadRequestException('The registration end date is not a valid date.');
      f.pharmacist_valid_to = b.pharmacist_valid_to || null;
    }

    if (!Object.keys(f).length) throw new BadRequestException('Nothing to change.');
    if (!allowed[0].pharmacy && (f.pharmacist_reg_no || f.pharmacist_council || f.pharmacist_valid_to)) {
      throw new BadRequestException('A pharmacist registration applies to people who work at a pharmacy store.');
    }
    const [cur] = await this.manager.query(`select id, pharmacist_reg_no from hr_employee where user_id = $1`, [userId]);
    // a council or end date means nothing without the number
    const regAfter = f.pharmacist_reg_no !== undefined ? f.pharmacist_reg_no : cur?.pharmacist_reg_no;
    if (!regAfter && (f.pharmacist_council || f.pharmacist_valid_to)) throw new BadRequestException('Enter the registration number with its council and end date.');
    if (f.pharmacist_reg_no === null) { f.pharmacist_council = null; f.pharmacist_valid_to = null; }

    if (cur) {
      const keys = Object.keys(f);
      if (!keys.length) throw new BadRequestException('Nothing to change.');
      if ('join_date' in f && !f.join_date) throw new BadRequestException('The joining date cannot be empty.');
      await this.manager.query(`update hr_employee set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_on = now() where id = $1`, [cur.id, ...keys.map((k) => f[k])]);
    } else {
      // first time: this makes the person's staff record (the one the HR module uses), with the joining date they gave or today
      const [n] = await this.manager.query(`select coalesce(max(substring(emp_code from '[0-9]+$')::int), 0) + 1 as n from hr_employee where emp_code ~ '^E[0-9]+$'`);
      const [store] = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive order by is_primary desc, id limit 1`, [userId]);
      const cols: Record<string, any> = { user_id: userId, emp_code: `E${String(n.n).padStart(3, '0')}`, store_id: store?.store_id ?? null, created_by: user.id, ...f, join_date: f.join_date || new Date().toISOString().slice(0, 10) };
      const keys = Object.keys(cols);
      await this.manager.query(`insert into hr_employee (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map((k) => cols[k]));
    }
    await this.audit.record({
      userId: user.id, action: 'staff_details.saved', entityType: 'app_user', entityId: userId,
      summary: `Staff details saved for ${allowed[0].full_name}`, details: { fields: Object.keys(f) },
    });
    return (await this.list(user)).people.find((p: any) => p.user_id === userId);
  }
}
