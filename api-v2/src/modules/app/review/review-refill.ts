/**
 * Refill capture for the weekly review: of the customers who were due for a chronic refill in a week, how many came back in time. Worked out from the bills
 * (which do not change), so the cohort of any past week can be rebuilt. Pure, so tested without a database. See docs/planning/WEEKLY_REVIEW_COMPARISON.md, step 5.
 */
import { judgeRate, Verdict } from './review-compare';
import { addDays } from './review-rules';

/** a customer is back "in time" when the next refill is within this many days of the expected date */
export const GRACE_DAYS = 7;
/** nothing for this long after the expected date is lapsed (the Refills list's limit) */
export const LAPSED_DAYS = 45;
/** purchases closer than this to the first day of a refill event belong to the same event: a top-up is not a refill */
export const MERGE_DAYS = 7;
/** an expectation needs this many refill events so far, and a usual gap of at most MAX_GAP days (as the Refills list) */
export const MIN_EVENTS = 3;
export const MAX_GAP = 150;
/** "usual" is pooled over this many weeks before the cohort */
export const USUAL_WEEKS = 13;
/** a follow-up call counts when made from this many days before the expected date */
export const CALL_LEAD_DAYS = 7;

export interface RVisit { customerId: number; day: string; storeId: number | null; value: number }
export interface RFollowup { customerId: number; day: string; outcome: string }
export type RStatus = 'ON_TIME' | 'LATE' | 'NOT_BACK' | 'LAPSED' | 'OPEN';
export interface Expectation {
  customerId: number; storeId: number | null; eventDay: string; expectedOn: string; usualGap: number; value: number; nextDay: string | null; status: RStatus;
}

const MS = 86400000;
const t = (d: string) => Date.parse(d.slice(0, 10) + 'T00:00:00Z');
export const daysBetween = (a: string, b: string): number => Math.round((t(b) - t(a)) / MS);

/** the middle of a list of numbers; the two middle ones averaged when even (as the Refills list's percentile_cont) */
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** one customer's purchases as refill events: those within MERGE_DAYS of an event's first day join it (their value adds up) */
export const eventsOf = (visits: RVisit[]) => {
  const sorted = [...visits].sort((a, b) => a.day.localeCompare(b.day));
  const events: { day: string; storeId: number | null; value: number }[] = [];
  for (const v of sorted) {
    const last = events[events.length - 1];
    if (last && daysBetween(last.day, v.day) < MERGE_DAYS) last.value += Number(v.value) || 0;
    else events.push({ day: v.day, storeId: v.storeId, value: Number(v.value) || 0 });
  }
  return events;
};

/** how an expectation stands on the day `asOf` */
export const statusOf = (expectedOn: string, nextDay: string | null, asOf: string): RStatus => {
  if (nextDay) return daysBetween(expectedOn, nextDay) <= GRACE_DAYS ? 'ON_TIME' : 'LATE';
  const over = daysBetween(expectedOn, asOf);
  return over <= GRACE_DAYS ? 'OPEN' : over <= LAPSED_DAYS ? 'NOT_BACK' : 'LAPSED';
};

/**
 * Every expectation in the visits: from each customer's third refill event on, the expected next refill is that event's day plus the usual gap known at the
 * time (the median of the gaps between their events up to it), and what happened next.
 */
export const expectations = (visits: RVisit[], asOf: string): Expectation[] => {
  const byCustomer = new Map<number, RVisit[]>();
  for (const v of visits) { const a = byCustomer.get(v.customerId); if (a) a.push(v); else byCustomer.set(v.customerId, [v]); }
  const out: Expectation[] = [];
  for (const [customerId, vs] of byCustomer) {
    const ev = eventsOf(vs);
    for (let i = MIN_EVENTS - 1; i < ev.length; i++) {
      const gaps: number[] = [];
      for (let k = 1; k <= i; k++) gaps.push(daysBetween(ev[k - 1].day, ev[k].day));
      const gap = median(gaps);
      if (gap > MAX_GAP) continue;
      const usualGap = Math.round(gap);
      const expectedOn = addDays(ev[i].day, usualGap);
      const nextDay = ev[i + 1]?.day ?? null;
      const value = ev.slice(0, i + 1).reduce((a, e) => a + e.value, 0) / (i + 1);
      out.push({ customerId, storeId: ev[i].storeId, eventDay: ev[i].day, expectedOn, usualGap, value: Math.round(value), nextDay, status: statusOf(expectedOn, nextDay, asOf) });
    }
  }
  return out;
};

