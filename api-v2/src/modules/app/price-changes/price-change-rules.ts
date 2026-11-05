/**
 * The staff sheet of price changes, with no database. Prices are stored per pack BEFORE GST; the sheet shows what the customer pays (GST included, and
 * never above the MRP), so a change reads the way it is said at the counter.
 */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** the price with the GST the till bills, the MRP itself when the price is the most the MRP allows (the same rule the price dialog uses) */
export function withGst(ex: number, saleTax: number, mrp?: number | null): number {
  const t = Number(saleTax) || 0;
  if (mrp && mrp > 0) {
    const ceiling = Math.floor((mrp / (1 + t / 100)) * 100 + 1e-6) / 100;
    if (Math.abs(ex - ceiling) < 0.005) return r2(mrp);
  }
  return r2(ex * (1 + t / 100));
}

const REASONS: Record<string, string> = {
  'Initial': 'First price', 'Higher PTR': 'Cost rise', 'MRP change': 'MRP change', 'Market': 'Market', 'Market Pressure': 'Market',
  'Policy': 'Pricing policy', 'Purchase': 'At purchase', 'Correction': 'Correction', 'Other': 'Other', 'PRICE_REVISED': 'Price revised',
};
export const reasonLabel = (r: any): string => (r ? (REASONS[String(r)] ?? String(r)) : '');

export interface ChangeRow { product_id: number; title: string; pack: any; price: number; prev_price: number; eff: string; reason: string | null; mrp: number | null; sale_tax: number; id?: number }
export interface Change {
  productid: number; title: string; pack: any; oldprice: number; newprice: number; change: number; pct: number; effdate: string; reason: string; reasonlabel: string; mrp: number | null; changes: number;
}

/**
 * One line per product from its price rows in the period (oldest first): the price it had before the first change, the price it has now,
 * and the reason of the last change. A price that went up and came back, or whose shown price did not move, is not a change to tell anyone about.
 */
export function buildChanges(rows: ChangeRow[], minPct = 0): { increased: Change[]; decreased: Change[] } {
  const byProduct = new Map<number, ChangeRow[]>();
  for (const r of rows) {
    const list = byProduct.get(r.product_id) ?? [];
    list.push(r);
    byProduct.set(r.product_id, list);
  }
  const out: Change[] = [];
  for (const list of byProduct.values()) {
    const first = list[0], last = list[list.length - 1];
    const oldW = withGst(Number(first.prev_price), last.sale_tax, last.mrp);
    const newW = withGst(Number(last.price), last.sale_tax, last.mrp);
    const change = r2(newW - oldW);
    if (Math.abs(change) < 0.005 || oldW <= 0) continue;
    const pct = Math.round((change / oldW) * 1000) / 10;
    if (Math.abs(pct) < minPct) continue;
    out.push({
      productid: last.product_id, title: last.title, pack: last.pack, oldprice: oldW, newprice: newW, change, pct, effdate: last.eff,
      reason: last.reason ?? '', reasonlabel: reasonLabel(last.reason), mrp: last.mrp, changes: list.length,
    });
  }
  return {
    decreased: out.filter((c) => c.change < 0).sort((a, b) => a.pct - b.pct || a.title.localeCompare(b.title)),
    increased: out.filter((c) => c.change > 0).sort((a, b) => b.pct - a.pct || a.title.localeCompare(b.title)),
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const istToday = (now: Date = new Date()) => new Date(now.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

/** the period asked for: the last 14 days by default, no longer than a year, and never backwards */
export function cleanPeriod(from: any, to: any, today = istToday()): { from: string; to: string } {
  const end = DAY.test(String(to ?? '')) ? String(to) : today;
  let start = DAY.test(String(from ?? '')) ? String(from) : addDays(end, -14);
  if (start > end) throw new Error('The first day is after the last day.');
  if (Date.parse(end) - Date.parse(start) > 366 * 86400000) throw new Error('Choose a period of a year or less.');
  return { from: start, to: end };
}
