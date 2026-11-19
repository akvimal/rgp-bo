/**
 * When a customer's supply of one medicine runs out (docs/planning/REFILL_CRM_DASHBOARD.md, step 4). Pure rules, no framework and no database.
 *
 * A sale line counts units (tablets, not strips), so what a customer bought tells how long it lasts. Two sources, the customer's own pattern first:
 *   - own pattern: from the customer's earlier purchases of that medicine, how many days each unit lasted them (the days to the next purchase, divided by
 *     the units bought); the median of at least two such intervals. It carries a dose of half a tablet, or a bigger pack bought less often, without anyone
 *     typing a dose.
 *   - the product's default: "days one unit lasts" set on the product (attribute `supplyDays`), for a customer with one purchase or an erratic pattern.
 * Run-out = the last purchase day + units bought then x days per unit. Without either source there is no estimate and the caller keeps the visit-gap one.
 */
export interface Purchase { day: number; qty: number }
export type SupplyBasis = 'own' | 'product';
export interface RunOut { basis: SupplyBasis; daysPerUnit: number; supplyDays: number; lastDay: number; lastQty: number; expectedDay: number }

/** an interval shorter than this is a top-up, longer than this a break in the treatment: neither says how long a supply lasts */
export const MIN_INTERVAL_DAYS = 5;
export const MAX_INTERVAL_DAYS = 180;
export const MIN_INTERVALS = 2;
/** a supply is taken to last at least this long and at most a year */
export const MIN_SUPPLY_DAYS = 3;
export const MAX_SUPPLY_DAYS = 365;

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** the product's "days one unit lasts" as typed on the product: a positive number up to a year, else nothing */
export function parseSupplyDays(raw: unknown): number | null {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= MAX_SUPPLY_DAYS ? n : null;
}

/** one line per day: purchases on the same day add up */
export function byDay(purchases: Purchase[]): Purchase[] {
  const m = new Map<number, number>();
  for (const p of purchases) if (p.qty > 0) m.set(p.day, (m.get(p.day) || 0) + p.qty);
  return [...m.entries()].map(([day, qty]) => ({ day, qty })).sort((a, b) => a.day - b.day);
}

/** the customer's own days per unit, and from how many intervals it was worked out (null until there are enough) */
export function ownDaysPerUnit(purchases: Purchase[]): { rate: number | null; intervals: number } {
  const ps = byDay(purchases);
  const ratios: number[] = [];
  for (let i = 0; i + 1 < ps.length; i++) {
    const gap = ps[i + 1].day - ps[i].day;
    if (gap >= MIN_INTERVAL_DAYS && gap <= MAX_INTERVAL_DAYS) ratios.push(gap / ps[i].qty);
  }
  return { rate: ratios.length >= MIN_INTERVALS ? median(ratios) : null, intervals: ratios.length };
}

/** when the last purchase runs out, or null when neither the customer's pattern nor a product default says */
export function runOut(purchases: Purchase[], productDays: number | null): RunOut | null {
  const ps = byDay(purchases);
  if (!ps.length) return null;
  const last = ps[ps.length - 1];
  const own = ownDaysPerUnit(ps);
  const basis: SupplyBasis | null = own.rate ? 'own' : productDays ? 'product' : null;
  if (!basis) return null;
  const daysPerUnit = (own.rate || productDays) as number;
  const supplyDays = Math.min(MAX_SUPPLY_DAYS, Math.max(MIN_SUPPLY_DAYS, Math.round(last.qty * daysPerUnit)));
  return { basis, daysPerUnit, supplyDays, lastDay: last.day, lastQty: last.qty, expectedDay: last.day + supplyDays };
}

export type Bucket = 'UPCOMING' | 'OVERDUE' | 'LAPSED';
/** the same buckets the list has always had: more than 45 days past due is lapsed, past due is overdue, else upcoming */
export const bucketOf = (daysOver: number): Bucket => (daysOver > 45 ? 'LAPSED' : daysOver > 0 ? 'OVERDUE' : 'UPCOMING');

/** a medicine's stock for the reminder: nothing on the shelf, only short-dated stock, or fine */
export type StockState = 'none' | 'short' | 'ok';
export const SHORT_DATED_DAYS = 60;
export function stockState(total: number, beyondShortDated: number): StockState {
  if (!(total > 0)) return 'none';
  return beyondShortDated > 0 ? 'ok' : 'short';
}

export interface MedicineDue {
  product_id: number; title: string; last_day: number; qty: number; expected_day: number; days_per_unit: number; supply_days: number; basis: SupplyBasis;
}

/**
 * What the medicine-level estimates say about a customer. `meds` are the estimates of each chronic medicine they buy (those with neither source are left out).
 * The customer is next due when the earliest of them runs out; null when there is no estimate at all, and the visit-gap estimate stands.
 */
export function earliestDue(meds: MedicineDue[]): { expectedDay: number; due: MedicineDue[] } | null {
  if (!meds.length) return null;
  const first = Math.min(...meds.map((m) => m.expected_day));
  // the medicines that run out together (within a week of the first) are one call, and named together
  return { expectedDay: first, due: meds.filter((m) => m.expected_day <= first + 7).sort((a, b) => a.expected_day - b.expected_day) };
}
