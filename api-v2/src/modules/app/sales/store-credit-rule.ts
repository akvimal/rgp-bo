import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { checkCashRefund } from './return-rule';

const money = (n: number) => Math.round(n * 100) / 100;

/** a customer with a real mobile number; the "NIL" walk-in (0000000000) or none cannot hold credit */
async function namedCustomer(manager: EntityManager, customerId: any) {
  const id = Number(customerId || 0);
  if (!id) return null;
  const [c] = await manager.query(`select id, name, mobile from customer where id = $1`, [id]);
  const mobile = String(c?.mobile ?? '').trim();
  return c && mobile && mobile !== '0000000000' ? c : null;
}

export async function creditBalance(manager: EntityManager, customerId: number): Promise<number> {
  const [r] = await manager.query(`select coalesce(sum(amount), 0)::float as b from customer_credit_entry where customer_id = $1`, [customerId]);
  return money(Number(r.b));
}

/**
 * A bill paid (partly) with store credit: only for a named customer, only up to their balance, never more than the bill.
 * The remainder is paid by cash / digital as usual (the tender check counts the credit).
 */
export async function checkStoreCredit(manager: EntityManager, sale: any, customer: any, saleId?: number | null) {
  if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return null;
  const amount = money(Number(sale?.creditamt || 0));
  if (!(amount > 0)) return { creditamt: 0 };
  if (Number(sale?.staffcreditamt || 0) > 0) throw new BadRequestException('A bill on staff credit cannot also use store credit.');
  if (amount > money(Number(sale?.total || 0)) + 0.005) throw new BadRequestException('The store credit used is more than the bill.');
  const c = await namedCustomer(manager, customer?.id ?? sale?.customerid);
  if (!c) throw new BadRequestException('Store credit needs a named customer with a mobile number on the bill.');
  const [already] = saleId ? await manager.query(`select amount::float as a from customer_credit_entry where sale_id = $1 and kind = 'REDEEMED'`, [saleId]) : [null];
  const balance = money((await creditBalance(manager, c.id)) + (already ? -Number(already.a) : 0));
  if (amount > balance + 0.005) throw new BadRequestException(`${c.name} has ${balance.toFixed(2)} of store credit; this bill uses ${amount.toFixed(2)}.`);
  return { creditamt: amount };
}

/** writes the REDEEMED entry for a completed bill, once, re-checking the balance under a lock on the customer */
export async function recordStoreCredit(tm: EntityManager, saved: any, byUserId: number) {
  const amount = money(Number(saved?.creditamt || 0));
  if (!saved?.id || !(amount > 0) || String(saved.status || '').toUpperCase() !== 'COMPLETE') return;
  const [done] = await tm.query(`select 1 from customer_credit_entry where sale_id = $1 and kind = 'REDEEMED'`, [saved.id]);
  if (done) return;
  const cid = Number(saved.customerid || saved.customer?.id || 0);
  const c = await namedCustomer(tm, cid);
  if (!c) throw new BadRequestException('Store credit needs a named customer with a mobile number on the bill.');
  await tm.query(`select id from customer where id = $1 for update`, [c.id]);
  const balance = await creditBalance(tm, c.id);
  if (amount > balance + 0.005) throw new BadRequestException(`${c.name} has ${balance.toFixed(2)} of store credit; this bill uses ${amount.toFixed(2)}.`);
  await tm.query(
    `insert into customer_credit_entry (customer_id, kind, amount, sale_id, store_id, note, created_by) values ($1, 'REDEEMED', $2, $3, $4, $5, $6)`,
    [c.id, -amount, saved.id, saved.storeid ?? null, `Bill ${saved.billno ?? saved.id}`, byUserId]);
}

export const REFUND_MODES = ['CREDIT', 'CASH', 'TRANSFER'];

/**
 * Settling a return (the "adjust" step): records how the customer is refunded and how much, and issues store credit when
 * the refund is credit. The refund is the accepted quantity at what the customer paid per unit on that line. Once only.
 * Mutates `item` with refundmode / refundamount so the caller's save stores them.
 */
