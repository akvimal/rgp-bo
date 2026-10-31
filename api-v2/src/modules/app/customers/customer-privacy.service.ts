import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { NIL_MOBILE } from './customer-rules';
import { isMasked, maskContact } from './customer-privacy';

const DEFAULT_LIMIT = 30;

/**
 * Who may read customers' contact details in full, and the limited way for everyone else: reveal one customer at a time, a few a day, every
 * reveal kept. The managers (Business Head, Owner-operator, Store Head) and any role granted customers "reveal" see everything.
 */
@Injectable()
export class CustomerPrivacyService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  /** true for the managers and for a role whose permissions include customers "reveal" */
  async canRevealAll(user: any): Promise<boolean> {
    if (!user?.roleid) return false;
    const [r] = await this.manager.query(
      `select name, (permissions is not null and jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "customers").policies[*] ? (@.action == "reveal")')) as granted
         from app_role where id = $1`, [user.roleid]);
    return !!r && (isManagerRole(r.name) || r.granted === true);
  }

  /** downloading customer lists: the Business Head and Owner-operator, or a role granted customers "export" */
  async canExport(user: any): Promise<boolean> {
    if (!user?.roleid) return false;
    const [r] = await this.manager.query(
      `select name, (permissions is not null and jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "customers").policies[*] ? (@.action == "export")')) as granted
         from app_role where id = $1`, [user.roleid]);
    return !!r && (isOwnerRole(r.name) || r.granted === true);
  }

  async userName(user: any): Promise<string> {
    const [u] = await this.manager.query(`select full_name from app_user where id = $1`, [user?.id || 0]);
    return String(u?.full_name || 'Unknown user').trim();
  }

  /** how many lookups and opens one login that cannot read everything may make in an hour */
  async lookupLimit(): Promise<number> {
    const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = 'customer_lookup_limit_hour' and active and not archive limit 1`);
    const n = Math.round(Number(r?.setting_value));
    return Number.isFinite(n) && n >= 10 && n <= 100000 ? n : 600;
  }

  /**
   * Notes that a login looked a customer up or opened one, for the "heavy searching" alert, and stops a login that may not read everything
   * once it has made more than the hourly limit: a script walking through numbers would hit it within minutes, a busy counter never does.
   */
  async recordAccess(user: any, kind: 'lookup' | 'view'): Promise<void> {
    if (!user?.id) return;
    const all = await this.canRevealAll(user);
    if (!all) {
      const [n] = await this.manager.query(`select count(*)::int as n from customer_access where user_id = $1 and created_on >= now() - interval '1 hour'`, [user.id]);
      if (n.n >= (await this.lookupLimit())) {
        throw new HttpException('Too many customer lookups in the last hour. Wait a while, or ask a manager.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    await this.manager.query(`insert into customer_access (user_id, kind) values ($1, $2)`, [user.id, kind]);
  }

  /** a print attempt on a customer screen, reported by the screen; kept so repeated attempts show up */
  async logEvent(user: any, kind: string, page: string, blocked: boolean) {
    if (kind !== 'print_attempt') return { ok: false };
    await this.audit.record({
      userId: user.id, action: 'customer.print_attempt', entityType: 'customers',
      summary: `${blocked ? 'Tried to print' : 'Printed'} a customer screen (${String(page || 'unknown').slice(0, 30)})`, details: { page: String(page || '').slice(0, 30), blocked },
    });
    return { ok: true };
  }

  /** a customer list was downloaded: who, which audience, how many */
  async logExport(user: any, summary: string, details: Record<string, any>) {
    await this.audit.record({ userId: user.id, action: 'customer.exported', entityType: 'customers', summary, details });
  }

  async limit(): Promise<number> {
    const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = 'customer_reveal_limit' and active and not archive limit 1`);
    const n = Math.round(Number(r?.setting_value));
    return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : DEFAULT_LIMIT;
  }

  /** different customers this login revealed today */
  async revealedToday(userId: number): Promise<number> {
    const [r] = await this.manager.query(
      `select count(distinct customer_id)::int as n from customer_reveal where user_id = $1 and created_on >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`, [userId]);
    return r?.n ?? 0;
  }

  /** what the screens need to know about the caller */
  async status(user: any) {
    const all = await this.canRevealAll(user);
    const limit = await this.limit();
    const used = all ? 0 : await this.revealedToday(user.id);
    return {
      canRevealAll: all, canExport: await this.canExport(user), userName: await this.userName(user),
      limit: all ? null : limit, revealedToday: used, left: all ? null : Math.max(0, limit - used),
    };
  }

  /** the customer's full contact details, to the caller who may have them; kept in the reveal log and the audit trail */
  async reveal(customerId: number, user: any, via = 'screen') {
    const [c] = await this.manager.query(`select id, name, mobile, alt_mobile as altmobile, email, address from customer where id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    if (c.mobile === NIL_MOBILE) return { id: c.id, mobile: c.mobile, altmobile: null, email: null, address: null };
    const all = await this.canRevealAll(user);
    if (!all) {
      const limit = await this.limit();
      const [already] = await this.manager.query(
        `select exists(select 1 from customer_reveal where user_id = $1 and customer_id = $2 and created_on >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as seen`, [user.id, customerId]);
      if (!already.seen && (await this.revealedToday(user.id)) >= limit) {
        throw new ForbiddenException(`You have shown ${limit} customers' details today, which is the daily limit. Ask a manager if you need more.`);
      }
    }
    await this.manager.query(`insert into customer_reveal (customer_id, user_id, via) values ($1, $2, $3)`, [customerId, user.id, via]);
    await this.audit.record({ userId: user.id, action: 'customer.revealed', entityType: 'customers', entityId: customerId, summary: `${String(c.name || '').trim() || 'Customer'}: contact details shown (${via})` });
    return { id: c.id, mobile: c.mobile, altmobile: c.altmobile, email: c.email, address: c.address };
  }

  /** the customer with contact details masked unless the caller may read them all (the caller reveals one at a time) */
  async protect<T extends { id: number; mobile?: any; altmobile?: any; email?: any; address?: any }>(row: T, user: any): Promise<T> {
    if (!user || row.mobile === NIL_MOBILE || (await this.canRevealAll(user))) return row;
    return maskContact(row);
  }

  /** a saved customer for a caller who may not read everything: fields they typed (not masked) are returned as typed, the rest masked */
  async protectUnsupplied<T extends { id: number; mobile?: any; altmobile?: any; email?: any; address?: any }>(saved: T, supplied: Record<string, any>, user: any): Promise<T> {
    if (!user || saved.mobile === NIL_MOBILE || (await this.canRevealAll(user))) return saved;
    const masked: any = maskContact(saved);
    const out: any = { ...masked };
    for (const f of ['mobile', 'altmobile', 'email', 'address']) {
      const typed = supplied?.[f];
      if (typeof typed === 'string' && typed !== '' && !isMasked(typed)) out[f] = (saved as any)[f];
    }
    return out;
  }

  async protectAll<T extends { id: number; mobile?: any; altmobile?: any; email?: any; address?: any }>(rows: T[], user: any): Promise<T[]> {
    if (!user || (await this.canRevealAll(user))) return rows;
    return rows.map((r) => (r.mobile === NIL_MOBILE ? r : maskContact(r)));
  }

  /** a list of customers with whole numbers was produced: kept so a bulk read is on record */
  async logBulk(user: any, via: string, summary: string, details: Record<string, any>) {
    await this.audit.record({ userId: user.id, action: 'customer.bulk_listed', entityType: 'customers', summary, details: { via, ...details } });
  }

  /** how many different customers each login revealed lately: a bulk copier stands out */
  async revealReport(days = 7) {
    return this.manager.query(
      `select u.id as user_id, u.full_name, count(distinct r.customer_id)::int as customers, count(*)::int as reveals, max(r.created_on) as last_reveal
         from customer_reveal r join app_user u on u.id = r.user_id
        where r.created_on >= now() - ($1::int * interval '1 day') group by u.id, u.full_name order by customers desc limit 50`, [Math.min(Math.max(days, 1), 90)]);
  }
}