export interface CohortSummary {
  from: string; to: string; due: number; onTime: number; late: number; notBack: number; lapsed: number; open: number;
  /** those whose grace period has passed: on time, late, not back yet and lapsed */
  decided: number; missed: number; captureRate: number | null; missRate: number | null; valueAtRisk: number;
}

const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** the customers whose expected date fell between two days (inclusive), at the stores wanted (null = all) */
export const pick = (exps: Expectation[], from: string, to: string, storeIds: number[] | null): Expectation[] =>
  exps.filter((e) => e.expectedOn >= from && e.expectedOn <= to && (!storeIds || (e.storeId !== null && storeIds.includes(e.storeId))));

export const summarise = (rows: Expectation[], from: string, to: string): CohortSummary => {
  const n = (s: RStatus) => rows.filter((e) => e.status === s).length;
  const onTime = n('ON_TIME'), late = n('LATE'), notBack = n('NOT_BACK'), lapsed = n('LAPSED'), open = n('OPEN');
  const decided = onTime + late + notBack + lapsed;
  const missed = late + notBack + lapsed;
  return {
    from, to, due: rows.length, onTime, late, notBack, lapsed, open, decided, missed,
    captureRate: pct(onTime, decided), missRate: pct(missed, decided),
    valueAtRisk: Math.round(rows.filter((e) => e.status === 'NOT_BACK' || e.status === 'LAPSED').reduce((a, e) => a + e.value, 0)),
  };
};

/** the cohort of a week, against the usual of the weeks before it, and a verdict on the share not back in time */
export const compareCohort = (cohort: CohortSummary, usual: CohortSummary): { verdict: Verdict } => {
  const expectedMissed = usual.missRate === null ? 0 : (usual.missRate / 100) * cohort.decided;
  return { verdict: judgeRate(cohort.missRate, usual.missRate, cohort.missed, expectedMissed) };
};

/**
 * Whether the calls help: among decided expectations, the share on time where a follow-up call (any outcome but no answer) was recorded between
 * CALL_LEAD_DAYS before the expected date and the return (or today), and where none was. Staff call who looks most at risk, so this is a prompt, not proof.
 */
export const callEffect = (rows: Expectation[], followups: RFollowup[], asOf: string) => {
  const calls = new Map<number, string[]>();
  for (const f of followups) { if (f.outcome === 'NO_ANSWER') continue; const a = calls.get(f.customerId); if (a) a.push(f.day); else calls.set(f.customerId, [f.day]); }
  const tally = { called: { n: 0, onTime: 0 }, notCalled: { n: 0, onTime: 0 } };
  for (const e of rows) {
    if (e.status === 'OPEN') continue;
    const from = addDays(e.expectedOn, -CALL_LEAD_DAYS), to = e.nextDay ?? asOf;
    const was = (calls.get(e.customerId) || []).some((d) => d >= from && d <= to);
    const g = was ? tally.called : tally.notCalled;
    g.n++; if (e.status === 'ON_TIME') g.onTime++;
  }
  return { called: { ...tally.called, rate: pct(tally.called.onTime, tally.called.n) }, notCalled: { ...tally.notCalled, rate: pct(tally.notCalled.onTime, tally.notCalled.n) } };
};

/** the first day of history the cohorts of a week need: two years before the start of the usual window */
export const refillHistoryFrom = (weekStart: string): string => addDays(weekStart, -7 * (USUAL_WEEKS + 1) - 730);
