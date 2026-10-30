/**
 * Price policy. A sale price is per pack and excludes GST (the bill adds GST on top); the MRP includes GST; cost is the net rate per
 * pack without GST (after trade discount and free quantity). Every product belongs to a class from two things:
 *   - trade margin band: how far the cost is below the MRP (LOW under 30%, MID 30 to 70%, HIGH 70% and over);
 *   - profit rank: A (the products earning the first 70% of profit), B (the next 20%), C (the rest).
 * A class has a floor markup (the lowest markup on cost) and a discount cap (the most off MRP). A price must sit between the
 * lower bound those two give and the legal ceiling (MRP less GST). Customers must not see sudden rises, so a raise is stepped.
 */
export type Band = 'LOW' | 'MID' | 'HIGH';
export type Abc = 'A' | 'B' | 'C';
export type Violation = 'OVER_MRP' | 'BELOW_FLOOR' | 'OVER_CAP' | 'RAISE_TOO_BIG' | 'RAISE_TOO_SOON';
export type Level = 'STORE' | 'BUSINESS';

export interface PolicySettings {
  stepPricePct: number;       // a raise is at most this percent of the current price ...
  stepMrpPct: number;         // ... and at most this percent of the (GST-free) MRP, whichever is smaller
  stepDays: number;           // one raise per product in this many days
  storeHeadLimitPct: number;  // a Store Head may approve a change up to this percent; more needs the Business Head
}
export const DEFAULT_SETTINGS: PolicySettings = { stepPricePct: 10, stepMrpPct: 5, stepDays: 14, storeHeadLimitPct: 15 };

export interface ClassPolicy { floorMarkupPct: number; maxDiscountPct: number; usualDiscountPct?: number }

export const classKey = (band: Band, abc: Abc) => `${band}_${abc}`;

export function tradeBand(tradeMargin: number | null): Band {
  if (tradeMargin === null || !Number.isFinite(tradeMargin) || tradeMargin < 0.30) return 'LOW';
  return tradeMargin < 0.70 ? 'MID' : 'HIGH';
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;
const ceil2 = (n: number) => Math.ceil(n * 100 - 1e-6) / 100;
const EPS = 0.005;

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000);
}

export interface Subject {
  price: number | null;        // current sale price per pack, ex GST
  cost: number;                // net cost per pack, ex GST
  mrp: number;                 // MRP per pack, GST included
  tax: number;                 // GST percent
  abc: Abc;
  lastChange: string | null;   // YYYY-MM-DD the current price took effect
  today: string;               // YYYY-MM-DD
}

export interface Bounds { ceiling: number; floorP: number; capP: number; lower: number; conflict: boolean }

export function boundsOf(s: Subject, p: ClassPolicy): Bounds {
  const ceiling = floor2(s.mrp / (1 + s.tax / 100));
  const floorP = ceil2(s.cost * (1 + p.floorMarkupPct / 100));
  // no discount allowed means the MRP itself: rounding up here would put the lowest price a paisa above the ceiling
  const capP = p.maxDiscountPct <= 0 ? ceiling : ceil2((s.mrp * (1 - p.maxDiscountPct / 100)) / (1 + s.tax / 100));
  const lower = Math.max(floorP, capP);
  return { ceiling, floorP, capP, lower, conflict: lower > ceiling + EPS };
}

/** The largest single raise: a tenth of the price or 5 points of the MRP, whichever is smaller (at least a paisa). */
export function stepLimit(price: number, ceiling: number, st: PolicySettings): number {
  return Math.max(0.01, r2(Math.min((price * st.stepPricePct) / 100, (ceiling * st.stepMrpPct) / 100)));
}

export type Action = 'OK' | 'CUT' | 'RAISE' | 'NO_PRICE' | 'CHECK_COST';
export interface Evaluation {
  action: Action;
  violations: Violation[];
  bounds: Bounds;
  markupPct: number | null;
  discountPct: number | null;
  target: number | null;        // where the price should end up
  next: number | null;          // this step's price (a cut goes straight to the target)
  waitUntil: string | null;     // a raise is held until this date
  level: Level | null;          // who must approve applying it
}

export function evaluate(s: Subject, p: ClassPolicy, st: PolicySettings): Evaluation {
  const b = boundsOf(s, p);
  const base = { bounds: b, violations: [] as Violation[], target: null, next: null, waitUntil: null, level: null as Level | null };
  if (!(s.price && s.price > 0)) return { ...base, action: 'NO_PRICE', markupPct: null, discountPct: null };
  const price = s.price;
  const markupPct = s.cost > 0 ? r2((price / s.cost - 1) * 100) : null;
  const discountPct = s.mrp > 0 ? r2((1 - (price * (1 + s.tax / 100)) / s.mrp) * 100) : null;
  if (b.conflict) return { ...base, action: 'CHECK_COST', markupPct, discountPct };

  if (price > b.ceiling + EPS) {
    return { ...base, action: 'CUT', violations: ['OVER_MRP'], markupPct, discountPct, target: b.ceiling, next: b.ceiling, level: 'STORE' };
  }
  const violations: Violation[] = [];
  if (price < b.floorP - EPS) violations.push('BELOW_FLOOR');
  if (price < b.capP - EPS) violations.push('OVER_CAP');
  if (!violations.length) return { ...base, action: 'OK', markupPct, discountPct };

  const target = b.lower;
  const next = r2(Math.min(target, price + stepLimit(price, b.ceiling, st)));
  const waitUntil = s.lastChange && daysBetween(s.lastChange, s.today) < st.stepDays ? addDays(s.lastChange, st.stepDays) : null;
  return { action: 'RAISE', violations, bounds: b, markupPct, discountPct, target, next, waitUntil, level: s.abc === 'A' ? 'BUSINESS' : 'STORE' };
}

