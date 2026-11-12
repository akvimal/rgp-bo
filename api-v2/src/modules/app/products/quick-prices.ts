import { priceBeforeGst, priceWithGst } from './pricing-mode';

/**
 * The quick price pick: a ladder of discounts off the MRP in steps (5, 10, 15 ... percent) with the price each gives, so a price can be chosen
 * in one click. A step whose price would go below the lowest the class allows is marked not allowed, and a last "deepest allowed" choice gives that
 * lowest price itself, which is rarely a round step. Picking only fills the price box: typing a lower price by hand is still the person's call.
 * Prices are kept before GST; `shown` is what the person sees (with GST when the business prices that way). The same function is in the frontend
 * (secured/products/quick-price.ts); this is the copy that is tested.
 */
export interface QuickRung { pct: number; price: number; shown: number; allowed: boolean }
export interface QuickLadder { rungs: QuickRung[]; deepest: { pct: number; price: number; shown: number } | null }

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function quickPrices(i: { mrp: number; tax: number; lower: number | null; step: number; max: number; basis: 'incl' | 'excl' }): QuickLadder {
  const { mrp, tax, lower, basis } = i;
  if (!(mrp > 0) || !(i.step > 0)) return { rungs: [], deepest: null };
  const ceiling = Math.floor((mrp / (1 + tax / 100)) * 100 + 1e-6) / 100;
  const show = (ex: number) => (basis === 'incl' ? priceWithGst(ex, tax, mrp) : ex);
  const rungs: QuickRung[] = [];
  for (let k = 0; k <= Math.max(1, i.max); k++) {
    const pct = r2(k * i.step);
    if (pct >= 100) break;
    const price = priceBeforeGst(r2(mrp * (1 - pct / 100)), tax, mrp);
    rungs.push({ pct, price, shown: show(price), allowed: lower === null || price >= lower - 0.005 });
  }
  let deepest: QuickLadder['deepest'] = null;
  if (lower !== null && lower > 0 && lower < ceiling - 0.005 && !rungs.some((r) => r.allowed && Math.abs(r.price - lower) < 0.005)) {
    const shownLower = priceWithGst(lower, tax, mrp);
    deepest = { pct: Math.round((1 - shownLower / mrp) * 1000) / 10, price: lower, shown: show(lower) };
  }
  return { rungs, deepest };
}
