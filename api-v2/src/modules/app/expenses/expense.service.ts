import { BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

import { isOwnerRole } from 'src/core/roles';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const MODES = ['CASH', 'BANK', 'UPI', 'CARD', 'CHEQUE'];
const r2 = (n: number) => Math.round(n * 100) / 100;
const text = (v: any, max: number) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const iso = (d: any) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

type Ctx = { id: number; role: string; stores: number[]; limit: number; self: (storeId: number | null) => boolean };

/**
 * The expense ledger. Business Head: raises anything, approved on the spot, approves everything. Store Head: raises for
 * their stores, approved on the spot up to the store limit, approves counter staff's expenses up to the limit. Counter staff
 * raise store expenses that wait for the Store Head. Above the limit, and every business-level expense, is the Business Head's.
 */
@Injectable()
export class ExpenseService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async ctx(user: any): Promise<Ctx> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    // where approval_mode is 'self' the maker may approve their own expense (a store's own setting wins over the business's)
    const modes = await this.manager.query(`select s.id, coalesce(s.approval_mode, b.approval_mode) as mode from stores s left join business b on b.id = s.business_id`);
    const [ub] = await this.manager.query(`select b.approval_mode as mode from app_user u join business b on b.id = ${BUSINESS_OF_USER_SQL} where u.id = $1`, [user.id]);
    const byStore = new Map<number, string>(modes.map((m: any) => [m.id, m.mode]));
    const self = (storeId: number | null) => (storeId === null ? ub?.mode : byStore.get(storeId)) === 'self';
    return { id: user.id, role: r?.name || '', stores: s.map((x: any) => x.store_id), limit: await this.limit(), self };
  }

  async limit(): Promise<number> {
    const [r] = await this.manager.query(`select setting_value from app_setting where category = 'expense' and setting_key = 'store_head_limit' and active and not archive limit 1`);
    const n = Number(r?.setting_value);
    return Number.isFinite(n) && n >= 0 ? n : 5000;
  }

  private canDecide(c: Ctx, e: { store_id: number | null; amount: any; raised_by: number; status: string }): boolean {
    if (e.status !== 'PENDING') return false;
    if (isOwnerRole(c.role)) return true;
    return c.role === 'Store Head' && e.store_id !== null && c.stores.includes(e.store_id) && Number(e.amount) <= c.limit && (e.raised_by !== c.id || c.self(e.store_id));
  }

  // ------------------------------------------------------------------ reference data
  categories() {
    return this.manager.query(`select id, name, display_order, active from expense_category order by display_order, name`);
  }

  async saveCategory(id: number | null, b: any, by: any) {
    const name = text(b?.name, 60);
    if (!name) throw new BadRequestException('Give the category a name.');
    const [dup] = await this.manager.query(`select 1 from expense_category where lower(name) = lower($1) and id <> $2`, [name, id || 0]);
    if (dup) throw new BadRequestException(`There is already a category called ${name}.`);
    if (id) {
      const [cur] = await this.manager.query(`select 1 from expense_category where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Category not found.');
      await this.manager.query(`update expense_category set name = $2, display_order = $3, active = $4 where id = $1`, [id, name, Number(b.display_order) || 10, b.active !== false]);
    } else {
      const [r] = await this.manager.query(`insert into expense_category (name, display_order) values ($1, $2) returning id`, [name, Number(b.display_order) || 50]);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'expense.category_saved', entityType: 'expense_category', entityId: id, summary: `Expense category ${name} saved`, details: {} });
    return { id };
  }

  async setLimit(value: any, by: any) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 10000000) throw new BadRequestException('The limit must be between 0 and 1,00,00,000.');
    const before = await this.limit();
    const upd = await this.manager.query(`update app_setting set setting_value = $1, updated_on = now(), updated_by = $2 where category = 'expense' and setting_key = 'store_head_limit' returning id`, [String(n), by.id]);
    if (!upd.length) await this.manager.query(`insert into app_setting (category, setting_key, setting_value, description, active, archive) values ('expense','store_head_limit',$1,'Largest store expense a Store Head can approve',true,false)`, [String(n)]);
    await this.audit.record({ userId: by.id, action: 'expense.limit_set', entityType: 'app_setting', entityId: null, summary: `Store Head expense limit ${before} -> ${n}`, details: { from: before, to: n } });
    return { limit: n };
  }

  async policy(user: any) {
    const c = await this.ctx(user);
    const st = isOwnerRole(c.role)
      ? await this.manager.query(`select id, location as name from stores where active order by location`)
      : await this.manager.query(`select id, location as name from stores where id = any($1) order by location`, [c.stores]);
    return { limit: c.limit, role: c.role, stores: st };
  }

  // ------------------------------------------------------------------ the ledger
  private async validate(b: any, c: Ctx) {
    if (!DATE.test(b?.expense_date || '')) throw new BadRequestException('Give the expense date.');
    if (b.expense_date > new Date().toISOString().slice(0, 10)) throw new BadRequestException('An expense cannot be dated in the future.');
    const amount = r2(Number(b?.amount));
    if (!(amount > 0) || amount > 10000000) throw new BadRequestException('Enter the amount paid.');
    const gst = r2(Number(b?.gst_amount || 0));
    if (!(gst >= 0) || gst > amount) throw new BadRequestException('GST cannot be more than the amount.');
    if (!MODES.includes(b?.pay_mode)) throw new BadRequestException('Choose how it was paid: cash, bank, UPI, card or cheque.');
    const [cat] = await this.manager.query(`select id from expense_category where id = $1 and active`, [Number(b?.category_id)]);
    if (!cat) throw new BadRequestException('Choose the category.');
    let store: number | null = b?.store_id ? Number(b.store_id) : null;
    if (isOwnerRole(c.role)) {
      if (store) {
        const [s] = await this.manager.query(`select 1 from stores where id = $1`, [store]);
        if (!s) throw new BadRequestException('That store was not found.');
      }
    } else {
      if (!store && c.stores.length === 1) store = c.stores[0];
      if (!store) throw new BadRequestException('Business-level expenses are raised by the Business Head; choose your store.');
      if (!c.stores.includes(store)) throw new ForbiddenException('You can raise expenses only for your own store.');
    }
    return {
      expense_date: b.expense_date, store_id: store, category_id: cat.id, amount, gst_amount: gst, pay_mode: b.pay_mode,
      payee: text(b.payee, 100), bill_no: text(b.bill_no, 40), description: text(b.description, 300), receipt_path: text(b.receipt_path, 300),
    };
  }

  async raise(b: any, user: any) {
    const c = await this.ctx(user);
    const f = await this.validate(b, c);
    let status = 'PENDING', note: string | null = null;
    if (isOwnerRole(c.role)) { status = 'APPROVED'; note = 'Raised by the Business Head'; }
    else if (c.role === 'Store Head' && f.amount <= c.limit) { status = 'APPROVED'; note = 'Within the store limit'; }
    const [r] = await this.manager.query(
      `insert into expense (expense_date, store_id, category_id, amount, gst_amount, payee, bill_no, pay_mode, description, receipt_path, status, raised_by, decided_by, decided_on, decision_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
      [f.expense_date, f.store_id, f.category_id, f.amount, f.gst_amount, f.payee, f.bill_no, f.pay_mode, f.description, f.receipt_path, status, user.id,
        status === 'APPROVED' ? user.id : null, status === 'APPROVED' ? new Date() : null, note]);
    await this.audit.record({ userId: user.id, action: 'expense.raised', entityType: 'expense', entityId: r.id,
      summary: `Expense ${f.amount} ${f.payee ? 'to ' + f.payee : ''} (${status.toLowerCase()})`, details: { storeId: f.store_id, categoryId: f.category_id } });
    return { id: r.id, status };
  }

  async list(q: any, user: any) {
    const c = await this.ctx(user);
    const where: string[] = [];
    const args: any[] = [];
    const add = (sql: string, v: any) => { args.push(v); where.push(sql.replace('?', `$${args.length}`)); };
    if (isOwnerRole(c.role)) { /* everything */ }
    else if (c.role === 'Store Head') { args.push(c.stores); args.push(c.id); where.push(`(e.store_id = any($${args.length - 1}) or e.raised_by = $${args.length})`); }
    else add('e.raised_by = ?', c.id);
    if (q.period && PERIOD.test(q.period)) add(`to_char(e.expense_date, 'YYYY-MM') = ?`, q.period);
    if (q.status) add('e.status = ?', String(q.status).toUpperCase());
    if (q.store === 'business') where.push('e.store_id is null');
    else if (q.store) add('e.store_id = ?', Number(q.store));
    if (q.category) add('e.category_id = ?', Number(q.category));
    const rows = await this.manager.query(
      `select e.id, to_char(e.expense_date, 'YYYY-MM-DD') as expense_date, e.store_id, s.location as store, e.category_id, k.name as category, e.amount::float as amount, e.gst_amount::float as gst_amount,
              e.payee, e.bill_no, e.pay_mode, e.description, e.receipt_path, e.status, e.raised_by, u.full_name as raised_by_name, d.full_name as decided_by_name, e.decided_on, e.decision_note,
              e.recurring_id
         from expense e join expense_category k on k.id = e.category_id left join stores s on s.id = e.store_id
         left join app_user u on u.id = e.raised_by left join app_user d on d.id = e.decided_by
        ${where.length ? 'where ' + where.join(' and ') : ''} order by (e.status = 'PENDING') desc, e.expense_date desc, e.id desc limit 500`, args);
    const out = rows.map((r: any) => ({ ...r, can_decide: this.canDecide(c, r), can_edit: r.status === 'PENDING' && (isOwnerRole(c.role) || r.raised_by === c.id) }));
    return { rows: out, pending_for_me: out.filter((r: any) => r.can_decide).length, limit: c.limit };
  }

  private async load(id: number) {
    const [e] = await this.manager.query(`select * from expense where id = $1`, [id]);
    if (!e) throw new NotFoundException('Expense not found.');
    return e;
  }

  async update(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const e = await this.load(id);
    if (e.status !== 'PENDING') throw new BadRequestException('Only a pending expense can be changed.');
    if (!isOwnerRole(c.role) && e.raised_by !== c.id) throw new ForbiddenException('You can change only the expenses you raised.');
    const f = await this.validate(b, c);
    await this.manager.query(
      `update expense set expense_date=$2, store_id=$3, category_id=$4, amount=$5, gst_amount=$6, payee=$7, bill_no=$8, pay_mode=$9, description=$10, receipt_path=$11 where id=$1`,
      [id, f.expense_date, f.store_id, f.category_id, f.amount, f.gst_amount, f.payee, f.bill_no, f.pay_mode, f.description, f.receipt_path]);
    await this.audit.record({ userId: user.id, action: 'expense.updated', entityType: 'expense', entityId: id, summary: `Expense ${id} changed to ${f.amount}`, details: {} });
    return { id };
  }

  async remove(id: number, user: any) {
    const c = await this.ctx(user);
    const e = await this.load(id);
    if (e.status !== 'PENDING') throw new BadRequestException('Only a pending expense can be removed.');
    if (!isOwnerRole(c.role) && e.raised_by !== c.id) throw new ForbiddenException('You can remove only the expenses you raised.');
    await this.manager.query(`delete from expense where id = $1`, [id]);
    await this.audit.record({ userId: user.id, action: 'expense.removed', entityType: 'expense', entityId: id, summary: `Pending expense ${id} (${e.amount}) removed`, details: {} });
    return { id };
  }

  async decide(id: number, b: any, user: any) {
    const c = await this.ctx(user);
    const action = String(b?.action || '');
    if (!['approve', 'reject'].includes(action)) throw new BadRequestException('Approve or reject.');
    const e = await this.load(id);
    if (e.status !== 'PENDING') throw new BadRequestException(`This expense is already ${e.status.toLowerCase()}.`);
    if (!this.canDecide(c, e)) {
      const why = c.role === 'Store Head'
        ? (e.raised_by === c.id && !c.self(e.store_id) ? 'You cannot approve your own expense.' : Number(e.amount) > c.limit || e.store_id === null ? 'This one is above your limit or business-level: the Business Head approves it.' : 'It is not for your store.')
        : 'You cannot approve this expense.';
      throw new ForbiddenException(why);
    }
    const note = text(b?.note, 200);
    if (action === 'reject' && (!note || note.length < 3)) throw new BadRequestException('Say why it is rejected.');
    await this.manager.query(`update expense set status = $2, decided_by = $3, decided_on = now(), decision_note = $4 where id = $1`, [id, action === 'approve' ? 'APPROVED' : 'REJECTED', user.id, note]);
    await this.audit.record({ userId: user.id, action: `expense.${action}d`, entityType: 'expense', entityId: id, summary: `Expense ${id} (${e.amount}) ${action}d`, details: { note } });
    return { id };
  }

  // ------------------------------------------------------------------ recurring
  recurring() {
    return this.manager.query(
      `select r.id, r.category_id, k.name as category, r.store_id, s.location as store, r.amount::float as amount, r.payee, r.pay_mode, r.description, r.day_of_month, r.start_month, r.end_month, r.active
         from expense_recurring r join expense_category k on k.id = r.category_id left join stores s on s.id = r.store_id order by r.active desc, k.name, r.id`);
  }

  async saveRecurring(id: number | null, b: any, by: any) {
    const amount = r2(Number(b?.amount));
    if (!(amount > 0)) throw new BadRequestException('Enter the usual amount.');
    if (!MODES.includes(b?.pay_mode)) throw new BadRequestException('Choose how it is paid.');
    const [cat] = await this.manager.query(`select id from expense_category where id = $1 and active`, [Number(b?.category_id)]);
    if (!cat) throw new BadRequestException('Choose the category.');
    if (b.store_id) {
      const [s] = await this.manager.query(`select 1 from stores where id = $1`, [Number(b.store_id)]);
      if (!s) throw new BadRequestException('That store was not found.');
    }
    const day = Number(b.day_of_month || 1);
    if (!Number.isInteger(day) || day < 1 || day > 28) throw new BadRequestException('The day of the month is 1 to 28.');
    if (!PERIOD.test(b.start_month || '')) throw new BadRequestException('Give the first month (YYYY-MM).');
    if (b.end_month && (!PERIOD.test(b.end_month) || b.end_month < b.start_month)) throw new BadRequestException('The last month is before the first.');
    const vals = [cat.id, b.store_id ? Number(b.store_id) : null, amount, text(b.payee, 100), b.pay_mode, text(b.description, 300), day, b.start_month, b.end_month || null, b.active !== false];
    if (id) {
      const [cur] = await this.manager.query(`select 1 from expense_recurring where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Recurring expense not found.');
      await this.manager.query(`update expense_recurring set category_id=$2, store_id=$3, amount=$4, payee=$5, pay_mode=$6, description=$7, day_of_month=$8, start_month=$9, end_month=$10, active=$11 where id=$1`, [id, ...vals]);
    } else {
      const [r] = await this.manager.query(
        `insert into expense_recurring (category_id, store_id, amount, payee, pay_mode, description, day_of_month, start_month, end_month, active, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`, [...vals, by.id]);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'expense.recurring_saved', entityType: 'expense_recurring', entityId: id, summary: `Recurring expense ${amount} saved`, details: {} });
    return { id };
  }

  /** creates the month's entries from the templates, once each; they wait for approval like any other expense */
  async generate(period: string, by: any) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const rows = await this.manager.query(
      `insert into expense (expense_date, store_id, category_id, amount, payee, pay_mode, description, status, raised_by, recurring_id, recurring_period)
       select ($1 || '-' || lpad(r.day_of_month::text, 2, '0'))::date, r.store_id, r.category_id, r.amount, r.payee, r.pay_mode, r.description, 'PENDING', $2, r.id, $1
         from expense_recurring r where r.active and r.start_month <= $1 and (r.end_month is null or r.end_month >= $1)
       on conflict (recurring_id, recurring_period) where recurring_id is not null do nothing returning id`, [period, by.id]);
    await this.audit.record({ userId: by.id, action: 'expense.recurring_generated', entityType: 'expense', entityId: null, summary: `Recurring expenses for ${period}: ${rows.length} created`, details: {} });
    return { created: rows.length };
  }

  // ------------------------------------------------------------------ report
  async report(q: any, user: any) {
    const c = await this.ctx(user);
    const from = DATE.test(q?.from || '') ? q.from : new Date().toISOString().slice(0, 8) + '01';
    const to = DATE.test(q?.to || '') ? q.to : new Date().toISOString().slice(0, 10);
    const args: any[] = [from, to];
    let scopeL = '', scopeT = '';
    if (!isOwnerRole(c.role)) {
      args.push(c.stores);
      scopeL = ` and ex.store_id = any($3)`;
      scopeT = ` and l.store_id = any($3)`;
    } else if (q?.store && q.store !== 'business') {
      args.push([Number(q.store)]);
      scopeL = ` and ex.store_id = any($3)`;
      scopeT = ` and l.store_id = any($3)`;
    }
    const rows = await this.manager.query(
      `select to_char(d, 'YYYY-MM') as month, store, category, amount::float as amount, gst::float as gst, src from (
         select ex.expense_date as d, coalesce(s.location, 'Business level') as store, k.name as category, ex.amount, ex.gst_amount as gst, 'Ledger' as src
           from expense ex join expense_category k on k.id = ex.category_id left join stores s on s.id = ex.store_id
          where ex.status = 'APPROVED' and ex.expense_date between $1 and $2 ${scopeL}
         union all
         select l.trans_date, s.location,
                case l.expense_category when 'RENT' then 'Rent' when 'ELECTRICITY' then 'Electricity' when 'CLEANING' then 'Cleaning' when 'MAINTENANCE' then 'Repairs and maintenance'
                     when 'OFFICE' then 'Stationery and printing' when 'LOGISTICS' then 'Transport and courier' else 'Other' end,
                l.withdraw::numeric, 0, 'Cash drawer'
           from store_cash_accounts l left join stores s on s.id = l.store_id
          where l.category = 'EXPENSE' and l.trans_date between $1 and $2 ${scopeT}
       ) t order by d`, args);
    const sum = (key: string) => {
      const m = new Map<string, { name: string; amount: number; gst: number }>();
      for (const r of rows) { const k = r[key] || '-'; const x = m.get(k) || { name: k, amount: 0, gst: 0 }; x.amount = r2(x.amount + r.amount); x.gst = r2(x.gst + r.gst); m.set(k, x); }
      return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
    };
    const [pend] = await this.manager.query(`select count(*)::int as n, coalesce(sum(amount),0)::float as total from expense where status = 'PENDING'`);
    return {
      from, to, total: r2(rows.reduce((t: number, r: any) => t + r.amount, 0)), gst: r2(rows.reduce((t: number, r: any) => t + r.gst, 0)),
      drawer: r2(rows.filter((r: any) => r.src === 'Cash drawer').reduce((t: number, r: any) => t + r.amount, 0)),
      byCategory: sum('category'), byStore: sum('store'), byMonth: sum('month').sort((a, b) => a.name.localeCompare(b.name)),
      pending: isOwnerRole(c.role) ? pend : null,
    };
  }
}
