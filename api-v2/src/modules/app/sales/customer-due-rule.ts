import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Rs, two decimals */
export const money = (n: number) => Math.round(n * 100) / 100;

/** the day after "today + n days" in the shop's time (the date a promise is counted from) */
export const isoToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

export const DEFAULT_DUE_DAYS = 7;
export const MAX_DUE_DAYS = 90;

export type DueRow = { kind: string; amount: number; due_date?: string | null; entry_date?: string | null; sale_id?: number | null };
export type OpenDue = { sale_id: number | null; due_date: string; remaining: number };

/**
 * What is still unpaid, oldest first. Money collected (and any reduction) is set against the oldest due first; a raise by hand
 * is due the day it was made. Pure: the services pass in the ledger rows.
 */
export function openDues(rows: DueRow[]): OpenDue[] {
  const dues: OpenDue[] = [];
  let paid = 0;
  for (const r of rows) {
    const amount = money(Number(r.amount));
    if (amount < 0) paid += -amount;
    else dues.push({ sale_id: r.sale_id ?? null, due_date: String(r.due_date ?? r.entry_date ?? '').slice(0, 10), remaining: amount });
  }
  dues.sort((a, b) => a.due_date.localeCompare(b.due_date));
  const out: OpenDue[] = [];
  for (const d of dues) {
    const take = Math.min(d.remaining, paid);
    paid = money(paid - take);
    const left = money(d.remaining - take);
    if (left > 0.004) out.push({ ...d, remaining: left });
  }
  return out;
}

/** the part of what is owed that was promised for before today */
export function overdueOf(open: OpenDue[], today: string): { amount: number; since: string | null } {
  const late = open.filter(d => d.due_date && d.due_date < today);
  return { amount: money(late.reduce((s, d) => s + d.remaining, 0)), since: late.length ? late[0].due_date : null };
}

/** a promised date: a real date, not in the past and not beyond 90 days; blank means a week from today */
export function dueDateProblem(raw: any, today: string): { value: string; error?: string } {
  const text = String(raw ?? '').slice(0, 10);
  if (!text) return { value: addDays(today, DEFAULT_DUE_DAYS) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text + 'T00:00:00Z'))) return { value: '', error: 'Give the day the customer will pay as a date.' };
  if (text < today) return { value: '', error: 'The day the customer will pay cannot be in the past.' };
  if (text > addDays(today, MAX_DUE_DAYS)) return { value: '', error: `The day the customer will pay can be at most ${MAX_DUE_DAYS} days away.` };
  return { value: text };
}

/** a named customer, with or without a mobile number; the walk-in placeholder or none cannot owe */
async function namedCustomer(manager: EntityManager, customerId: any) {
  const id = Number(customerId || 0);
  if (!id) return null;
  const [c] = await manager.query(`select id, name, mobile, credit_limit::float8 as credit_limit from customer where id = $1`, [id]);
  return c && String(c.name ?? '').trim() && c.mobile !== '0000000000' ? c : null;
}

export async function dueBalance(manager: EntityManager, customerId: number): Promise<number> {
  const [r] = await manager.query(`select coalesce(sum(amount), 0)::float8 as b from customer_due_entry where customer_id = $1`, [customerId]);
  return money(Number(r.b));
}

export async function dueRows(manager: EntityManager, customerId: number): Promise<DueRow[]> {
  return manager.query(
    `select kind, amount::float8 as amount, sale_id, to_char(due_date, 'YYYY-MM-DD') as due_date, to_char(entry_date, 'YYYY-MM-DD') as entry_date
       from customer_due_entry where customer_id = $1 order by entry_date, id`, [customerId]);
}

/**
 * A bill with part (or all) left to pay later: only for a named customer; within their limit and with nothing overdue unless a Store Head or
 * Business Head is billing; never more than the bill; never together with staff credit. The rest of the bill is paid by cash / digital as usual.
 */
export async function checkCustomerDue(manager: EntityManager, sale: any, customer: any, isManager: boolean, saleId?: number | null, billStoreId?: number | null) {
  const none = { dueamt: 0, duedate: null as string | null };
  if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return null;
  const amount = money(Number(sale?.dueamt || 0));
  if (!(amount > 0)) return none;
  if (Number(sale?.staffcreditamt || 0) > 0) throw new BadRequestException('A bill on staff credit cannot also be left to pay later.');
  if (amount > money(Number(sale?.total || 0)) + 0.005) throw new BadRequestException('The amount left to pay later is more than the bill.');
  const storeId = Number(billStoreId || sale?.storeid || 0);
  if (storeId) {
    const [st] = await manager.query(`select location, pay_later_allowed from stores where id = $1`, [storeId]);
    if (st && st.pay_later_allowed === false) throw new BadRequestException(`${String(st.location).trim()} does not allow pay later. Take the full payment now.`);
  }
  const c = await namedCustomer(manager, customer?.id ?? sale?.customerid);
  if (!c) throw new BadRequestException('Paying later needs a named customer on the bill (not the walk-in).');

  const today = isoToday();
  const when = dueDateProblem(sale?.duedate, today);
  if (when.error) throw new BadRequestException(when.error);

  const rows = await dueRows(manager, c.id);
  // editing a bill that already carries its due: that due is not counted twice
  const own = saleId ? rows.filter(r => r.kind === 'DUE' && Number(r.sale_id) === Number(saleId)) : [];
  const others = rows.filter(r => !own.includes(r));
  const balance = money(others.reduce((s, r) => s + Number(r.amount), 0));
  if (!isManager) {
    const limit = money(Number(c.credit_limit || 0));
    if (!(limit > 0)) throw new BadRequestException(`${c.name} has no credit limit. A Store Head or Business Head sets one on the customer, or bills this themselves.`);
    if (balance + amount > limit + 0.005) {
      throw new BadRequestException(`${c.name}'s credit limit is ${limit.toFixed(2)}; ${balance.toFixed(2)} is already owed and this bill leaves ${amount.toFixed(2)}. Ask a Store Head or Business Head, or take more now.`);
    }
    const late = overdueOf(openDues(others), today);
    if (late.amount > 0) {
      throw new BadRequestException(`${c.name} has ${late.amount.toFixed(2)} overdue since ${late.since}. Collect it first, or ask a Store Head or Business Head.`);
    }
  }
  return { dueamt: amount, duedate: when.value };
}

/** writes the DUE entry for a completed bill with an amount left to pay, once, re-checking the customer under a lock */
export async function recordCustomerDue(tm: EntityManager, saved: any, byUserId: number) {
  const amount = money(Number(saved?.dueamt || 0));
  if (!saved?.id || !(amount > 0) || String(saved.status || '').toUpperCase() !== 'COMPLETE') return;
  const [done] = await tm.query(`select 1 from customer_due_entry where sale_id = $1 and kind = 'DUE'`, [saved.id]);
  if (done) return;
  const cid = Number(saved.customerid || saved.customer?.id || 0);
  const c = await namedCustomer(tm, cid);
  if (!c) throw new BadRequestException('Paying later needs a named customer on the bill (not the walk-in).');
  await tm.query(`select id from customer where id = $1 for update`, [c.id]);
  await tm.query(
    `insert into customer_due_entry (customer_id, kind, amount, sale_id, store_id, due_date, note, created_by) values ($1, 'DUE', $2, $3, $4, $5, $6, $7)`,
    [c.id, amount, saved.id, saved.storeid ?? null, saved.duedate ?? addDays(isoToday(), DEFAULT_DUE_DAYS), `Bill ${saved.billno ?? saved.id}`, byUserId]);
}
