import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { dueRows, isoToday, money, openDues, overdueOf } from '../sales/customer-due-rule';
import { DIGITAL_PROVIDER } from '../sales/digital-payment';
import { loadStoreProfile } from '../store/store-profile';

/**
 * What a customer owes for bills left to pay later: the balance, the limit, what is overdue, and the history. Money collected later goes into
 * the shift that is open (cash into the drawer, digital with the day's digital totals); the Store Head or Business Head sets the limit; the
 * Business Head corrects the balance with a reason.
 */
@Injectable()
export class CustomerDueService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async roleName(user: any): Promise<string | undefined> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    return r?.name;
  }

  async get(customerId: number) {
    const [c] = await this.manager.query(`select c.id, c.name, c.mobile, c.locality, coalesce(h.credit_limit, 0)::float8 as credit_limit from customer c left join household h on h.id = c.household_id where c.id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    const rows = await dueRows(this.manager, customerId);
    const open = openDues(rows);
    const balance = money(rows.reduce((s, r) => s + Number(r.amount), 0));
    const limit = money(Number(c.credit_limit || 0));
    const entries = await this.manager.query(
      `select e.id, to_char(e.entry_date, 'YYYY-MM-DD') as entry_date, e.kind, e.amount::float8 as amount, e.note, e.sale_id, e.pay_mode, e.provider,
              to_char(e.due_date, 'YYYY-MM-DD') as due_date, s.location as store, u.full_name as by_name
         from customer_due_entry e left join stores s on s.id = e.store_id left join app_user u on u.id = e.created_by
        where (e.household_id = (select household_id from customer where id = $1) or e.customer_id = $1) order by e.created_on desc, e.id desc limit 100`, [customerId]);
    return { customer: { id: c.id, name: c.name, mobile: c.mobile, locality: c.locality }, limit, balance, available: Math.max(0, money(limit - balance)),
             overdue: overdueOf(open, isoToday()), open, entries };
  }

  /** the figures the till needs when this customer is chosen */
  async brief(customerId: number) {
    const d = await this.get(customerId);
    return { limit: d.limit, balance: d.balance, available: d.available, overdue: d.overdue.amount, since: d.overdue.since };
  }

  async setLimit(customerId: number, body: { limit: any }, user: any) {
    if (!isManagerRole(await this.roleName(user))) throw new ForbiddenException('Only a Store Head or Business Head sets a credit limit.');
    const limit = money(Number(body?.limit));
    if (!Number.isFinite(limit) || limit < 0 || limit > 10000000) throw new BadRequestException('Enter the limit in rupees (0 for no credit).');
    const [c] = await this.manager.query(`select c.id, c.name, c.mobile, coalesce(h.credit_limit, 0)::float8 as before, c.household_id from customer c left join household h on h.id = c.household_id where c.id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    if (limit > 0 && (c.mobile === '0000000000' || !String(c.name || '').trim())) throw new BadRequestException('Credit needs a named customer: the walk-in placeholder cannot owe.');
    // the limit is the household's
    if (c.household_id) await this.manager.query(`update household set credit_limit = $2 where id = $1`, [c.household_id, limit]);
    await this.manager.query(`update customer set updated_by = $2, updated_on = now() where id = $1`, [customerId, user.id]);
    await this.audit.record({ userId: user.id, action: 'customer.credit_limit_set', entityType: 'customer', entityId: customerId,
      summary: `${c.name}: credit limit ${c.before} -> ${limit}`, details: { before: c.before, limit } });
    return this.get(customerId);
  }

  /** money collected against what the customer owes */
  async collect(customerId: number, body: { amount: any; mode: string; refno?: string; note?: string; storeid?: any }, user: any) {
    const amount = money(Number(body?.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Enter the amount collected.');
    const mode = String(body?.mode || '').toUpperCase();
    if (!['CASH', 'DIGITAL'].includes(mode)) throw new BadRequestException('Say whether it was collected in cash or digitally.');
    const storeid = Number(body?.storeid) || null;
    if (!storeid) throw new BadRequestException('Say which store is collecting.');
    const note = String(body?.note || '').trim().slice(0, 200) || null;
    return this.manager.transaction(async tm => {
      await tm.query(`select id from customer where id = $1 for update`, [customerId]);
      const [c] = await tm.query(`select id, name from customer where id = $1`, [customerId]);
      if (!c) throw new NotFoundException('Customer not found.');
      const [b] = await tm.query(`select coalesce(sum(amount), 0)::float8 as b from customer_due_entry where (household_id = (select household_id from customer where id = $1) or customer_id = $1)`, [customerId]);
      const owed = money(Number(b.b));
      if (owed <= 0) throw new BadRequestException(`${c.name} owes nothing.`);
      if (amount > owed + 0.005) throw new BadRequestException(`${c.name} owes ${owed.toFixed(2)}; you cannot collect more than that.`);

      // the money belongs to the shift that is open at this store now (the day-end count includes it)
      const profile = await loadStoreProfile(tm, storeid);
      const staffBased = profile?.shiftmode === 'staff';
      const [shift] = staffBased
        ? await tm.query(`select id from store_shifts where store_id = $1 and status = 'OPEN' and assigned_user_id = $2 order by shift_date desc, id desc limit 1`, [storeid, user.id])
        : await tm.query(`select id from store_shifts where store_id = $1 and status = 'OPEN' order by shift_date desc, id desc limit 1`, [storeid]);
      if (!shift) throw new BadRequestException(staffBased ? 'Open your own shift before collecting.' : 'Open a shift before collecting: the money is counted in it.');

      // the same provider the bills use, so the day's digital total is one line to match
      const provider = mode === 'DIGITAL' ? DIGITAL_PROVIDER : null;
      const refno = mode === 'DIGITAL' ? (String(body?.refno || '').trim().slice(0, 40) || null) : null;
      await tm.query(
        `insert into customer_due_entry (customer_id, kind, amount, store_id, shift_id, pay_mode, provider, ref_no, note, created_by)
         values ($1, 'PAYMENT', $2, $3, $4, $5, $6, $7, $8, $9)`, [customerId, -amount, storeid, shift.id, mode, provider, refno, note, user.id]);
      if (mode === 'CASH') {
        await tm.query(
          `insert into store_cash_accounts (trans_date, category, description, deposit, withdraw, store_id, shift_id)
           values (current_date, 'DUE_COLLECTION', $1, $2, 0, $3, $4)`, [`Dues collected from ${c.name}`, amount, storeid, shift.id]);
      }
      await this.audit.record({ userId: user.id, action: 'customer.due_collected', entityType: 'customer', entityId: customerId,
        summary: `${c.name}: ${amount.toFixed(2)} collected (${mode.toLowerCase()})`, details: { amount, mode, provider, shift: shift.id } });
      return { ok: true };
    }).then(() => this.get(customerId));
  }

  /** a correction up or down with a reason (a bill written off, a mistake); the Business Head only */
  async adjust(customerId: number, body: { amount: any; note: string }, user: any) {
    if (!isOwnerRole(await this.roleName(user))) throw new ForbiddenException('Only the Business Head corrects what a customer owes.');
    const amount = money(Number(body?.amount));
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('Enter the amount to add (positive) or take off (negative).');
    const note = String(body?.note || '').trim();
    if (note.length < 5) throw new BadRequestException('Say why: at least 5 characters.');
    const [c] = await this.manager.query(`select id, name from customer where id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    await this.manager.query(`insert into customer_due_entry (customer_id, kind, amount, note, created_by) values ($1, 'ADJUSTMENT', $2, $3, $4)`, [customerId, amount, note.slice(0, 200), user.id]);
    await this.audit.record({ userId: user.id, action: 'customer.due_adjusted', entityType: 'customer', entityId: customerId,
      summary: `${c.name}: dues adjusted by ${amount} (${note})`, details: { amount, note } });
    return this.get(customerId);
  }

  /** everyone who owes, the overdue first: for following up */
  async list() {
    const rows = await this.manager.query(
      `select min(c.id) as id, min(c.name) as name, min(c.mobile) as mobile, min(c.locality) as locality, coalesce(max(h.credit_limit), 0)::float8 as credit_limit, sum(e.amount)::float8 as balance
         from customer_due_entry e join customer c on c.id = e.customer_id left join household h on h.id = e.household_id group by coalesce(e.household_id, -c.id) having sum(e.amount) > 0.004 order by c.name`);
    const today = isoToday();
    const out: any[] = [];
    for (const r of rows) {
      const late = overdueOf(openDues(await dueRows(this.manager, r.id)), today);
      out.push({ ...r, balance: money(r.balance), overdue: late.amount, since: late.since });
    }
    return out.sort((a, b) => (b.overdue > 0 ? 1 : 0) - (a.overdue > 0 ? 1 : 0) || (a.since ?? '9').localeCompare(b.since ?? '9') || b.balance - a.balance);
  }
}
