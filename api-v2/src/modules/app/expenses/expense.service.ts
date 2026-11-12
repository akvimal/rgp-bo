import { BUSINESS_OF_USER_SQL } from 'src/core/business-of-user';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

import { isOwnerRole } from 'src/core/roles';
import { StoreService } from '../store/store.service';
import { cleanCategoryKind, EVERY_MONTHS, fallsIn, levelProblem, rollUpByGroup } from './expense-category-rules';
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
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService, private readonly stores: StoreService) {}

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
    return this.manager.query(`select id, name, display_order, active, level, cost_group from expense_category order by display_order, name`);
  }

  async saveCategory(id: number | null, b: any, by: any) {
    const name = text(b?.name, 60);
    if (!name) throw new BadRequestException('Give the category a name.');
    const [dup] = await this.manager.query(`select 1 from expense_category where lower(name) = lower($1) and id <> $2`, [name, id || 0]);
    if (dup) throw new BadRequestException(`There is already a category called ${name}.`);
    const [cur] = id ? await this.manager.query(`select level, cost_group from expense_category where id = $1`, [id]) : [undefined];
    if (id && !cur) throw new NotFoundException('Category not found.');
    let kind: { level: string; cost_group: string };
    try { kind = cleanCategoryKind(b, cur); } catch (e: any) { throw new BadRequestException(e.message); }
    if (id) {
      await this.manager.query(`update expense_category set name = $2, display_order = $3, active = $4, level = $5, cost_group = $6 where id = $1`,
        [id, name, Number(b.display_order) || 10, b.active !== false, kind.level, kind.cost_group]);
    } else {
      const [r] = await this.manager.query(`insert into expense_category (name, display_order, level, cost_group) values ($1, $2, $3, $4) returning id`,
        [name, Number(b.display_order) || 50, kind.level, kind.cost_group]);
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
    const [cat] = await this.manager.query(`select id, name, level from expense_category where id = $1 and active`, [Number(b?.category_id)]);
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
    const fit = levelProblem(cat.name, cat.level, store);
    if (fit) throw new BadRequestException(fit);
    // cash: from the drawer of an open shift of the store, or from outside the till (what older callers send: nothing changes for them)
    let cash_source: string | null = null, shift_id: number | null = null;
    if (b.pay_mode === 'CASH') {
      cash_source = b.cash_source === 'DRAWER' ? 'DRAWER' : 'OUTSIDE';
      if (cash_source === 'DRAWER') {
        if (!store) throw new BadRequestException('A drawer belongs to a store: choose the store, or say the cash was not from the till.');
        const [sh] = await this.manager.query(`select id, to_char(shift_date, 'YYYY-MM-DD') as shift_date from store_shifts where id = $1 and store_id = $2 and status = 'OPEN'`, [Number(b.shift_id) || 0, store]);
        if (!sh) throw new BadRequestException('Choose an open shift of this store, or say the cash was not from the till.');
        const today = new Date().toISOString().slice(0, 10);
        if (b.expense_date !== sh.shift_date && b.expense_date !== today) throw new BadRequestException('An expense from the drawer is dated the day of its shift. For an earlier day, say the cash was not from the till.');
        shift_id = sh.id;
      }
    }
    // not cash: the bank account it was paid from (the form asks for it when the business has bank accounts; it is optional here, so callers that send none still work) and the payment's reference
    let bank_account_id: number | null = null;
    if (b.pay_mode !== 'CASH') {
      const biz = await this.businessOf(store, c);
      const accounts = biz ? await this.manager.query(`select id, store_id from bank_account where business_id = $1 and active`, [biz]) : [];
      if (b.bank_account_id) {
        const a = accounts.find((x: any) => x.id === Number(b.bank_account_id));
        if (!a) throw new BadRequestException('That bank account was not found for this business.');
        if (a.store_id && store && a.store_id !== store) throw new BadRequestException('That bank account belongs to another store.');
        bank_account_id = a.id;
      }   // the form asks for it (bank, card, cheque); the server takes none from callers that do not send one, and the bank match then goes by amount and week
    }
    return {
      cash_source, shift_id, category_name: cat.name, bank_account_id, reference: b.pay_mode === 'CASH' ? null : text(b.reference, 40),
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
      `insert into expense (expense_date, store_id, category_id, amount, gst_amount, payee, bill_no, pay_mode, description, receipt_path, status, raised_by, decided_by, decided_on, decision_note, cash_source, shift_id, bank_account_id, reference)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
      [f.expense_date, f.store_id, f.category_id, f.amount, f.gst_amount, f.payee, f.bill_no, f.pay_mode, f.description, f.receipt_path, status, user.id,
        status === 'APPROVED' ? user.id : null, status === 'APPROVED' ? new Date() : null, note, f.cash_source, f.shift_id, f.bank_account_id, f.reference]);
    // the cash left the drawer when it was paid: the shift's drawer shows it now, whether or not the expense has been approved yet
    if (f.cash_source === 'DRAWER') await this.postToDrawer(r.id, f);
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
              e.recurring_id, e.cash_source, e.shift_id, sh.name as shift_name, e.bank_account_id, ba.name as bank_account, e.reference,
              (upper(e.pay_mode) <> 'CASH' and e.status = 'APPROVED') as bankable,
              exists (select 1 from bank_txn t where t.match_kind = 'EXPENSE' and t.match_id = e.id) as bank_matched
         from expense e join expense_category k on k.id = e.category_id left join stores s on s.id = e.store_id
         left join app_user u on u.id = e.raised_by left join app_user d on d.id = e.decided_by left join store_shifts sh on sh.id = e.shift_id left join bank_account ba on ba.id = e.bank_account_id
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
    await this.unpostFromDrawer(id);
    await this.manager.query(
      `update expense set expense_date=$2, store_id=$3, category_id=$4, amount=$5, gst_amount=$6, payee=$7, bill_no=$8, pay_mode=$9, description=$10, receipt_path=$11, cash_source=$12, shift_id=$13, bank_account_id=$14, reference=$15 where id=$1`,
      [id, f.expense_date, f.store_id, f.category_id, f.amount, f.gst_amount, f.payee, f.bill_no, f.pay_mode, f.description, f.receipt_path, f.cash_source, f.shift_id, f.bank_account_id, f.reference]);
    if (f.cash_source === 'DRAWER') await this.postToDrawer(id, f);
    await this.audit.record({ userId: user.id, action: 'expense.updated', entityType: 'expense', entityId: id, summary: `Expense ${id} changed to ${f.amount}`, details: {} });
    return { id };
  }

  async remove(id: number, user: any) {
    const c = await this.ctx(user);
    const e = await this.load(id);
    if (e.status !== 'PENDING') throw new BadRequestException('Only a pending expense can be removed.');
    if (!isOwnerRole(c.role) && e.raised_by !== c.id) throw new ForbiddenException('You can remove only the expenses you raised.');
    await this.unpostFromDrawer(id);
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
    if (action === 'reject') await this.unpostFromDrawer(id);
    await this.manager.query(`update expense set status = $2, decided_by = $3, decided_on = now(), decision_note = $4 where id = $1`, [id, action === 'approve' ? 'APPROVED' : 'REJECTED', user.id, note]);
    await this.audit.record({ userId: user.id, action: `expense.${action}d`, entityType: 'expense', entityId: id, summary: `Expense ${id} (${e.amount}) ${action}d`, details: { note } });
    return { id };
  }

  // ------------------------------------------------------------------ the bank
  /** the business an expense belongs to: its store's, or (no store) the person's */
  private async businessOf(store: number | null, c: Ctx): Promise<number | null> {
    if (store) return (await this.manager.query(`select business_id from stores where id = $1`, [store]))[0]?.business_id ?? null;
    return (await this.manager.query(`select ${BUSINESS_OF_USER_SQL} as business_id from app_user u where u.id = $1`, [c.id]))[0]?.business_id ?? null;
  }

  /** the bank accounts an expense can be paid from (names only: the balances and statements are the Business Head's, under Finance) */
  async bankAccounts(q: any, user: any) {
    const c = await this.ctx(user);
    const store = Number(q?.store) > 0 ? Number(q.store) : null;
    if (store && !isOwnerRole(c.role) && !c.stores.includes(store)) return [];
    const biz = await this.businessOf(store, c);
    if (!biz) return [];
    return this.manager.query(
      `select id, name, bank_name, last4, store_id from bank_account where business_id = $1 and active and ($2::int is null or store_id is null or store_id = $2) order by name`, [biz, store]);
  }

  // ------------------------------------------------------------------ the drawer
  /** the till's own codes for the expense kinds it knows; anything else is Other */
  private static readonly TILL_KIND: Record<string, string> = {
    'Rent': 'RENT', 'Electricity': 'ELECTRICITY', 'Cleaning': 'CLEANING', 'Repairs and maintenance': 'MAINTENANCE', 'Stationery and printing': 'OFFICE', 'Transport and courier': 'LOGISTICS',
  };

  /** the open shifts of a store whose drawer can pay an expense: a manager sees them all, anyone else the one they work (their own drawer, or the store's single shift) */
  async openShifts(q: any, user: any) {
    const c = await this.ctx(user);
    const store = Number(q?.store);
    if (!(store > 0)) return [];
    if (!isOwnerRole(c.role) && !c.stores.includes(store)) return [];
    const rows = await this.manager.query(
      `select sh.id, sh.name, to_char(sh.shift_date, 'YYYY-MM-DD') as shift_date, sh.assigned_user_id, u.full_name as assigned
         from store_shifts sh left join app_user u on u.id = sh.assigned_user_id
        where sh.store_id = $1 and sh.status = 'OPEN' order by sh.id desc`, [store]);
    const staffBased = (await this.manager.query(`select shift_mode from stores where id = $1`, [store]))[0]?.shift_mode === 'staff';
    const sees = isOwnerRole(c.role) || c.role === 'Store Head' || !staffBased;
    return rows.filter((r: any) => sees || r.assigned_user_id === c.id).map((r: any) => ({ id: r.id, name: r.name, shiftdate: r.shift_date, assigned: r.assigned || null }));
  }

  /** the drawer row for a cash expense: the shift's expected cash goes down by it (the same row the Cash screen writes for a till expense) */
  private async postToDrawer(expenseId: number, f: any) {
    const kind = ExpenseService.TILL_KIND[f.category_name] || 'OTHER';
    const desc = [f.payee, f.description].filter(Boolean).join(' - ').slice(0, 480) || f.category_name;
    await this.manager.query(
      `insert into store_cash_accounts (trans_date, category, description, deposit, withdraw, holder, expense_category, receipt_path, store_id, shift_id, expense_id)
       values ($1, 'EXPENSE', $2, 0, $3, 'DRAWER', $4, $5, $6, $7, $8)`,
      [f.expense_date, desc, f.amount, kind, f.receipt_path ? String(f.receipt_path).slice(0, 255) : null, f.store_id, f.shift_id, expenseId]);
    await this.stores.refreshShiftTotals(f.shift_id);
  }

  /** takes the drawer row of an expense back (the expense is edited, removed or rejected); refused once its shift has closed, because the count was made without it */
  private async unpostFromDrawer(expenseId: number) {
    const rows = await this.manager.query(
      `select l.id, l.shift_id, sh.status as shift_status from store_cash_accounts l left join store_shifts sh on sh.id = l.shift_id where l.expense_id = $1`, [expenseId]);
    if (!rows.length) return;
    if (rows.some((r: any) => r.shift_status !== 'OPEN')) throw new BadRequestException('This cash left the drawer of a shift that has closed, so it cannot be changed, removed or rejected now. Ask a Store Head or Business Head.');
    await this.manager.query(`delete from store_cash_accounts where expense_id = $1`, [expenseId]);
    for (const sid of new Set<number>(rows.map((r: any) => +r.shift_id))) await this.stores.refreshShiftTotals(sid);
  }

  // ------------------------------------------------------------------ recurring
  recurring() {
    return this.manager.query(
      `select r.id, r.category_id, k.name as category, r.store_id, s.location as store, r.amount::float as amount, r.payee, r.pay_mode, r.description, r.day_of_month, r.start_month, r.end_month, r.active, r.every_months
         from expense_recurring r join expense_category k on k.id = r.category_id left join stores s on s.id = r.store_id order by r.active desc, k.name, r.id`);
  }

  async saveRecurring(id: number | null, b: any, by: any) {
    const amount = r2(Number(b?.amount));
    if (!(amount > 0)) throw new BadRequestException('Enter the usual amount.');
    if (!MODES.includes(b?.pay_mode)) throw new BadRequestException('Choose how it is paid.');
    const [cat] = await this.manager.query(`select id, name, level from expense_category where id = $1 and active`, [Number(b?.category_id)]);
    if (!cat) throw new BadRequestException('Choose the category.');
    const fit = levelProblem(cat.name, cat.level, b.store_id ? Number(b.store_id) : null);
    if (fit) throw new BadRequestException(fit);
    const every = b.every_months === undefined || b.every_months === null || b.every_months === '' ? 1 : Number(b.every_months);
    if (!EVERY_MONTHS.includes(every)) throw new BadRequestException('It repeats every 1, 3, 6 or 12 months.');
    if (b.store_id) {
      const [s] = await this.manager.query(`select 1 from stores where id = $1`, [Number(b.store_id)]);
      if (!s) throw new BadRequestException('That store was not found.');
    }
    const day = Number(b.day_of_month || 1);
    if (!Number.isInteger(day) || day < 1 || day > 28) throw new BadRequestException('The day of the month is 1 to 28.');
    if (!PERIOD.test(b.start_month || '')) throw new BadRequestException('Give the first month (YYYY-MM).');
    if (b.end_month && (!PERIOD.test(b.end_month) || b.end_month < b.start_month)) throw new BadRequestException('The last month is before the first.');
    const vals = [cat.id, b.store_id ? Number(b.store_id) : null, amount, text(b.payee, 100), b.pay_mode, text(b.description, 300), day, b.start_month, b.end_month || null, b.active !== false, every];
    if (id) {
      const [cur] = await this.manager.query(`select 1 from expense_recurring where id = $1`, [id]);
      if (!cur) throw new NotFoundException('Recurring expense not found.');
      await this.manager.query(`update expense_recurring set category_id=$2, store_id=$3, amount=$4, payee=$5, pay_mode=$6, description=$7, day_of_month=$8, start_month=$9, end_month=$10, active=$11, every_months=$12 where id=$1`, [id, ...vals]);
    } else {
      const [r] = await this.manager.query(
        `insert into expense_recurring (category_id, store_id, amount, payee, pay_mode, description, day_of_month, start_month, end_month, active, every_months, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, [...vals, by.id]);
      id = r.id;
    }
    await this.audit.record({ userId: by.id, action: 'expense.recurring_saved', entityType: 'expense_recurring', entityId: id, summary: `Recurring expense ${amount} saved`, details: {} });
    return { id };
  }

  /** creates the month's entries from the templates, once each; they wait for approval like any other expense */
  async generate(period: string, by: any) {
    if (!PERIOD.test(period || '')) throw new BadRequestException('A month (YYYY-MM) is required.');
    const templates = await this.manager.query(
      `select r.id, r.store_id, r.category_id, r.amount, r.payee, r.pay_mode, r.description, r.day_of_month, r.start_month, r.every_months
         from expense_recurring r where r.active and r.start_month <= $1 and (r.end_month is null or r.end_month >= $1)`, [period]);
    let created = 0;
    for (const r of templates) {
      if (!fallsIn(r.start_month, period, r.every_months)) continue;          // a quarterly or yearly one comes only in its own months
      const made = await this.manager.query(
        `insert into expense (expense_date, store_id, category_id, amount, payee, pay_mode, description, status, raised_by, recurring_id, recurring_period)
         values (($1 || '-' || lpad($2::text, 2, '0'))::date, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10, $1)
         on conflict (recurring_id, recurring_period) where recurring_id is not null do nothing returning id`,
        [period, r.day_of_month, r.store_id, r.category_id, r.amount, r.payee, r.pay_mode, r.description, by.id, r.id]);
      created += made.length;
    }
    await this.audit.record({ userId: by.id, action: 'expense.recurring_generated', entityType: 'expense', entityId: null, summary: `Recurring expenses for ${period}: ${created} created`, details: {} });
    return { created };
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
          where l.category = 'EXPENSE' and l.expense_id is null and l.trans_date between $1 and $2 ${scopeT}
       ) t order by d`, args);
    const groupOf = new Map<string, string>((await this.manager.query(`select name, cost_group from expense_category`)).map((k: any) => [k.name, k.cost_group]));
    rows.forEach((r: any) => { r.group = groupOf.get(r.category) || 'Other'; });
    const sum = (key: string) => {
      const m = new Map<string, { name: string; amount: number; gst: number }>();
      for (const r of rows) { const k = r[key] || '-'; const x = m.get(k) || { name: k, amount: 0, gst: 0 }; x.amount = r2(x.amount + r.amount); x.gst = r2(x.gst + r.gst); m.set(k, x); }
      return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
    };
    const [pend] = await this.manager.query(`select count(*)::int as n, coalesce(sum(amount),0)::float as total from expense where status = 'PENDING'`);
    return {
      from, to, total: r2(rows.reduce((t: number, r: any) => t + r.amount, 0)), gst: r2(rows.reduce((t: number, r: any) => t + r.gst, 0)),
      drawer: r2(rows.filter((r: any) => r.src === 'Cash drawer').reduce((t: number, r: any) => t + r.amount, 0)),
      byCategory: sum('category'), byGroup: rollUpByGroup(rows), byStore: sum('store'), byMonth: sum('month').sort((a, b) => a.name.localeCompare(b.name)),
      pending: isOwnerRole(c.role) ? pend : null,
    };
  }
}
