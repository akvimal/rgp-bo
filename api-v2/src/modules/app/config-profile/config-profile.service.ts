import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { PlatformService } from 'src/core/platform/platform.service';
import { AuthHelper } from 'src/modules/auth/auth.helper';
import { BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { forgetUser } from 'src/core/active-users';
import { isOwnerRole, ROLE } from 'src/core/roles';
import { RESERVED_ROLES } from 'src/core/role-rules';
import {
  BUSINESS_FIELDS, ExistingStore, ExistingUser, FieldSpec, PROFILE_FORMAT, Plan, Profile, ProfileShift, ProfileStaff, ProfileStore, Row, SCHEMA_VERSION, STORE_FIELDS,
  parseProfile, planChangeCount, planImport, tempPassword,
} from './config-profile';
import { profileToWorkbook, workbookToProfile } from './config-profile-xlsx';

const numeric = (v: any) => (v === null || v === undefined ? null : Number(v));

/** a database row to the profile's keys, for the fields listed */
function rowToProfile(fields: FieldSpec[], row: Row): Row {
  const out: Row = {};
  for (const f of fields) {
    let v = row[f.col];
    if (f.kind === 'num') v = numeric(v);
    if (f.kind === 'intlist') v = (v ?? []).map(Number);
    out[f.key] = v === undefined ? null : v;
  }
  return out;
}

@Injectable()
export class ConfigProfileService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly platform: PlatformService,
    private readonly helper: AuthHelper,
  ) {}

  /** the business of the signed-in owner; nobody else reaches this, and nobody reaches another business */
  private async owner(user: any): Promise<{ id: number; name: string }> {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!isOwnerRole(role?.name)) throw new ForbiddenException('Only the Business Head can export or import the business setup.');
    const [b] = await this.manager.query(
      `select b.id, b.name from app_user u join business b on b.id = ${BUSINESS_OF_USER_SQL} where u.id = $1`, [user?.id || 0]);
    if (!b) throw new NotFoundException('Your user is not linked to a business.');
    return b;
  }

  // ---------------------------------------------------------------- reading

  private async readStores(m: EntityManager, businessId: number): Promise<ExistingStore[]> {
    const rows = await m.query(`select * from stores where business_id = $1 and not archive order by id`, [businessId]);
    if (!rows.length) return [];
    const ids = rows.map((r: any) => r.id);
    const vault = await m.query(
      `select store_id, coalesce(sum(case when direction = 'IN' then amount else -amount end), 0)::float as balance
         from store_vault_movements where store_id = any($1) and status = 'CONFIRMED' group by store_id`, [ids]);
    const open = await m.query(`select store_id, count(*)::int as n from store_shifts where store_id = any($1) and status = 'OPEN' group by store_id`, [ids]);
    const shifts = await m.query(
      `select t.id, t.store_id, t.name, t.start_time, t.end_time, t.active, u.email as opener
         from store_shift_templates t left join app_user u on u.id = t.assigned_user_id
        where t.store_id = any($1) and not t.archive order by t.id`, [ids]);
    return rows.map((r: any) => ({
      id: r.id, name: r.location,
      values: rowToProfile(STORE_FIELDS, r),
      vaultBalance: vault.find((v: any) => v.store_id === r.id)?.balance ?? 0,
      openShifts: open.find((v: any) => v.store_id === r.id)?.n ?? 0,
      shifts: shifts.filter((s: any) => s.store_id === r.id).map((s: any) => ({ id: s.id, name: s.name, startTime: s.start_time, endTime: s.end_time, active: s.active, openerEmail: s.opener })),
    }));
  }

  private userSelect(where: string) {
    return `select u.id, u.email, u.full_name, u.phone, u.location, u.active, u.archive, r.name as role, ${BUSINESS_OF_USER_SQL} as business_id,
              coalesce((select array_agg(s.location order by us.is_primary desc, us.id) from user_stores us join stores s on s.id = us.store_id
                         where us.user_id = u.id and us.active and not us.archive and s.business_id = $2), '{}') as stores
         from app_user u join app_role r on r.id = u.role_id where ${where}`;
  }

  private toUser = (r: any): ExistingUser => ({
    id: r.id, email: r.email, fullName: r.full_name ?? '', phone: r.phone, location: r.location, role: r.role,
    businessId: r.business_id, active: r.active, archived: r.archive, stores: r.stores ?? [],
  });

  private async roles(m: EntityManager) {
    const rows = await m.query(`select id, name, locked from app_role`);
    return Object.fromEntries(rows.map((r: any) => [r.name, { id: r.id, locked: !!r.locked }])) as Record<string, { id: number; locked: boolean }>;
  }

  /** what is set up now, as a profile */
  async export(user: any): Promise<Profile> {
    const b = await this.owner(user);
    const [biz] = await this.manager.query(`select * from business where id = $1`, [b.id]);
    const stores = await this.readStores(this.manager, b.id);
    const staff = await this.manager.query(
      this.userSelect(`$1::text[] is null and u.active and not u.archive and not r.locked and r.name <> all($3)
                       and (u.business_id = $2 or exists (select 1 from user_stores us join stores s on s.id = us.store_id where us.user_id = u.id and s.business_id = $2))`)
        + ` order by u.full_name, u.email`, [null, b.id, [...RESERVED_ROLES]]);
    return {
      format: PROFILE_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(),
      business: rowToProfile(BUSINESS_FIELDS, biz),
      stores: stores.map((s): ProfileStore => ({
        name: s.name, ...s.values,
        shifts: s.shifts.map((x): ProfileShift => ({ name: x.name, startTime: x.startTime, endTime: x.endTime, active: x.active, defaultOpener: x.openerEmail })),
      })),
      staff: staff.map((r: any): ProfileStaff => ({ email: r.email, fullName: r.full_name ?? '', phone: r.phone, location: r.location, role: r.role, stores: r.stores })),
    };
  }

  async exportWorkbook(user: any): Promise<Buffer> {
    const p = await this.export(user);
    return profileToWorkbook(p, await this.assignableRoleNames());
  }

  /** an empty workbook with the headings and the dropdowns */
  async templateWorkbook(user: any): Promise<Buffer> {
    await this.owner(user);
    return profileToWorkbook({ format: PROFILE_FORMAT, schemaVersion: SCHEMA_VERSION }, await this.assignableRoleNames());
  }

  private async assignableRoleNames(): Promise<string[]> {
    const roles = await this.roles(this.manager);
    return Object.entries(roles).filter(([n, r]) => !r.locked && !RESERVED_ROLES.includes(n)).map(([n]) => n).sort();
  }

  /** an uploaded Excel file as a profile (not yet applied) */
  async readWorkbook(user: any, buffer: Buffer): Promise<Profile> {
    await this.owner(user);
    let raw: any;
    try { raw = await workbookToProfile(buffer); } catch (e: any) { throw new BadRequestException(e.message); }
    return raw;
  }

  // ---------------------------------------------------------------- planning

  private async plan(m: EntityManager, b: { id: number }, profile: Profile): Promise<Plan> {
    const [biz] = await m.query(`select * from business where id = $1`, [b.id]);
    const emails = Array.from(new Set([
      ...(profile.staff ?? []).map((p) => p.email.toLowerCase()),
      ...(profile.stores ?? []).flatMap((s) => (s.shifts ?? []).map((x) => (x.defaultOpener ?? '').toLowerCase()).filter(Boolean)),
    ]));
    const users = emails.length ? (await m.query(this.userSelect('lower(u.email) = any($1)'), [emails, b.id])).map(this.toUser) : [];
    return planImport(profile, {
      business: rowToProfile(BUSINESS_FIELDS, biz),
      stores: await this.readStores(m, b.id),
      users, roles: await this.roles(m), businessId: b.id,
      roomLeft: { stores: await this.platform.roomLeft('stores'), users: await this.platform.roomLeft('users') },
    });
  }

  private check(raw: any) {
    const parsed = parseProfile(raw);
    if (parsed.errors.length) throw new BadRequestException({ message: 'The file has problems. Nothing was changed.', errors: parsed.errors });
    return parsed;
  }

  /** what importing the file would change; nothing is written */
  async preview(user: any, raw: any) {
    const b = await this.owner(user);
    const parsed = this.check(raw);
    const plan = await this.plan(this.manager, b, parsed.profile);
    return { plan, warnings: [...parsed.warnings, ...plan.warnings], blockers: plan.blockers, changes: planChangeCount(plan) };
  }

  // ---------------------------------------------------------------- applying

  private sets(fields: FieldSpec[], values: Row, start: number): { cols: string[]; params: any[] } {
    const cols: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (!Object.prototype.hasOwnProperty.call(values, f.key)) continue;
      const v = values[f.key];
      cols.push(f.col);
      params.push(f.kind === 'denoms' ? (v === null ? null : JSON.stringify(v)) : v);
    }
    return { cols, params };
  }

  /**
   * Applies the file in one transaction: it all happens or none of it does. Upsert only, nothing is deleted. Each new login gets a
   * temporary password, returned here once and kept nowhere (only its hash is stored).
   */
  async apply(user: any, raw: any) {
    const b = await this.owner(user);
    const parsed = this.check(raw);
    const created: Array<{ email: string; fullName: string; role: string; password: string }> = [];
    const touched: number[] = [];

    const plan = await this.manager.transaction(async (tx) => {
      const plan = await this.plan(tx, b, parsed.profile);
      if (plan.blockers.length) throw new ConflictException({ message: 'Nothing was changed. ' + plan.blockers.join(' '), errors: plan.blockers });

      if (plan.business) {
        const s = this.sets(BUSINESS_FIELDS, plan.business.values, 2);
        await tx.query(`update business set ${s.cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1`, [b.id, ...s.params]);
      }

      const storeIds = new Map<string, number>((await this.readStores(tx, b.id)).map((s) => [s.name.toLowerCase(), s.id]));
      for (const sp of plan.stores) {
        if (sp.action === 'create') {
          const s = this.sets(STORE_FIELDS, sp.values, 3);
          const [row] = await tx.query(
            `insert into stores (location, business_id, ${s.cols.join(', ')}) values ($1, $2, ${s.cols.map((_, i) => `$${i + 3}`).join(', ')}) returning id`,
            [sp.name, b.id, ...s.params]);
          storeIds.set(sp.name.toLowerCase(), row.id);
          sp.id = row.id;
        } else if (sp.action === 'update') {
          const s = this.sets(STORE_FIELDS, sp.values, 2);
          if (s.cols.length) await tx.query(`update stores set ${s.cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1`, [sp.id, ...s.params]);
        }
      }

      for (const p of plan.staff) {
        if (p.action === 'skip' || p.action === 'same') continue;
        let id = p.id;
        if (p.action === 'create') {
          const password = tempPassword();
          const [row] = await tx.query(
            `insert into app_user (role_id, business_id, email, password, phone, location, full_name, active, archive, created_by, updated_by)
             values ($1, $2, $3, $4, $5, $6, $7, true, false, $8, $8) returning id`,
            [p.roleId, b.id, p.email, this.helper.encodePassword(password), p.values.phone, p.values.location, p.values.fullName, user.id]);
          id = row.id;
          created.push({ email: p.email, fullName: p.values.fullName, role: p.roleName!, password });
        } else {
          const sets: string[] = ['updated_by = $2', 'updated_on = now()'];
          const params: any[] = [id, user.id];
          const col: Record<string, string> = { fullName: 'full_name', phone: 'phone', location: 'location' };
          for (const [k, c] of Object.entries(col)) if (k in p.values) { params.push(p.values[k]); sets.push(`${c} = $${params.length}`); }
          if ('role' in p.values) { params.push(p.roleId); sets.push(`role_id = $${params.length}`); }
          await tx.query(`update app_user set ${sets.join(', ')} where id = $1`, params);
          touched.push(id!);
        }
        if (p.storesChanged) {
          await tx.query(`delete from user_stores where user_id = $1 and store_id in (select id from stores where business_id = $2)`, [id, b.id]);
          let first = true;
          for (const name of p.stores ?? []) {
            await tx.query(`insert into user_stores (user_id, store_id, is_primary, created_by, updated_by) values ($1, $2, $3, $4, $4)`, [id, storeIds.get(name.toLowerCase()), first, user.id]);
            first = false;
          }
          if (p.action === 'update') touched.push(id!);
        }
      }

      // shifts come last: a default opener must already be a login of the store
      for (const sp of plan.stores) {
        const storeId = sp.id ?? storeIds.get(sp.name.toLowerCase())!;
        for (const sh of sp.shifts) {
          if (sh.action === 'same') continue;
          let opener: number | null | undefined;
          if (sh.opener) {
            const [u] = await tx.query(`select id from app_user where lower(email) = lower($1)`, [sh.opener]);
            opener = u?.id ?? null;
          } else if (sh.opener === null) opener = null;
          if (sh.action === 'create') {
            await tx.query(
              `insert into store_shift_templates (store_id, name, start_time, end_time, active, assigned_user_id, created_by, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $7)`,
              [storeId, sh.name, sh.values.startTime, sh.values.endTime, sh.values.active !== false, opener ?? null, user.id]);
          } else {
            const sets: string[] = ['updated_by = $2', 'updated_on = now()'];
            const params: any[] = [sh.id, user.id];
            const col: Record<string, string> = { startTime: 'start_time', endTime: 'end_time', active: 'active' };
            for (const [k, c] of Object.entries(col)) if (k in sh.values) { params.push(sh.values[k]); sets.push(`${c} = $${params.length}`); }
            if (opener !== undefined) { params.push(opener); sets.push(`assigned_user_id = $${params.length}`); }
            await tx.query(`update store_shift_templates set ${sets.join(', ')} where id = $1`, params);
          }
        }
      }
      return plan;
    });

    touched.forEach(forgetUser);
    await this.audit.record({
      userId: user.id, action: 'business.config_imported', entityType: 'businesses', entityId: b.id,
      summary: `business setup imported: ${plan.counts.storesCreated} stores added, ${plan.counts.storesUpdated} changed; ${plan.counts.staffCreated} logins added, ${plan.counts.staffUpdated} changed, ${plan.counts.staffSkipped} skipped; ${plan.counts.shiftsChanged} shifts`,
      // the temporary passwords are never written down: only who got one
      details: { counts: plan.counts, createdLogins: created.map((c) => c.email), business: plan.business?.changes ?? [] },
    } as any);
    return { plan, warnings: [...parsed.warnings, ...plan.warnings], created };
  }
}
