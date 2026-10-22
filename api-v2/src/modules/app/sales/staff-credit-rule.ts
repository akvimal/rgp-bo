import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Rs, two decimals */
const money = (n: number) => Math.round(n * 100) / 100;

/** the salary month a bill belongs to: the month it is rung up in */
export const currentPeriod = () => new Date().toISOString().slice(0, 7);

/**
 * A bill paid on staff credit: the whole bill, for one active person who has a monthly cap, and only while the month's
 * credit (this bill included) stays inside that cap. The cap is the Business Head's approval. Anything else with a
 * staff-credit amount is refused; a bill without one carries none.
 */
export async function checkStaffCredit(manager: EntityManager, sale: any, saleId?: number | null) {
  const none = { staffcreditamt: 0, staffcredituserid: null };
  if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return null;
  const amount = money(Number(sale?.staffcreditamt || 0));
  if (!(amount > 0)) return none;

  const total = money(Number(sale?.total || 0));
  if (Math.abs(amount - total) > 0.5 || Number(sale?.cashamt || 0) > 0 || Number(sale?.digiamt || 0) > 0 || Number(sale?.creditamt || 0) > 0) {
    throw new BadRequestException('Staff credit pays the whole bill: no cash or digital amount can be mixed with it.');
  }
  const userId = Number(sale?.staffcredituserid || 0);
  if (!userId) throw new BadRequestException('Choose the staff member the credit is for.');

  const [u] = await manager.query(`select u.id, u.full_name, l.monthly_cap from app_user u left join staff_credit_limit l on l.user_id = u.id where u.id = $1 and u.active`, [userId]);
  if (!u) throw new BadRequestException('That staff member was not found or is not active.');
  const cap = Number(u.monthly_cap || 0);
  if (!(cap > 0)) throw new BadRequestException(`${u.full_name} has no staff-credit limit. The Business Head sets one under Staff & Quality > Staff credit.`);

  const [used] = await manager.query(
    `select coalesce(sum(amount), 0) as used from staff_credit_entry
      where user_id = $1 and period = $2 and kind = 'CREDIT' and sale_id is distinct from $3`, [userId, currentPeriod(), saleId || null]);
  const spent = Number(used.used || 0);
  if (spent + amount > cap + 0.005) {
    throw new BadRequestException(`${u.full_name}'s monthly staff-credit limit is ${cap.toFixed(2)}; ${spent.toFixed(2)} is already used, this bill is ${amount.toFixed(2)}.`);
  }
  return { staffcreditamt: amount, staffcredituserid: userId };
}

/** writes the CREDIT entry for a completed staff-credit bill, once */
export async function recordStaffCredit(tm: EntityManager, saved: any, byUserId: number) {
  const amount = money(Number(saved?.staffcreditamt || 0));
  if (!saved?.id || !(amount > 0) || String(saved.status || '').toUpperCase() !== 'COMPLETE' || !saved.staffcredituserid) return;
  await tm.query(
    `insert into staff_credit_entry (user_id, kind, amount, period, sale_id, store_id, note, created_by)
     values ($1, 'CREDIT', $2, $3, $4, $5, $6, $7) on conflict do nothing`,
    [saved.staffcredituserid, amount, currentPeriod(), saved.id, saved.storeid ?? null, `Bill ${saved.billno ?? saved.id}`, byUserId]);
}
