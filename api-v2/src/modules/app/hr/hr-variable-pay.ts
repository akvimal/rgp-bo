/** Incentive cap and bonus rules, pure so they can be tested without a database. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export const BONUS_KINDS = ['FESTIVAL', 'PERFORMANCE', 'REFERRAL', 'OTHER'] as const;
export const BONUS_BASES = ['FIXED', 'BASIC_PCT', 'GROSS_PCT'] as const;
export type BonusBasis = (typeof BONUS_BASES)[number];

/** The KPI incentive after the monthly maximum. No cap (null) leaves it as the band gave it. */
export function capIncentive(raw: number, cap: number | null | undefined): { amount: number; capped: boolean } {
  const amount = r2(Math.max(0, raw));
  if (cap === null || cap === undefined || !Number.isFinite(Number(cap))) return { amount, capped: false };
  const c = r2(Math.max(0, Number(cap)));
  return amount > c ? { amount: c, capped: true } : { amount, capped: false };
}

/** A person's cap: their own, else their job role's, else none. */
export function effectiveCap(own: number | null | undefined, role: number | null | undefined): number | null {
  if (own !== null && own !== undefined) return Number(own);
  if (role !== null && role !== undefined) return Number(role);
  return null;
}

/** What a bonus comes to for one person. `basic` and `gross` are the full-month salary in force. */
export function bonusAmount(basis: BonusBasis, value: number, basic: number, gross: number): number {
  if (basis === 'FIXED') return r2(value);
  if (basis === 'BASIC_PCT') return r2(basic * value / 100);
  return r2(gross * value / 100);
}

/** Whole months from `from` (YYYY-MM-DD) to `to` (YYYY-MM-DD); a part month does not count. */
export function monthsBetween(from: string, to: string): number {
  const fy = Number(from.slice(0, 4)), fm = Number(from.slice(5, 7)), fd = Number(from.slice(8, 10));
  const ty = Number(to.slice(0, 4)), tm = Number(to.slice(5, 7)), td = Number(to.slice(8, 10));
  let m = (ty - fy) * 12 + (tm - fm);
  if (td < fd) m -= 1;
  return Math.max(0, m);
}

/** Why someone gets no bonus in `period`, or null when they do: left before the month, or not served long enough by its last day. */
export function bonusSkipReason(joinDate: string, exitDate: string | null, period: string, minMonths: number): string | null {
  const dim = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)).getUTCDate();
  const start = `${period}-01`, end = `${period}-${String(dim).padStart(2, '0')}`;
  if (joinDate > end) return 'joins after that month';
  if (exitDate && exitDate < start) return 'left before that month';
  const served = monthsBetween(joinDate, end);
  if (minMonths > 0 && served < minMonths) return `served ${served} month${served === 1 ? '' : 's'}, needs ${minMonths}`;
  return null;
}
