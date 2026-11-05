import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import * as crypto from 'crypto';
import { AuditService } from 'src/core/audit/audit.service';
import { businessOfUser, BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { isManagerRole, isOwnerRole, ROLE } from 'src/core/roles';
import { DeviceTrustMode, isTrustMode, maySkipMfa, parseTrustMode } from './device-trust';

const SETTING_KEY = 'trusted_device_mfa';
const SEEN_EVERY_MS = 10 * 60_000;

export interface RegisteredDevice { id: number; storeid: number; name: string; counteruserid: number | null }

/**
 * Registered store PCs. A manager registers the PC they are signed in on: the browser keeps a random secret (only its hash is stored here).
 * A registered PC can skip the authenticator step for the roles the business allows, and signs a linked Counter login in on its own.
 * Revoking a PC stops its sessions at the next request (the auth guard checks the PC a token came from).
 */
@Injectable()
export class DeviceService {

  constructor(private readonly audit: AuditService, @InjectEntityManager() private readonly manager: EntityManager) {}

  private hash(token: string): string {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
  }

  async mode(): Promise<DeviceTrustMode> {
    const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive limit 1`, [SETTING_KEY]);
    return parseTrustMode(r?.setting_value);
  }

  private async roleOf(userId: number): Promise<string | null> {
    const [r] = await this.manager.query(`select r.name from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [userId]);
    return r?.name ?? null;
  }

  /** the registered, still-active PC behind a browser's secret, or null; its last-seen time is refreshed now and then */
  async resolve(token: string | undefined, ip?: string): Promise<RegisteredDevice | null> {
    if (!token || token.length < 20 || token.length > 200) return null;
    const [d] = await this.manager.query(
      `select id, store_id, name, counter_user_id, last_seen from store_device where token_hash = $1 and active`, [this.hash(token)]);
    if (!d) return null;
    if (!d.last_seen || Date.now() - new Date(d.last_seen).getTime() > SEEN_EVERY_MS) {
      await this.manager.query(`update store_device set last_seen = now(), last_ip = $2 where id = $1`, [d.id, ip ?? null]);
    }
    return { id: d.id, storeid: d.store_id, name: d.name, counteruserid: d.counter_user_id };
  }

  /** a token that came from a PC is good only while that PC is still registered */
  async stillRegistered(id: number): Promise<boolean> {
    const [d] = await this.manager.query(`select 1 as ok from store_device where id = $1 and active`, [id]);
    return !!d;
  }

  /** what the sign-in page asks: is this a registered PC, and does it sign a Counter login in by itself */
  async status(token: string | undefined, ip?: string) {
    const d = await this.resolve(token, ip);
    if (!d) return { registered: false, autosignin: false };
    const mode = await this.mode();
    return { registered: true, name: d.name, storeid: d.storeid, autosignin: mode !== 'off' && !!d.counteruserid };
  }

  /** may the password sign-in of this person skip the authenticator step on this PC? */
  async skipsMfa(token: string | undefined, roleName: string | null | undefined, ip?: string): Promise<RegisteredDevice | null> {
    if (!token) return null;
    if (!maySkipMfa(await this.mode(), roleName)) return null;
    return this.resolve(token, ip);
  }

  /** the Counter login linked to this PC, for the automatic sign-in */
  async counterLogin(token: string | undefined, ip?: string) {
    const d = await this.resolve(token, ip);
    if (!d || !d.counteruserid || (await this.mode()) === 'off') throw new UnauthorizedException();
    return { device: d, userId: d.counteruserid };
  }

  // ---------------------------------------------------------------- managing the PCs

  private async caller(userId: number) {
    const role = await this.roleOf(userId);
    if (!isManagerRole(role)) throw new ForbiddenException('Only a Business Head, Owner-operator or Store Head manages store PCs.');
    return { role: role as string, business: await businessOfUser(this.manager, userId) };
  }

  /** the stores this manager may register PCs at: all of the business for an owner, their own stores for a Store Head */
  private async storesOf(userId: number, role: string, business: number | null) {
    if (isOwnerRole(role)) {
      return this.manager.query(`select id, location as name from stores where business_id = $1 and active and not archive order by id`, [business]);
    }
    return this.manager.query(
      `select s.id, s.location as name from stores s join user_stores us on us.store_id = s.id and us.user_id = $1 and us.active and not us.archive
        where s.active and not s.archive order by s.id`, [userId]);
  }

  /** the Counter logins of the business, the ones a PC may sign in by itself */
  private counterUsersOf(business: number | null) {
    if (!business) return Promise.resolve([]);
    return this.manager.query(
      `select u.id, u.email, u.full_name as name from app_user u join app_role r on r.id = u.role_id
        where r.name = $2 and u.active and not u.archive and ${BUSINESS_OF_USER_SQL} = $1
        order by u.email`, [business, ROLE.COUNTER]);
  }

  async list(userId: number) {
    const c = await this.caller(userId);
    const stores = await this.storesOf(userId, c.role, c.business);
    const ids = stores.map((s: any) => s.id);
    const devices = ids.length ? await this.manager.query(
      `select d.id, d.store_id as storeid, s.location as storename, d.name, d.active, d.registered_on as registeredon, d.last_seen as lastseen,
              d.counter_user_id as counteruserid, u.email as counteremail
         from store_device d join stores s on s.id = d.store_id left join app_user u on u.id = d.counter_user_id
        where d.store_id = any($1::int[]) and (d.active or d.revoked_on > now() - interval '30 days') order by d.active desc, d.id desc`, [ids]) : [];
    return { mode: await this.mode(), canSetMode: isOwnerRole(c.role), stores, devices, counterUsers: await this.counterUsersOf(c.business) };
  }

  async setMode(userId: number, mode: any) {
    const c = await this.caller(userId);
    if (!isOwnerRole(c.role)) throw new ForbiddenException('Only a Business Head or Owner-operator changes this.');
    if (!isTrustMode(mode)) throw new BadRequestException('Choose off, counter or all.');
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, created_by, updated_by) values ('auth', $1, $2, $3, $3)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_by = $3, updated_on = now()`,
      [SETTING_KEY, mode, userId]);
    await this.audit.record({ userId, action: 'auth.device_mode', summary: `store PC sign-in set to ${mode}`, details: { mode } });
    return { mode };
  }

  private async checkCounterUser(c: { business: number | null }, id: any): Promise<number | null> {
    if (!id) return null;
    const n = Number(id);
    if (!(await this.counterUsersOf(c.business)).some((u: any) => Number(u.id) === n)) throw new BadRequestException('That is not a Counter login of your business.');
    return n;
  }

  /** the manager registers the PC in front of them; the secret goes to that browser once and is not stored here */
  async register(userId: number, body: { name?: string; storeid?: number; counteruserid?: number | null }, ip?: string) {
    const c = await this.caller(userId);
    const name = String(body?.name ?? '').trim();
    if (name.length < 2 || name.length > 120) throw new BadRequestException('Give the PC a name, such as "Billing counter 1".');
    const storeid = Number(body?.storeid);
    const stores = await this.storesOf(userId, c.role, c.business);
    if (!stores.some((s: any) => Number(s.id) === storeid)) throw new ForbiddenException('That store is not one of yours.');
    const counterUserId = await this.checkCounterUser(c, body?.counteruserid);

    const token = crypto.randomBytes(32).toString('base64url');
    const [row] = await this.manager.query(
      `insert into store_device (store_id, name, token_hash, counter_user_id, registered_by, last_seen, last_ip) values ($1,$2,$3,$4,$5, now(), $6) returning id`,
      [storeid, name, this.hash(token), counterUserId, userId, ip ?? null]);
    await this.audit.record({ userId, action: 'auth.device_registered', entityType: 'store_device', entityId: row.id, summary: `registered store PC "${name}"`,
      details: { storeid, counteruserid: counterUserId }, ip });
    return { id: row.id, token, name, storeid };
  }

  /** change which Counter login a PC signs in by itself (null = none) */
  async linkCounter(userId: number, id: number, counteruserid: any) {
    const d = await this.ownDevice(userId, id);
    const c = await this.caller(userId);
    const target = await this.checkCounterUser(c, counteruserid);
    await this.manager.query(`update store_device set counter_user_id = $2 where id = $1 and active`, [d.id, target]);
    await this.audit.record({ userId, action: 'auth.device_linked', entityType: 'store_device', entityId: d.id,
      summary: target ? `Counter login linked to store PC "${d.name}"` : `Counter login unlinked from store PC "${d.name}"`, details: { counteruserid: target } });
    return { id: d.id, counteruserid: target };
  }

  async revoke(userId: number, id: number) {
    const d = await this.ownDevice(userId, id);
    await this.manager.query(`update store_device set active = false, revoked_by = $2, revoked_on = now() where id = $1`, [d.id, userId]);
    await this.audit.record({ userId, action: 'auth.device_revoked', entityType: 'store_device', entityId: d.id, summary: `revoked store PC "${d.name}"` });
    return { id: d.id };
  }

  /** a PC the manager may manage: one at a store in their list */
  private async ownDevice(userId: number, id: number) {
    const c = await this.caller(userId);
    const stores = await this.storesOf(userId, c.role, c.business);
    const [d] = await this.manager.query(`select id, name, store_id from store_device where id = $1`, [Number(id)]);
    if (!d || !stores.some((s: any) => Number(s.id) === Number(d.store_id))) throw new NotFoundException('Store PC not found.');
    return d;
  }
}
