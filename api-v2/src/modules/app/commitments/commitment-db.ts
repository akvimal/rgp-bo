import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DEFAULT_HOLD_DAYS, allocateReceived, balanceOf, heldUnits, holdUntil, statusOf, stillHeld } from './commitment-rules';

const money = (n: number) => Math.round(n * 100) / 100;

/** today in India, as a date */
export const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

/** how many days received goods are held for the customer (Settings: commitment_hold_days) */
export async function holdDays(manager: EntityManager): Promise<number> {
  const [r] = await manager.query(`select setting_value from app_setting where setting_key = 'commitment_hold_days' and active and not archive limit 1`);
  const n = Number(r?.setting_value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_HOLD_DAYS;
}

/** the advance held for a commitment */
export async function commitmentBalance(manager: EntityManager, commitmentId: number): Promise<number> {
  const rows = await manager.query(`select amount::float as amount from customer_commitment_payment where commitment_id = $1`, [commitmentId]);
  return balanceOf(rows);
}

/**
 * Purchasing received goods against requests: the lines linked to those requests take what arrived, the oldest commitment first, and each commitment's status
 * (and the hold on what arrived) follows. Worked out from the requests' received quantity each time, so completing and deleting an invoice both leave it right.
 * Returns the commitments that have just become ready (their customers are to be told).
 */
export async function allocateCommitmentReceipts(manager: EntityManager, requestIds: number[]): Promise<number[]> {
  if (!requestIds.length) return [];
  const rows = await manager.query(
    `select l.id, l.qty, l.request_id, l.commitment_id, l.qty_received, coalesce(pr.fulfilled_qty, 0) as received
       from customer_commitment_line l
       join customer_commitment c on c.id = l.commitment_id and c.status in ('OPEN', 'ORDERED', 'READY')
       join purchase_request pr on pr.id = l.request_id
      where l.request_id = any($1::int[]) and l.active
      order by l.request_id, c.id, l.id`, [requestIds]);
  if (!rows.length) return [];
  const byRequest = new Map<number, any[]>();
  for (const r of rows) (byRequest.get(+r.request_id) || byRequest.set(+r.request_id, []).get(+r.request_id)!).push(r);
  const touched = new Set<number>();
  for (const lines of byRequest.values()) {
    const take = allocateReceived(lines.map((l: any) => ({ id: +l.id, qty: +l.qty })), +lines[0].received);
    for (const l of lines) {
      const next = take.get(+l.id) ?? 0;
      if (next !== +l.qty_received) {
        await manager.query(`update customer_commitment_line set qty_received = $2 where id = $1`, [l.id, next]);
        touched.add(+l.commitment_id);
      }
    }
  }
  const newlyReady: number[] = [];
  const days = await holdDays(manager);
  for (const id of touched) {
    const [c] = await manager.query(`select id, status, hold_until from customer_commitment where id = $1 for update`, [id]);
    const lines = await manager.query(`select request_id, qty_received from customer_commitment_line where commitment_id = $1 and active`, [id]);
    const status = statusOf(c.status, lines);
    if (status === c.status) continue;
    // the hold starts when the goods first arrive, and is dropped if they are taken back out (an invoice deleted)
    const hold = status === 'READY' ? (c.hold_until ?? holdUntil(istToday(), days)) : null;
    await manager.query(`update customer_commitment set status = $2::varchar, hold_until = $3::date, notified_at = case when $2::varchar = 'READY' then notified_at else null end, updated_on = now() where id = $1`, [id, status, hold]);
    if (status === 'READY' && c.status !== 'READY') newlyReady.push(id);
  }
  return newlyReady;
}

/** units held at a store for customers whose goods have arrived and are still held, by product, leaving out the commitment a bill is collecting */
export async function heldByProduct(manager: EntityManager, storeId: number | null, productIds: number[], exceptCommitmentId: number | null): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!storeId || !productIds.length) return out;
  const rows = await manager.query(
    `select l.product_id, l.qty_received, p.pack
       from customer_commitment_line l
       join customer_commitment c on c.id = l.commitment_id and c.status = 'READY' and c.store_id = $2 and c.hold_until >= current_date
       join product p on p.id = l.product_id
      where l.active and l.product_id = any($1::int[]) and l.qty_received > 0 and c.id <> $3`, [productIds, storeId, exceptCommitmentId || 0]);
  for (const r of rows) out.set(+r.product_id, (out.get(+r.product_id) || 0) + heldUnits(+r.qty_received, +r.pack));
  return out;
}

