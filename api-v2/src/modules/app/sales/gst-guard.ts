/**
 * A completed bill must charge the GST in force on the day, whatever batch the goods came from: the rate is a fact about the product and the date
 * (GST > Rate changes), not about the purchase invoice the stock arrived on. The till works the rate out from the server; this is the check that a
 * bill coming in still carries it (a held bill reopened, a screen left open across a change of rate, an old client).
 */
export interface BilledGst { itemid: number; taxpcnt: number; qty: number }
export interface CurrentGst { title: string; rate: number }
export interface StaleGst { itemid: number; title: string; sent: number; current: number }

const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** the lines whose rate is not the one in force today (lines with no quantity, and lines the server has no rate for, are left alone) */
export function staleGst(lines: BilledGst[], current: Map<number, CurrentGst>): StaleGst[] {
  const out: StaleGst[] = [];
  const seen = new Set<number>();
  for (const l of lines) {
    if (!(Number(l.qty) > 0) || seen.has(l.itemid)) continue;
    const c = current.get(Number(l.itemid));
    if (!c || !Number.isFinite(c.rate)) continue;
    const sent = Number(l.taxpcnt || 0);
    if (!same(sent, c.rate)) { seen.add(l.itemid); out.push({ itemid: Number(l.itemid), title: c.title, sent, current: c.rate }); }
  }
  return out;
}

export function staleGstMessage(stale: StaleGst[]): string {
  const shown = stale.slice(0, 3).map((s) => `${s.title} (${s.sent}% on the bill, ${s.current}% today)`).join(', ');
  return `The GST rate has changed for ${stale.length} item${stale.length === 1 ? '' : 's'}: ${shown}${stale.length > 3 ? ', ...' : ''}. The bill has been updated to today's rate: check the total and complete it again.`;
}
