import { priceBeforeGst } from './pricing-mode';

export type BulkMode = 'MRP' | 'PCT_OFF';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The price (before GST, as stored) a bulk update gives one product: the MRP itself, or the MRP less `pct` percent. Both are what the customer pays with
 * GST, so they are taken back to a price before GST, and never above the legal ceiling (the MRP less GST). Null when the product has no usable MRP or
 * the percentage is not between 0 and 100.
 */
export function bulkTarget(mode: BulkMode, pct: number | null | undefined, mrp: number | null | undefined, tax: number | null | undefined): number | null {
  const m = Number(mrp);
  if (!(m > 0)) return null;
  const t = Number(tax) || 0;
  if (mode === 'MRP') return priceBeforeGst(m, t, m);
  const p = Number(pct);
  if (!(p > 0) || !(p < 100)) return null;
  const price = priceBeforeGst(r2(m * (1 - p / 100)), t, m);
  return price > 0 ? price : null;
}
