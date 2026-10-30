/**
 * A read-only look at the prices a business already has, for one who is moving in with priced products: how far below the MRP they sit, which
 * are above the legal ceiling or below cost, and which way of pricing (at the MRP, a discount off it, or smart groups) fits them best.
 * Nothing is changed by this; the owner reads it, and chooses.
 */
import { PricingMode } from './pricing-mode';

export interface CheckLine { discountPct: number | null; markupPct: number | null; action: string; packsuspect?: boolean }

export interface Band { key: string; label: string; count: number }

export interface Recommendation { mode: PricingMode; discountPct?: number; maxDiscountPct?: number; reason: string }

export interface PriceCheck {
  products: number;
  bands: Band[];
  atMrp: number;
  aboveCeiling: number;
  belowCost: number;
  suspect: number;
  recommendation: Recommendation;
}

const r1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
/** a price within half a percent of the MRP counts as at the MRP (GST rounding moves it by a paisa or two) */
const AT_MRP = 0.5;

const BANDS: { key: string; label: string; from: number; to: number }[] = [
  { key: 'mrp', label: 'At the MRP', from: -AT_MRP, to: AT_MRP },
  { key: 'd5', label: 'Up to 5% off the MRP', from: AT_MRP, to: 5 },
  { key: 'd10', label: '5 to 10% off', from: 5, to: 10 },
  { key: 'd15', label: '10 to 15% off', from: 10, to: 15 },
  { key: 'd25', label: '15 to 25% off', from: 15, to: 25 },
  { key: 'd99', label: 'More than 25% off', from: 25, to: 1000 },
];

/** the value below which the given share of the numbers fall (nearest rank) */
function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

export function analysePrices(lines: CheckLine[]): PriceCheck {
  const judged = lines.filter((l) => l.discountPct !== null && Number.isFinite(l.discountPct));
  const counts: { [k: string]: number } = {};
  let aboveCeiling = 0;
  for (const l of judged) {
    const d = l.discountPct as number;
    if (d < -AT_MRP) { aboveCeiling++; continue; }
    const band = BANDS.find((b) => d >= b.from && d < b.to) ?? BANDS[BANDS.length - 1];
    counts[band.key] = (counts[band.key] || 0) + 1;
  }
  const bands = BANDS.map((b) => ({ key: b.key, label: b.label, count: counts[b.key] || 0 }));
  const atMrp = counts.mrp || 0;
  const belowCost = lines.filter((l) => l.markupPct !== null && (l.markupPct as number) < 0).length;
  const suspect = lines.filter((l) => l.packsuspect).length;

  return { products: lines.length, bands, atMrp, aboveCeiling, belowCost, suspect, recommendation: recommend(judged, atMrp) };
}

function recommend(judged: CheckLine[], atMrp: number): Recommendation {
  const n = judged.length;
  if (n < 10) return { mode: 'SMART', reason: 'There are too few priced products to tell how you price. Smart groups keep your prices as they are and only flag what looks wrong.' };
  // the products that are at the MRP or a little under it (not above the ceiling): the ones a simple rule can describe
  const usable = judged.map((l) => l.discountPct as number).filter((d) => d >= -AT_MRP).sort((a, b) => a - b);
  if (atMrp / n >= 0.7) {
    return { mode: 'MRP', reason: `${atMrp} of your ${n} priced products (${Math.round((atMrp / n) * 100)}%) are sold at the MRP, so a plain "sell at the MRP" rule fits you.` };
  }
  const inRange = usable.filter((d) => d <= 30).length;
  if (inRange / n >= 0.6) {
    const middle = r1(percentile(usable.filter((d) => d <= 30), 0.5));
    const deepest = Math.min(40, Math.ceil(percentile(usable.filter((d) => d <= 30), 0.9) / 5) * 5);
    const usual = Math.min(deepest, Math.round(middle));
    return {
      mode: 'DISCOUNT', discountPct: usual, maxDiscountPct: Math.max(deepest, usual),
      reason: `Most of your prices sit 0 to 30% below the MRP; the middle is about ${middle}% off and nine in ten are within ${Math.max(deepest, usual)}%, so a usual discount of ${usual}% with ${Math.max(deepest, usual)}% as the deepest fits you.`,
    };
  }
  return { mode: 'SMART', reason: 'Your prices are spread too widely for one simple rule. Smart groups let each kind of product have its own limits.' };
}
