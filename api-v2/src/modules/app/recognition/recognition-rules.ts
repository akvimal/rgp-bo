/**
 * Recognition rules (RECOGNITION_AND_COMPLIANCE section 4): habits the data can verify, never raw sales volume or discount depth.
 * Pure: no framework, no database, relative imports only. Every measure works on a person's own facts, newest first, and returns a run or a count
 * that the engine compares with the business's threshold.
 */

export type RuleKey = 'till' | 'capture' | 'refill' | 'beat' | 'clean';

export interface RuleDef {
  key: RuleKey;
  name: string;
  /** what earns it, in the words the person reads */
  how: string;
  unit: string;
  /** the compliance-scope-free recognition setting holding the threshold, and the one switching it on */
  thresholdKey: string;
  onKey: string;
  pack?: string;
}

export const RULES: RuleDef[] = [
  { key: 'till', name: 'Accurate till', how: 'Shifts closed with a till difference under the allowed amount, in a row.', unit: 'shifts in a row', thresholdKey: 'till_streak', onKey: 'till_on' },
  { key: 'capture', name: 'Customer capture', how: 'A mobile number on most of your bills, day after day.', unit: 'days running', thresholdKey: 'capture_pct', onKey: 'capture_on' },
  { key: 'refill', name: 'Refill caller', how: 'Refill follow-up calls recorded, day after day.', unit: 'days running', thresholdKey: 'refill_days', onKey: 'refill_on', pack: 'pharmacy' },
  { key: 'beat', name: 'Beat your usual', how: 'Sales above your own usual for the weekday, on enough days of the week.', unit: 'days this week', thresholdKey: 'beat_days', onKey: 'beat_on' },
  { key: 'clean', name: 'Compliance clean', how: 'No item of your own late for a stretch of days.', unit: 'days', thresholdKey: 'clean_days', onKey: 'clean_on' },
];

export const ruleOf = (key: string): RuleDef | undefined => RULES.find((r) => r.key === key);

/** a shift closes accurately when the till difference, either way, is within this many rupees */
export const TILL_TOLERANCE = 50;
/** a day counts for capture only when there were at least this many bills */
export const CAPTURE_MIN_BILLS = 5;
/** the share of days a "beat your usual" week looks back over */
export const BEAT_WINDOW = 7;

/** consecutive shifts from the newest whose till difference is within the tolerance */
export function tillStreak(variances: (number | null)[], tolerance = TILL_TOLERANCE): number {
  let n = 0;
  for (const v of variances) {
    if (v === null || Math.abs(v) > tolerance) break;
    n++;
  }
  return n;
}

export interface CaptureDay { bills: number; withMobile: number }

/** consecutive days from the newest on which at least `pct` percent of bills carried a mobile number (days with too few bills break the run) */
export function captureRun(days: CaptureDay[], pct: number, minBills = CAPTURE_MIN_BILLS): number {
  let n = 0;
  for (const d of days) {
    if (d.bills < minBills || (d.withMobile / d.bills) * 100 < pct) break;
    n++;
  }
  return n;
}

/** consecutive days from the newest with at least one record */
export function activityRun(days: boolean[]): number {
  let n = 0;
  for (const d of days) { if (!d) break; n++; }
  return n;
}

export interface BeatDay { sales: number; usual: number | null }

/** how many of the last `window` days were above the person's own usual for that weekday (days with no usual cannot count) */
export function beatCount(days: BeatDay[], window = BEAT_WINDOW): number {
  return days.slice(0, window).filter((d) => d.usual !== null && d.usual > 0 && d.sales > d.usual).length;
}

/**
 * "Beat your usual" is paused when discounts or returns rose: the week's discount share is more than 1.5 times the person's earlier share (and at
 * least 2 points more). The badge must not reward selling by giving money away.
 */
export function discountSpike(weekPct: number, earlierPct: number | null): boolean {
  if (earlierPct === null) return false;
  return weekPct > earlierPct * 1.5 && weekPct - earlierPct >= 2;
}

/** days since the last late or escalated item of the person's own (a person with none counts from the first active day) */
export function cleanDays(lastLateOn: string | null, firstActiveOn: string | null, today: string): number {
  const from = lastLateOn ?? firstActiveOn;
  if (!from) return 0;
  const MS = 86400000;
  return Math.max(0, Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00:00Z')) / MS));
}

export interface Standing { value: number; target: number; holds: boolean }

/** what a rule says now: the run, the threshold, and whether the habit holds (so the badge is earned or stays) */
export const standing = (value: number, target: number): Standing => ({ value, target, holds: value >= target });

export interface AwardState { ruleKey: string; active: boolean }

/**
 * What to do for a rule given the standing and whether the person already holds the badge: award a new one, lapse the old one, or nothing.
 * `paused` (an own item is late) stops new awards and never takes one away.
 */
export function decide(s: Standing, holds: boolean, paused: boolean, runBroken: boolean): 'award' | 'lapse' | 'none' {
  if (holds) return runBroken && !s.holds ? 'lapse' : 'none';
  if (paused) return 'none';
  return s.holds ? 'award' : 'none';
}
