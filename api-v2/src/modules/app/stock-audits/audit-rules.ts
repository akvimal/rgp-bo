/** Rules of the stock audit paper trail. Pure, so they are tested without a database. */

/** the audit number as printed: SA-0012, per business */
export const auditNo = (n: number): string => `SA-${String(n).padStart(4, '0')}`;

/** the financial year (April to March) a day falls in: 2026-10-24 is 2026-27 */
export const financialYear = (day: string) => {
  const y = +day.slice(0, 4), m = +day.slice(5, 7);
  const start = m >= 4 ? y : y - 1;
  return { start: `${start}-04-01`, end: `${start + 1}-03-31`, next: `${start + 1}-04-01`, label: `${start}-${String(start + 1).slice(2)}`, year: start };
};

/** the next 31 March that is not before the day */
export const nextYearEnd = (day: string): string => {
  const y = +day.slice(0, 4);
  return day <= `${y}-03-31` ? `${y}-03-31` : `${y + 1}-03-31`;
};

/** what a plan covers beyond a category: the fast movers, the scheduled drugs, the batches expired or about to */
export const WIDE_SCOPES = ['FAST', 'SCHEDULE', 'EXPIRY'] as const;
export const SCOPES = ['ALL', 'CATEGORY', 'ROTATE', ...WIDE_SCOPES];
export const SCOPE_LABEL: Record<string, string> = {
  ALL: 'Everything', CATEGORY: 'One category', ROTATE: 'Rotating categories',
  FAST: 'Fast movers', SCHEDULE: 'Scheduled drugs (H, H1, X)', EXPIRY: 'Expired and expiring batches',
};

/** the fast movers: this many products by sales value in the last 90 days */
export const FAST_MOVERS = 30;
/** a batch is "expiring" when it ends within this many days */
export const EXPIRING_DAYS = 90;

export interface PlanSeed { name: string; scope: string; categories: string[] | null; frequency_days: number; first_due: string; }

/** the plans a store should run: weekly fast movers and category rotation, monthly scheduled drugs and expiry sweep, a full count at year end */
export const standardPlans = (categories: string[], today: string): PlanSeed[] => {
  const plans: PlanSeed[] = [
    { name: 'Fast movers (weekly)', scope: 'FAST', categories: null, frequency_days: 7, first_due: today },
  ];
  if (categories.length >= 2) plans.push({ name: 'Category rotation (weekly)', scope: 'ROTATE', categories, frequency_days: 7, first_due: today });
  plans.push(
    { name: 'Scheduled drugs H, H1, X (monthly)', scope: 'SCHEDULE', categories: null, frequency_days: 30, first_due: today },
    { name: 'Expiry sweep (monthly)', scope: 'EXPIRY', categories: null, frequency_days: 30, first_due: today },
    { name: 'Full count (yearly)', scope: 'ALL', categories: null, frequency_days: 365, first_due: nextYearEnd(today) },
  );
  return plans;
};

/** a difference found in a scheduled-drug audit is always for the Business Head, whatever it is worth */
export const escalateAll = (scope: string | null | undefined): boolean => scope === 'SCHEDULE';

/**
 * Two signers: the person who counted and the person who verifies and approves must be different logins. A one-person shop (the Owner-operator)
 * counts and signs alone, and the certificate says so.
 */
export const mayCertify = (counterId: number | null, certifierId: number, certifierRole: string | null | undefined): { ok: boolean; alone: boolean } => {
  if (counterId === null || counterId !== certifierId) return { ok: true, alone: false };
  return certifierRole === 'Owner-operator' ? { ok: true, alone: true } : { ok: false, alone: false };
};

/** what the count is measured against: what should be on the shelf when counting finished (the book at the start, less sold, plus other movements) */
export const expectedOf = (l: { book_qty: number; expected_qty?: number | null }): number => l.expected_qty ?? l.book_qty;

/**
 * What should be on the shelf when counting finished: the book at the start, less what was sold since, plus returns, transfers in and approved
 * adjustments (minus those out) since.
 */
export const expectedQty = (book: number, sold: number, movedOther: number): number => book - sold + movedOther;

/** share of lines whose count matched the book, in percent */
export const matchRate = (lines: { book_qty: number; expected_qty?: number | null; counted_qty: number | null }[]): number => {
  const counted = lines.filter((l) => l.counted_qty !== null);
  if (!counted.length) return 0;
  return Math.round((counted.filter((l) => l.counted_qty === expectedOf(l)).length / counted.length) * 1000) / 10;
};

/** the units and value (at cost) short and in excess across the lines; a recount replaces the first count */
export const variance = (lines: { book_qty: number; expected_qty?: number | null; counted_qty: number | null; recount_qty?: number | null; unit_cost: number | null }[]) => {
  let shortUnits = 0, excessUnits = 0, shortValue = 0, excessValue = 0;
  for (const l of lines) {
    if (l.counted_qty === null) continue;
    const final = l.recount_qty ?? l.counted_qty;
    const d = final - expectedOf(l), v = d * (Number(l.unit_cost) || 0);
    if (d < 0) { shortUnits += -d; shortValue += -v; } else if (d > 0) { excessUnits += d; excessValue += v; }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { shortUnits, excessUnits, shortValue: r(shortValue), excessValue: r(excessValue), netUnits: excessUnits - shortUnits, netValue: r(excessValue - shortValue) };
};

/** a large difference may be approved only after a second count by someone other than the first counter */
export const recountProblem = (line: { escalated: boolean; recount_qty: number | null }): string | null =>
  line.escalated && line.recount_qty === null ? 'This is a large difference. Have another person count it again first.' : null;