/**
 * A price change someone proposes (not the system's own step). Returns what it breaks and who has to approve it:
 * a price that ends below the floor or over the discount cap, or a raise that is too big or too soon. A raise that moves a price
 * that is already out of bounds towards the bound does not add a bounds violation (it is only held to the step rule).
 */
export function checkChange(s: Subject, p: ClassPolicy, st: PolicySettings, newPrice: number): { violations: Violation[]; level: Level | null; changePct: number | null } {
  const b = boundsOf(s, p);
  const cur = s.price && s.price > 0 ? s.price : null;
  const violations: Violation[] = [];
  if (!b.conflict && (cur === null || newPrice <= cur + EPS)) {
    if (newPrice < b.floorP - EPS) violations.push('BELOW_FLOOR');
    if (newPrice < b.capP - EPS) violations.push('OVER_CAP');
  }
  if (cur !== null && newPrice > cur + EPS) {
    if (newPrice - cur > stepLimit(cur, b.ceiling, st) + EPS) violations.push('RAISE_TOO_BIG');
    if (s.lastChange && daysBetween(s.lastChange, s.today) < st.stepDays) violations.push('RAISE_TOO_SOON');
  }
  const changePct = cur !== null ? r2(Math.abs(newPrice / cur - 1) * 100) : null;
  if (!violations.length) return { violations, level: null, changePct };
  const bounds = violations.includes('BELOW_FLOOR') || violations.includes('OVER_CAP');
  const level: Level = s.abc === 'A' || bounds || (changePct !== null && changePct > st.storeHeadLimitPct) ? 'BUSINESS' : 'STORE';
  return { violations, level, changePct };
}

export const rank = (l: Level | null) => (l === 'BUSINESS' ? 2 : l === 'STORE' ? 1 : 0);

export const VIOLATION_TEXT: Record<Violation, string> = {
  OVER_MRP: 'the bill would charge more than the MRP',
  BELOW_FLOOR: 'the markup would be below the class floor',
  OVER_CAP: 'the discount would be deeper than the class cap',
  RAISE_TOO_BIG: 'the raise is bigger than one step',
  RAISE_TOO_SOON: 'the price was changed too recently for another raise',
};

export interface Suggestion { price: number; discountPct: number; markupPct: number }

/**
 * A first price for a product that has none: the class's usual discount off the MRP, kept between the class's lowest price and the legal
 * ceiling. Null when the cost is above what the MRP allows (the cost or pack size needs checking first).
 */
export function suggestPrice(s: Subject, p: ClassPolicy): Suggestion | null {
  if (!(s.cost > 0) || !(s.mrp > 0)) return null;
  const b = boundsOf(s, p);
  if (b.conflict) return null;
  const usual = p.usualDiscountPct ?? 0;
  const wanted = (s.mrp * (1 - usual / 100)) / (1 + s.tax / 100);
  const price = r2(Math.min(b.ceiling, Math.max(b.lower, wanted)));
  return {
    price,
    discountPct: r2((1 - (price * (1 + s.tax / 100)) / s.mrp) * 100),
    markupPct: r2((price / s.cost - 1) * 100),
  };
}

export type LineStatus = 'NO_PRICE' | 'ABOVE_CEILING' | 'BELOW_FLOOR' | 'OVER_CAP' | 'CHECK_COST' | 'OK';

/**
 * What a purchase line's cost and MRP mean for the product's current sale price, as the receiver sees it: no price yet, a price that would
 * charge above the MRP of this batch, one below the class floor markup, one deeper than the discount cap, or fine.
 */
export function lineImpact(s: Subject, p: ClassPolicy, st: PolicySettings): { status: LineStatus; markupPct: number | null; discountPct: number | null; ceiling: number; lower: number; suggestion: Suggestion | null } {
  const e = evaluate(s, p, st);
  const base = { ceiling: e.bounds.ceiling, lower: e.bounds.lower, markupPct: e.markupPct, discountPct: e.discountPct };
  if (e.action === 'NO_PRICE') return { ...base, status: e.bounds.conflict ? 'CHECK_COST' : 'NO_PRICE', suggestion: suggestPrice(s, p) };
  if (e.action === 'CHECK_COST') return { ...base, status: 'CHECK_COST', suggestion: null };
  if (e.action === 'CUT') return { ...base, status: 'ABOVE_CEILING', suggestion: null };
  if (e.action === 'RAISE') return { ...base, status: e.violations.includes('BELOW_FLOOR') ? 'BELOW_FLOOR' : 'OVER_CAP', suggestion: null };
  return { ...base, status: 'OK', suggestion: null };
}
