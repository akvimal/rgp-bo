/**
 * A customer must never be charged more than the MRP (GST included). A bill line's unit price excludes GST and the bill adds the line's
 * GST, so the amount charged per unit is `price x (1 + GST%)`; it must not exceed the batch's MRP per unit (MRP per pack / pack size).
 * The till lowers such a price itself; this is the server's safety net for a stale client or another caller.
 */
export interface BilledLine { itemid: number; price: number; taxpcnt: number; qty: number }
export interface BatchMrp { unitMrp: number; title: string }
export interface OverMrp { itemid: number; title: string; billed: number; mrp: number; ceiling: number }

const TOLERANCE = 0.005;   // half a paisa a unit: the price is kept to two decimals

/** The highest unit price (without GST) whose billed amount stays within the MRP. */
export function unitCeiling(unitMrp: number, taxpcnt: number): number {
  return Math.floor((unitMrp / (1 + (taxpcnt || 0) / 100)) * 100 + 1e-6) / 100;
}

export function overMrp(lines: BilledLine[], batches: Map<number, BatchMrp>): OverMrp[] {
  const out: OverMrp[] = [];
  for (const l of lines) {
    if (!(l.qty > 0) || !(l.price > 0)) continue;
    const b = batches.get(Number(l.itemid));
    if (!b || !(b.unitMrp > 0)) continue;
    const billed = l.price * (1 + (l.taxpcnt || 0) / 100);
    if (billed > b.unitMrp + TOLERANCE) {
      out.push({ itemid: l.itemid, title: b.title, billed: Math.round(billed * 100) / 100, mrp: Math.round(b.unitMrp * 100) / 100, ceiling: unitCeiling(b.unitMrp, l.taxpcnt) });
    }
  }
  return out;
}

export function overMrpMessage(items: OverMrp[]): string {
  const shown = items.slice(0, 3).map((i) => `${i.title} (charged ${i.billed} per unit with GST, MRP ${i.mrp}; the price can be at most ${i.ceiling} before GST)`).join('; ');
  return `A bill cannot charge more than the MRP: ${shown}${items.length > 3 ? ` and ${items.length - 3} more` : ''}. Lower the price, or ask a manager to correct the price list.`;
}