/** the units of a product that can be sold at a store: what the batches received there hold, less what was sold, plus adjustments and out-passes (the bill's own earlier lines are not counted as sold) */
async function freeByProduct(manager: EntityManager, storeId: number, productIds: number[], ownSaleId: number): Promise<Map<number, number>> {
  const rows = await manager.query(
    `select pii.product_id,
            sum((case when i.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
                - coalesce((select sum(si.qty) from sale_item si inner join sale s on s.id = si.sale_id
                             where si.purchase_item_id = pii.id and si.active = true and si.archive = false and s.store_id = $2 and s.id <> $3), 0)
                + coalesce((select sum(pq.qty) from product_qtychange pq where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active = true and pq.archive = false and pq.store_id = $2), 0)
                - coalesce((select sum(l.qty) from disposal_pass_line l inner join disposal_pass dp on dp.id = l.pass_id where l.item_id = pii.id and dp.status = 'APPROVED' and dp.store_id = $2), 0)) as available
       from purchase_invoice_item pii
       inner join purchase_invoice i on i.id = pii.invoice_id and i.status = 'COMPLETE' and i.active and not i.archive
       inner join product p on p.id = pii.product_id
      where pii.product_id = any($1::int[]) and pii.active and not pii.archive
      group by pii.product_id`, [productIds, storeId, ownSaleId]);
  return new Map<number, number>(rows.map((r: any) => [+r.product_id, Number(r.available)]));
}

/**
 * Goods that arrived for a customer are held for them: another bill cannot sell what is left over after the held units. The bill that collects the commitment
 * is exempt. Checked when a bill is completed, next to the stock check.
 */
export async function assertNotHeldForOthers(manager: EntityManager, storeId: number | null, lines: { productid?: number; qty: number }[], collectingCommitmentId: number | null, ownSaleId: number) {
  const wanted = new Map<number, number>();
  for (const l of lines) if (l.productid && Number(l.qty) > 0) wanted.set(+l.productid, (wanted.get(+l.productid) || 0) + Number(l.qty));
  if (!wanted.size || !storeId) return;
  const held = await heldByProduct(manager, storeId, [...wanted.keys()], collectingCommitmentId);
  if (!held.size) return;
  const free = await freeByProduct(manager, storeId, [...held.keys()], ownSaleId);
  for (const [pid, hold] of held) {
    const have = free.get(pid) ?? 0;
    const want = wanted.get(pid) ?? 0;
    if (want > have - hold) {
      const [p] = await manager.query(`select title from product where id = $1`, [pid]);
      throw new BadRequestException(`${p?.title ?? 'This product'}: ${hold} unit${hold === 1 ? ' is' : 's are'} held for customers who ordered it, so only ${Math.max(0, have - hold)} can be sold now.`);
    }
  }
}

// ------------------------------------------------------------------------------------------------------ the bill that collects a commitment

/**
 * A bill may collect a commitment and use its advance as a payment type: only the customer's own, at the store of the bill, once something has arrived,
 * and never more than is held or more than the bill. Returns what to merge into the sale.
 */
