/**
 * Store health (RECOGNITION_AND_COMPLIANCE 10, implementation plan stage 6): seven checks, each a score from 0 to 100 worked out from facts the
 * system already holds, combined by the business's weights. Pure: no framework, no database, relative imports only, so it is tested without either.
 *
 * A check with no data (no target set, no deliveries) is left out and the other weights are scaled up, so a business is never marked down for
 * something it does not use. Safeguard: one check under `holdBelow` keeps the whole at Watch however high the total is (it cannot be switched off).
 */

export type CheckKey = 'sales' | 'stock' | 'cash' | 'purchasing' | 'customers' | 'compliance' | 'service';
export const CHECKS: { key: CheckKey; label: string; weightKey: string }[] = [
  { key: 'sales', label: 'Sales against target', weightKey: 'w_sales' },
  { key: 'stock', label: 'Stock', weightKey: 'w_stock' },
  { key: 'cash', label: 'Cash and shifts', weightKey: 'w_cash' },
  { key: 'purchasing', label: 'Purchasing and payables', weightKey: 'w_purchasing' },
  { key: 'customers', label: 'Customers', weightKey: 'w_customers' },
  { key: 'compliance', label: 'Compliance', weightKey: 'w_compliance' },
  { key: 'service', label: 'Service and deliveries', weightKey: 'w_service' },
];

export type HealthStatus = 'healthy' | 'watch' | 'act';

export interface HealthResult {
  score: number | null;
  status: HealthStatus | null;
  /** true when the total alone would have been Healthy but a single weak check keeps it at Watch */
  held: boolean;
  checks: { key: CheckKey; label: string; score: number | null; weight: number }[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const pct = (n: number) => Math.round(clamp(n));

/** month-to-date sales against the share of the target that should be reached by now (day d of n) */
export function salesScore(actual: number, target: number | null, dayOfMonth: number, daysInMonth: number): number | null {
  if (!target || target <= 0) return null;
  const expected = target * (Math.max(1, dayOfMonth) / Math.max(1, daysInMonth));
  return pct((actual / expected) * 100);
}

export type SalesBasis = 'target or recent average' | 'target' | 'last month' | 'same period last year' | 'recent average' | 'off';
export const SALES_BASES: SalesBasis[] = ['target or recent average', 'target', 'last month', 'same period last year', 'recent average', 'off'];
export type BasisSource = 'target' | 'last month' | 'same period last year' | 'recent average';

export interface BasisFigures {
  /** the month's target, when one is set */
  target: number | null;
  day: number;
  daysInMonth: number;
  /** sales of the same days of last month, and of the same days a year ago */
  lastMonthSoFar: number;
  lastYearSoFar: number;
  /** the average of the sales of a whole month over the recent complete months; null when there is no complete month yet */
  recentMonthlyAvg: number | null;
}

/**
 * What the sales of the month so far are judged against, and where that came from. A business with no target still gets a sales signal from its own
 * history: "target or recent average" uses the target when there is one and its recent months otherwise. Null (nothing to judge) when the chosen
 * basis has no figure, or the basis is off.
 */
export function expectedSales(basis: string, f: BasisFigures): { expected: number | null; source: BasisSource | null } {
  const share = Math.max(1, f.day) / Math.max(1, f.daysInMonth);
  const target = f.target && f.target > 0 ? { expected: f.target * share, source: 'target' as BasisSource } : null;
  const recent = f.recentMonthlyAvg && f.recentMonthlyAvg > 0 ? { expected: f.recentMonthlyAvg * share, source: 'recent average' as BasisSource } : null;
  const none = { expected: null, source: null };
  switch (basis) {
    case 'target': return target ?? none;
    case 'recent average': return recent ?? none;
    case 'last month': return f.lastMonthSoFar > 0 ? { expected: f.lastMonthSoFar, source: 'last month' } : none;
    case 'same period last year': return f.lastYearSoFar > 0 ? { expected: f.lastYearSoFar, source: 'same period last year' } : none;
    case 'off': return none;
    default: return target ?? recent ?? none;
  }
}

/** sales so far against what they were expected to be by now; null when there is nothing to compare */
export function salesScoreVs(actual: number, expected: number | null): number | null {
  return expected && expected > 0 ? pct((actual / expected) * 100) : null;
}

/** a target to suggest: the same month a year ago (or, with no history for it, the recent monthly average) plus the chosen growth, to the nearest hundred */
export function suggestedTarget(lastYearMonth: number, recentMonthlyAvg: number | null, growthPct: number): { value: number | null; basis: 'same month last year' | 'recent average' | null } {
  const g = 1 + (Number.isFinite(growthPct) ? growthPct : 0) / 100;
  const round = (n: number) => Math.max(0, Math.round((n * g) / 100) * 100);
  if (lastYearMonth > 0) return { value: round(lastYearMonth), basis: 'same month last year' };
  if (recentMonthlyAvg && recentMonthlyAvg > 0) return { value: round(recentMonthlyAvg), basis: 'recent average' };
  return { value: null, basis: null };
}

/** share of the products that carry a minimum that are at or above it; no such products: nothing to judge */
export function stockScore(withMinimum: number, atOrAbove: number): number | null {
  return withMinimum > 0 ? pct((atOrAbove / withMinimum) * 100) : null;
}

/** every shift left open from an earlier day takes 25 points off */
export function cashScore(staleOpenShifts: number): number {
  return pct(100 - 25 * Math.max(0, staleOpenShifts));
}

/** the share of the money owed that is not yet overdue; nothing owed is a full score */
export function purchasingScore(owed: number, overdue: number): number {
  return owed > 0 ? pct(100 - (overdue / owed) * 100) : 100;
}

/** the share of bills carrying a mobile number against the business's own aim; no bills: nothing to judge */
export function customersScore(bills: number, withMobile: number, aimPct: number): number | null {
  if (bills <= 0) return null;
  return pct((((withMobile / bills) * 100) / Math.max(1, aimPct)) * 100);
}

/** late items cost 10 points each, escalated items 25 */
export function complianceScore(late: number, escalated: number): number {
  return pct(100 - 10 * Math.max(0, late) - 25 * Math.max(0, escalated));
}

/** the share of the deliveries of the period that were delivered rather than failed or left pending; none booked: nothing to judge */
export function serviceScore(booked: number, delivered: number): number | null {
  return booked > 0 ? pct((delivered / booked) * 100) : null;
}

export interface HealthSettings {
  weights: Partial<Record<CheckKey, number>>;
  healthyMin: number;
  holdBelow: number;
}

export function combine(scores: Partial<Record<CheckKey, number | null>>, s: HealthSettings): HealthResult {
  const rows = CHECKS.map((c) => ({ key: c.key, label: c.label, score: scores[c.key] ?? null, weight: Math.max(0, Number(s.weights[c.key]) || 0) }));
  const live = rows.filter((r) => r.score !== null && r.weight > 0);
  const total = live.reduce((a, r) => a + r.weight, 0);
  if (!total) return { score: null, status: null, held: false, checks: rows };
  const score = Math.round(live.reduce((a, r) => a + (r.score as number) * r.weight, 0) / total);
  const weakest = Math.min(...live.map((r) => r.score as number));
  let status: HealthStatus;
  let held = false;
  if (score < s.holdBelow) status = 'act';
  else if (score >= s.healthyMin && weakest >= s.holdBelow) status = 'healthy';
  else {
    status = 'watch';
    held = score >= s.healthyMin;
  }
  return { score, status, held, checks: rows };
}
