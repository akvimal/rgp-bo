import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

import { isOwnerRole, isManagerRole } from 'src/core/roles';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[0-9+\-\s]{7,20}$/;
const KINDS = ['PRODUCT', 'PRICE', 'MEDICAL', 'ORDER', 'OTHER'];
const OUTCOMES = ['SOLD', 'ORDERED', 'NOT_AVAILABLE', 'REFERRED', 'ANSWERED', 'NO_RESPONSE', 'DROPPED'];
const NEEDS_NOTE = ['NO_RESPONSE', 'DROPPED'];
const text = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const iso = (d: any) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

type Ctx = { id: number; role: string; stores: number[]; manage: boolean };

/**
 * Customer inquiries: recorded at the counter, assigned with a due date, closed with an outcome.
 * Business Head sees all; Store Head the inquiries of their stores; counter staff the ones they raised or were given.
 */
@Injectable()
export class InquiryService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async ctx(user: any): Promise<Ctx> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    const role = r?.name || '';
    return { id: user.id, role, stores: s.map((x: any) => x.store_id), manage: isManagerRole(role) };
  }

  /** SQL that limits rows (alias q) to what the caller may see */
  private visible(c: Ctx, args: any[]): string {
    if (isOwnerRole(c.role)) return 'true';
    args.push(c.id);
    const me = `$${args.length}`;
    if (c.role === 'Store Head') {
      args.push(c.stores.length ? c.stores : [0]);
      return `(q.store_id = any($${args.length}::int[]) or q.assigned_to = ${me} or q.raised_by = ${me})`;
    }
    return `(q.assigned_to = ${me} or q.raised_by = ${me})`;
  }

  private canSee(c: Ctx, q: { store_id: number; assigned_to: number; raised_by: number }) {
    if (isOwnerRole(c.role)) return true;
    if (q.assigned_to === c.id || q.raised_by === c.id) return true;
    return c.role === 'Store Head' && c.stores.includes(q.store_id);
  }

  private async load(id: number) {
    const [q] = await this.manager.query(`select * from customer_inquiry where id = $1`, [id]);
    if (!q) throw new NotFoundException('Inquiry not found.');
    return q;
  }

  /** stores the caller can record an inquiry against, and the staff who can be given it */
  async options(user: any) {
    const c = await this.ctx(user);
    const stores = isOwnerRole(c.role)
      ? await this.manager.query(`select id, location as name from stores where active and not archive order by location`)
      : await this.manager.query(`select id, location as name from stores where id = any($1::int[]) and active order by location`, [c.stores.length ? c.stores : [0]]);
    let staff: any[] = [];
    if (c.manage) {
      staff = await this.manager.query(
        `select u.id, u.full_name as name, array(select store_id from user_stores x where x.user_id = u.id and x.active and not x.archive) as stores
           from app_user u where u.active and not u.archive order by u.full_name`);
      if (!isOwnerRole(c.role)) staff = staff.filter((s: any) => s.stores.some((x: number) => c.stores.includes(x)) || s.id === c.id);
    } else {
      staff = [{ id: c.id, name: 'Me', stores: c.stores }];
    }
    return { stores, staff, kinds: KINDS, outcomes: OUTCOMES, role: c.role, canAssign: c.manage, me: c.id };
  }

  async list(q: any, user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const where: string[] = [this.visible(c, args)];
    const status = String(q?.status || 'OPEN').toUpperCase();
    if (status === 'OPEN' || status === 'CLOSED') { args.push(status); where.push(`q.status = $${args.length}`); }
    if (q?.mine === 'true') { args.push(c.id); where.push(`q.assigned_to = $${args.length}`); }
    if (q?.overdue === 'true') where.push(`q.status = 'OPEN' and q.due_on < current_date`);
    if (+q?.store_id) { args.push(+q.store_id); where.push(`q.store_id = $${args.length}`); }
    if (text(q?.q, 60)) {
      args.push(`%${text(q.q, 60)}%`);
      where.push(`(q.customer_name ilike $${args.length} or q.mobile ilike $${args.length} or q.product_text ilike $${args.length} or q.details ilike $${args.length})`);
    }
    return this.manager.query(
      `select q.id, q.store_id, st.location as store, q.customer_id, q.customer_name, q.mobile, q.kind, q.product_text, q.details, q.status, q.outcome, q.closing_note,
              to_char(q.due_on, 'YYYY-MM-DD') as due_on, q.assigned_to, a.full_name as assigned_name, r.full_name as raised_name, q.raised_by, q.raised_on,
              k.full_name as closed_name, q.closed_on, (q.status = 'OPEN' and q.due_on < current_date) as overdue
         from customer_inquiry q join stores st on st.id = q.store_id
         join app_user a on a.id = q.assigned_to join app_user r on r.id = q.raised_by left join app_user k on k.id = q.closed_by
        where ${where.join(' and ')}
        order by (q.status = 'OPEN') desc, q.due_on asc, q.id desc limit 300`, args);
  }

  async summary(user: any) {
    const c = await this.ctx(user);
    const args: any[] = [];
    const vis = this.visible(c, args);
    const [s] = await this.manager.query(
      `select count(*) filter (where q.status = 'OPEN')::int as open,
              count(*) filter (where q.status = 'OPEN' and q.due_on < current_date)::int as overdue,
              count(*) filter (where q.status = 'CLOSED' and q.closed_on >= date_trunc('month', current_date))::int as closed_this_month
         from customer_inquiry q where ${vis}`, args);
    return s;
  }

  private async checkAssignee(c: Ctx, assignee: number, storeId: number) {
    const [u] = await this.manager.query(`select id, full_name from app_user where id = $1 and active and not archive`, [assignee]);
    if (!u) throw new BadRequestException('Choose who the inquiry is for.');
    if (assignee !== c.id && !c.manage) throw new ForbiddenException('You can assign an inquiry to yourself only.');
    const [r] = await this.manager.query(`select r.name from app_user x join app_role r on r.id = x.role_id where x.id = $1`, [assignee]);
    if (!isOwnerRole(r?.name)) {
      const [m] = await this.manager.query(`select 1 from user_stores where user_id = $1 and store_id = $2 and active and not archive`, [assignee, storeId]);
      if (!m) throw new BadRequestException(`${u.full_name} is not mapped to that store.`);
    }
    return u;
  }

  private fields(b: any) {
    const out: any = {};
    if (b.kind !== undefined) {
      if (!KINDS.includes(b.kind)) throw new BadRequestException('Choose the kind of inquiry.');
      out.kind = b.kind;
    }
    if (b.details !== undefined) {
      const d = text(b.details, 500);
      if (!d) throw new BadRequestException('Say what the customer asked for.');
      out.details = d;
    }
    if (b.product_text !== undefined) out.product_text = text(b.product_text, 120);
    if (b.customer_name !== undefined) out.customer_name = text(b.customer_name, 80);
    if (b.mobile !== undefined) {
      const m = text(b.mobile, 40);
      if (m && !PHONE.test(m)) throw new BadRequestException('The mobile number is not valid.');
      out.mobile = m;
    }
    if (b.due_on !== undefined) {
      if (!DATE.test(b.due_on || '')) throw new BadRequestException('The due date is not a valid date.');
      out.due_on = b.due_on;
    }
    return out;
  }

  async create(b: any, user: any) {
    const c = await this.ctx(user);
    const storeId = Number(b?.store_id);
    if (!storeId) throw new BadRequestException('Choose the store.');
    const [st] = await this.manager.query(`select id from stores where id = $1 and active and not archive`, [storeId]);
    if (!st) throw new BadRequestException('That store was not found.');
    if (!isOwnerRole(c.role) && !c.stores.includes(storeId)) throw new ForbiddenException('You can record inquiries for your own stores only.');
    const f = this.fields({ kind: 'PRODUCT', ...b });
    if (!f.details) throw new BadRequestException('Say what the customer asked for.');
    if (!f.due_on) { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); f.due_on = d.toISOString().slice(0, 10); }
    if (f.due_on < new Date().toISOString().slice(0, 10)) throw new BadRequestException('The due date cannot be in the past.');
    let customerId: number | null = null;
    if (b.customer_id) {
      const [cu] = await this.manager.query(`select id, name, mobile from customer where id = $1`, [Number(b.customer_id)]);
      if (!cu) throw new BadRequestException('That customer was not found.');
      customerId = cu.id;
      f.customer_name = f.customer_name ?? cu.name;
      f.mobile = f.mobile ?? cu.mobile;
    }
    const assignee = b.assigned_to ? Number(b.assigned_to) : c.id;
    const who = await this.checkAssignee(c, assignee, storeId);
    const [row] = await this.manager.query(
      `insert into customer_inquiry (store_id, customer_id, customer_name, mobile, kind, product_text, details, due_on, assigned_to, raised_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [storeId, customerId, f.customer_name ?? null, f.mobile ?? null, f.kind, f.product_text ?? null, f.details, f.due_on, assignee, c.id]);
    await this.audit.record({ userId: c.id, action: 'inquiry.raised', entityType: 'customer_inquiry', entityId: row.id,
      summary: `Inquiry raised (${f.kind.toLowerCase()}): ${f.product_text || f.details.slice(0, 40)}, for ${who.full_name}`, details: { storeId } });
    return { id: row.id };
  }

  async update(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot change this inquiry.');
    if (q.status !== 'OPEN') throw new BadRequestException('A closed inquiry cannot be edited; reopen it first.');
    if (!c.manage && q.raised_by !== c.id && q.assigned_to !== c.id) throw new ForbiddenException('You cannot change this inquiry.');
    const f = this.fields(b);
    if (f.due_on && f.due_on < iso(q.due_on) && f.due_on < new Date().toISOString().slice(0, 10)) throw new BadRequestException('The due date cannot be in the past.');
    const keys = Object.keys(f);
    if (!keys.length) return { id };
    await this.manager.query(`update customer_inquiry set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [id, ...keys.map(k => f[k])]);
    await this.audit.record({ userId: c.id, action: 'inquiry.updated', entityType: 'customer_inquiry', entityId: id, summary: `Inquiry changed (${keys.join(', ')})`, details: {} });
    return { id };
  }

  async assign(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only a manager can reassign an inquiry.');
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot change this inquiry.');
    if (q.status !== 'OPEN') throw new BadRequestException('Reopen the inquiry before reassigning it.');
    const who = await this.checkAssignee(c, Number(b?.assigned_to), q.store_id);
    await this.manager.query(`update customer_inquiry set assigned_to = $2 where id = $1`, [id, who.id]);
    await this.audit.record({ userId: c.id, action: 'inquiry.assigned', entityType: 'customer_inquiry', entityId: id, summary: `Inquiry assigned to ${who.full_name}`, details: {} });
    return { id };
  }

  async close(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot close this inquiry.');
    if (q.status !== 'OPEN') throw new BadRequestException('This inquiry is already closed.');
    if (!c.manage && q.assigned_to !== c.id && q.raised_by !== c.id) throw new ForbiddenException('You can close inquiries given to you or raised by you.');
    if (!OUTCOMES.includes(b?.outcome)) throw new BadRequestException('Choose how the inquiry ended.');
    const note = text(b.closing_note, 300);
    if (NEEDS_NOTE.includes(b.outcome) && !note) throw new BadRequestException('Say what happened before closing it this way.');
    await this.manager.query(
      `update customer_inquiry set status = 'CLOSED', outcome = $2, closing_note = $3, closed_by = $4, closed_on = now() where id = $1`, [id, b.outcome, note, c.id]);
    await this.audit.record({ userId: c.id, action: 'inquiry.closed', entityType: 'customer_inquiry', entityId: id, summary: `Inquiry closed: ${b.outcome.toLowerCase().replace('_', ' ')}`, details: { note } });
    return { id };
  }

  async reopen(id: number, user: any) {
    const c = await this.ctx(user);
    if (!c.manage) throw new ForbiddenException('Only a manager can reopen an inquiry.');
    const q = await this.load(id);
    if (!this.canSee(c, q)) throw new ForbiddenException('You cannot change this inquiry.');
    if (q.status !== 'CLOSED') throw new BadRequestException('This inquiry is not closed.');
    await this.manager.query(`update customer_inquiry set status = 'OPEN', outcome = null, closing_note = null, closed_by = null, closed_on = null where id = $1`, [id]);
    await this.audit.record({ userId: c.id, action: 'inquiry.reopened', entityType: 'customer_inquiry', entityId: id, summary: 'Inquiry reopened', details: {} });
    return { id };
  }
}
