import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export interface BatchWarning {
  code: 'EARLIER_EXPIRY' | 'SHORT_DATED_FOR_SUPPLY';
  /** a stop: only a Store Head or Business Head can sell through it */
  blocking: boolean;
  itemid: number;
  title: string;
  message: string;
  suggest?: string;
}

const monthYear = (d: Date | string) => {
  const x = new Date(d);
  return `${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`;
};

const addMonths = (d: Date, n: number) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCMonth(x.getUTCMonth() + Math.ceil(n));
  return x;
};

/**
 * A month's requirement of a medicine, in units: the product's own `monthly_units`, else 30 (one a day) for a chronic
 * medicine, else none. A line that buys more than this is a long supply. Mirrors the till's frontend sales/supply-rule.ts.
 */
export const DEFAULT_MONTHLY_UNITS = 30;
export function monthlyUnits(moreProps: any): number {
  const own = Number(moreProps?.monthly_units);
  if (Number.isFinite(own) && own > 0) return own;
  return String(moreProps?.chronic) === 'true' ? DEFAULT_MONTHLY_UNITS : 0;
}

/** months of remaining shelf life a supply must have beyond what the customer is buying (Business setting, default 3) */
export async function supplyBuffer(manager: EntityManager): Promise<number> {
  const [r] = await manager.query(`select setting_value from app_setting where category = 'sales' and setting_key = 'supply_expiry_buffer_months' and active and not archive limit 1`);
  const n = Number(r?.setting_value);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : 3;
}

/**
 * Checks a completed bill's batches:
 *  - EARLIER_EXPIRY (a warning): a later-dated batch is being sold while an earlier-dated batch of the same product is
 *    still in stock at the store; the older stock should go first.
 *  - SHORT_DATED_FOR_SUPPLY (a warning): for a regular medicine the units are months of medicine (30 units a month unless the
 *    product says otherwise); the batch should still have at least the buffer (3 months) of life left once that supply is
 *    used up. It speaks only when the batch and the quantity do not fit.
 * Both run when the billing screen asks (checkbatches). Nothing is said about a bill that has neither problem. Lines are
 * matched by purchase item id (itemid).
 */
export async function findBatchWarnings(manager: EntityManager, sale: any, storeId: number | null): Promise<BatchWarning[]> {
  // Both checks are the billing screen's: they run when the screen asks (checkbatches), so scripts and integrations that post bills are not held up by them.
  const fefo = sale?.checkbatches === true;
  if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return [];
  const lines = (Array.isArray(sale?.items) ? sale.items : []).filter((i: any) => Number(i.qty) > 0 && Number(i.itemid) > 0);
  if (!lines.length) return [];

  const itemIds = Array.from(new Set(lines.map((l: any) => Number(l.itemid)))) as number[];
  const own = await manager.query(
    `select pii.id, pii.product_id, pii.batch, pii.exp_date, p.title, p.more_props from purchase_invoice_item pii join product p on p.id = pii.product_id where pii.id = any($1::int[])`, [itemIds]);
  const ownBy = new Map<number, any>(own.map((o: any) => [Number(o.id), o]));
  const productIds = Array.from(new Set(own.map((o: any) => Number(o.product_id)))) as number[];

  // every live batch of those products with what the store still holds of it
  const batches = await manager.query(
    `select pii.id, pii.product_id, pii.batch, pii.exp_date,
            (case when i.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
            - coalesce((select sum(si.qty) from sale_item si inner join sale s on s.id = si.sale_id
                         where si.purchase_item_id = pii.id and si.active = true and si.archive = false and s.store_id = $2), 0)
            + coalesce((select sum(pq.qty) from product_qtychange pq
                         where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active = true and pq.archive = false and pq.store_id = $2), 0) as available
       from purchase_invoice_item pii
       join purchase_invoice i on i.id = pii.invoice_id
       join product p on p.id = pii.product_id
      where pii.product_id = any($1::int[]) and pii.status = 'VERIFIED' and pii.active = true and pii.archive = false
        and pii.exp_date is not null and pii.exp_date >= current_date`, [productIds, storeId]);

  // what this very bill takes from each batch, so a batch it empties is not "still in stock"
  const taking = new Map<number, number>();
  for (const l of lines) taking.set(Number(l.itemid), (taking.get(Number(l.itemid)) || 0) + Number(l.qty));

  const buffer = await supplyBuffer(manager);
  const today = new Date();
  const warnings: BatchWarning[] = [];
  const seen = new Set<string>();

  for (const l of lines) {
    const o = ownBy.get(Number(l.itemid));
    if (!o?.exp_date) continue;
    const mine = new Date(o.exp_date);

    const older = batches
      .filter((b: any) => Number(b.product_id) === Number(o.product_id) && Number(b.id) !== Number(o.id) && new Date(b.exp_date) < mine
        && Number(b.available) - (taking.get(Number(b.id)) || 0) > 0)
      .sort((a: any, b: any) => +new Date(a.exp_date) - +new Date(b.exp_date))[0];
    if (fefo && older && !seen.has(`E${o.id}`)) {
      seen.add(`E${o.id}`);
      warnings.push({
        code: 'EARLIER_EXPIRY', blocking: false, itemid: Number(l.itemid), title: o.title,
        message: `${o.title}: batch ${o.batch} (expires ${monthYear(mine)}) is being sold while batch ${older.batch} (expires ${monthYear(older.exp_date)}) is still in stock. Sell the older batch first.`,
        suggest: older.batch,
      });
    }

    const monthly = monthlyUnits(o.more_props);
    if (fefo && monthly > 0) {
      const qty = Number(l.qty);
      const months = qty / monthly;
      // the supply runs out `months` months from now; the batch should have `buffer` months left after that
      const needed = new Date(addMonths(today, buffer).getTime() + months * 30 * 86400000);
      if (mine < needed && !seen.has(`S${o.id}`)) {
        seen.add(`S${o.id}`);
        const better = batches
          .filter((b: any) => Number(b.product_id) === Number(o.product_id) && new Date(b.exp_date) >= needed && Number(b.available) >= qty)
          .sort((a: any, b: any) => +new Date(a.exp_date) - +new Date(b.exp_date))[0];
        const m = Math.round(months * 10) / 10;
        warnings.push({
          code: 'SHORT_DATED_FOR_SUPPLY', blocking: false, itemid: Number(l.itemid), title: o.title,
          message: `${o.title}: ${qty} units is about ${m} month${m === 1 ? '' : 's'} of medicine, and batch ${o.batch} expires ${monthYear(mine)}, which leaves less than ${buffer} months once it is used up (it should last to ${monthYear(needed)}).`
            + (better ? ` Batch ${better.batch} (expires ${monthYear(better.exp_date)}) is long enough.` : ' No batch in stock is long enough.'),
          suggest: better?.batch,
        });
      }
    }
  }
  return warnings;
}

/**
 * Raises the 409 the billing screen shows as a confirmation. Counter staff can sell through a warning once they confirm (it is
 * audited); a blocking one, should there be one, needs a Store Head or Business Head (`canOverride`). Returns the warnings that were overridden, for the audit log.
 */
export function enforceBatchWarnings(warnings: BatchWarning[], acknowledged: boolean, isManager: boolean): BatchWarning[] {
  if (!warnings.length) return [];
  const blocked = warnings.some(w => w.blocking) && !isManager;
  if (acknowledged && !blocked) return warnings;
  throw new ConflictException({
    code: 'SALE_WARNINGS',
    message: warnings.map(w => w.message).join(' '),
    warnings,
    canOverride: !blocked,
    needsManager: blocked,
  });
}