export async function settleReturn(tm: EntityManager, item: any, byUserId: number) {
  const [r] = await tm.query(
    `select sri.id, sri.qty, sri.status, sri.refund_mode, sri.needs_inspection, si.total::float as line_total, si.qty as sold_qty, si.price::float as unit_price,
            si.purchase_item_id, si.reason as sale_reason, s.id as sale_id, s.bill_no, s.store_id, s.customer_id
       from sale_return_item sri join sale_item si on si.id = sri.sale_item_id join sale s on s.id = si.sale_id
      where sri.id = $1 for update of sri`, [item.id]);
  if (!r) throw new NotFoundException('Return not found.');
  if (r.status === 'ADJUSTED') throw new BadRequestException('This return is already settled.');
  const mode = String(item.refundmode || r.refund_mode || '').toUpperCase();
  if (!REFUND_MODES.includes(mode)) throw new BadRequestException('Choose how the customer is refunded: credit, cash or transfer.');
  const accepted = item.acceptedqty === undefined || item.acceptedqty === null ? Number(r.qty) : Number(item.acceptedqty);
  if (!Number.isFinite(accepted) || accepted < 0 || accepted > Number(r.qty)) throw new BadRequestException('The accepted quantity must be between 0 and the quantity returned.');
  const amount = money((Number(r.line_total) / Math.max(1, Number(r.sold_qty))) * accepted);
  // a product that has to be inspected is taken back only after someone says they looked at it
  const note = String(item.inspectionnote || '').trim();
  if (r.needs_inspection && !note) throw new BadRequestException('This item must be inspected before it is taken back. Say what you found.');
  if (mode === 'CASH' && amount > 0) await checkCashRefund(tm, r.store_id, amount);

  if (mode === 'CREDIT' && amount > 0) {
    const c = await namedCustomer(tm, r.customer_id);
    if (!c) throw new BadRequestException('Store credit needs a named customer with a mobile number on the original bill. Refund by cash or transfer instead.');
    await tm.query(
      `insert into customer_credit_entry (customer_id, kind, amount, return_item_id, sale_id, store_id, note, created_by) values ($1, 'ISSUED', $2, $3, $4, $5, $6, $7)`,
      [c.id, amount, r.id, r.sale_id, r.store_id, `Return on bill ${r.bill_no ?? r.sale_id}`, byUserId]);
  }
  // stock moves with the refund, in the same transaction: everything returned comes in, what is not fit to sell goes out again, flagged as discarded
  const discarded = Number(r.qty) - accepted;
  if (r.purchase_item_id) {
    await tm.query(
      `insert into product_qtychange (item_id, qty, sale_price, reason, reason_code, status, comments, store_id, discarded, created_by)
       values ($1, $2, $3, 'Returned', 'RETURNED', 'APPROVED', $4, $5, false, $6)`,
      [r.purchase_item_id, Number(r.qty), r.unit_price, `Return on bill ${r.bill_no ?? r.sale_id}`, r.store_id, byUserId]);
    if (discarded > 0) {
      await tm.query(
        `insert into product_qtychange (item_id, qty, sale_price, reason, reason_code, status, comments, store_id, discarded, created_by)
         values ($1, $2, $3, 'Discarded on return', 'RETURN_DISCARD', 'APPROVED', $4, $5, true, $6)`,
        [r.purchase_item_id, -discarded, r.unit_price, note || `Not fit to sell, return on bill ${r.bill_no ?? r.sale_id}`, r.store_id, byUserId]);
    }
  }
  await tm.query(
    `update sale_return_item set accepted_qty = $2, discarded_qty = $3, inspection_note = $4, settled_by = $5::int, settled_on = now(),
            inspected_by = case when needs_inspection then $5::int end, inspected_on = case when needs_inspection then now() end where id = $1`,
    [r.id, accepted, discarded, note || null, byUserId]);
  item.refundmode = mode;
  item.refundamount = amount;
  delete item.acceptedqty;
  delete item.inspectionnote;
}