export async function checkCommitmentTender(manager: EntityManager, sale: any, customer: any, saleId?: number | null) {
  if (sale?.commitmentid === undefined) return {};                          // the request does not say: whatever the bill already carries stays
  const id = Number(sale?.commitmentid || 0);
  if (!id) return { commitmentid: null, commitmentamt: 0 };
  if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return { commitmentid: id, commitmentamt: money(Number(sale?.commitmentamt || 0)) };
  const [c] = await manager.query(`select id, status, customer_id, store_id from customer_commitment where id = $1`, [id]);
  if (!c) throw new BadRequestException('That customer commitment was not found.');
  const customerId = Number(customer?.id ?? sale?.customerid ?? 0);
  if (!customerId || +c.customer_id !== customerId) throw new BadRequestException('That commitment belongs to another customer. Choose the customer it was taken for.');
  const storeId = Number(sale?.storeid || 0);
  if (storeId && +c.store_id !== storeId) throw new BadRequestException('That commitment was taken at another store.');
  const [already] = saleId ? await manager.query(`select sale_id from customer_commitment where id = $1 and sale_id = $2`, [id, saleId]) : [null];
  if (c.status !== 'READY' && !already) throw new BadRequestException(c.status === 'COLLECTED' ? 'That commitment was already collected.' : c.status === 'CANCELLED' ? 'That commitment was cancelled.' : 'Nothing has arrived for that commitment yet.');
  const amount = money(Number(sale?.commitmentamt || 0));
  if (amount < 0) throw new BadRequestException('The advance used cannot be negative.');
  if (Number(sale?.staffcreditamt || 0) > 0) throw new BadRequestException('A bill on staff credit cannot also use a customer advance.');
  if (amount > money(Number(sale?.total || 0)) + 0.005) throw new BadRequestException('The advance used is more than the bill.');
  const [mine] = saleId ? await manager.query(`select amount::float as a from customer_commitment_payment where sale_id = $1 and kind = 'APPLIED'`, [saleId]) : [null];
  const held = money((await commitmentBalance(manager, id)) + (mine ? -Number(mine.a) : 0));
  if (amount > held + 0.005) throw new BadRequestException(`Only ${held.toFixed(2)} is held for that commitment; this bill uses ${amount.toFixed(2)}.`);
  return { commitmentid: id, commitmentamt: amount };
}

/** the completed bill uses the advance and collects the commitment, once */
export async function recordCommitmentTender(tm: EntityManager, saved: any, byUserId: number) {
  const id = Number(saved?.commitmentid || 0);
  if (!saved?.id || !id || String(saved.status || '').toUpperCase() !== 'COMPLETE') return;
  const [c] = await tm.query(`select id, status, sale_id, store_id from customer_commitment where id = $1 for update`, [id]);
  if (!c) throw new BadRequestException('That customer commitment was not found.');
  if (c.status === 'COLLECTED' && +c.sale_id === +saved.id) return;                       // this bill already collected it
  if (c.status !== 'READY') throw new BadRequestException('That commitment can no longer be collected.');
  const amount = money(Number(saved.commitmentamt || 0));
  if (amount > 0) {
    const held = await commitmentBalance(tm, id);
    if (amount > held + 0.005) throw new BadRequestException(`Only ${held.toFixed(2)} is held for that commitment; this bill uses ${amount.toFixed(2)}.`);
    await tm.query(
      `insert into customer_commitment_payment (commitment_id, kind, amount, sale_id, store_id, note, created_by) values ($1, 'APPLIED', $2, $3, $4, $5, $6)`,
      [id, -amount, saved.id, saved.storeid ?? c.store_id ?? null, `Bill ${saved.billno ?? saved.id}`, byUserId]);
  }
  await tm.query(`update customer_commitment set status = 'COLLECTED', sale_id = $2, updated_by = $3, updated_on = now() where id = $1`, [id, saved.id, byUserId]);
}

/** a voided bill gives the advance back to the commitment and puts it back to ready */
export async function reverseCommitmentTender(tx: EntityManager, sale: { id: number; commitment_id?: number | null; store_id?: number | null; bill_no?: any }, byUserId: number) {
  const id = Number(sale?.commitment_id || 0);
  if (!id) return;
  const [c] = await tx.query(`select id, status, sale_id from customer_commitment where id = $1 for update`, [id]);
  if (!c || +c.sale_id !== +sale.id) return;
  const [applied] = await tx.query(`select amount::float as a from customer_commitment_payment where sale_id = $1 and kind = 'APPLIED'`, [sale.id]);
  if (applied) {
    await tx.query(
      `insert into customer_commitment_payment (commitment_id, kind, amount, store_id, sale_id, note, created_by) values ($1, 'REVERSAL', $2, $3, null, $4, $5)`,
      [id, -Number(applied.a), sale.store_id ?? null, `Void bill ${sale.bill_no || sale.id}`, byUserId]);
    // the applied row keeps the bill id (one bill, one use); the reversal is a separate row so the history shows both
  }
  await tx.query(`update customer_commitment set status = 'READY', sale_id = null, updated_by = $2, updated_on = now() where id = $1`, [id, byUserId]);
}

/** whether received goods are still held on a day (re-exported so callers need one import) */
export { stillHeld };
