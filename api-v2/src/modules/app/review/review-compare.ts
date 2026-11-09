/**
 * Comparing a week fairly. The first ten days of a month are the peak in a pharmacy, so a week is not set beside the week before: it is set
 * beside what is usual for the same days of the month, and behaviour is judged by rates (per bill, per item, per rupee) rather than counts.
 * Pure, so it is tested without a database.
 */
import { addDays } from './review-rules';

export type Phase = 'peak' | 'mid' | 'tail';
/** the peak is days 1 to PEAK_END of the month, the middle runs to MID_END, the tail is the rest */
export const PEAK_END = 10;
export const MID_END = 20;
/** the months before a day that make up "usual" */
export const USUAL_MONTHS = 3;
/** a month counts towards "usual" only if bills were made on at least this many different days */
export const MIN_ACTIVE_DAYS = 15;
/** and at least this many such months are needed */
export const MIN_USUAL_MONTHS = 2;
/** a rate is above (or below) usual when it is this many times the usual rate or more, and differs by at least MIN_EXTRA events */
export const RATE_TOLERANCE = 1.25;
export const MIN_EXTRA = 3;
/** sales or bills are higher (or lower) than usual when this far from it */
export const VOLUME_TOLERANCE = 0.15;
/** a month to date of this many days or fewer is not compared: the month before, in full, is shown instead */
export const MTD_MIN_DAYS = 3;

export const phaseOf = (day: string): Phase => {
  const d = Number(day.slice(8, 10));
  return d <= PEAK_END ? 'peak' : d <= MID_END ? 'mid' : 'tail';
};

/** what one day (or a sum of days) added up to */
export interface Raw {
  bills: number; sales: number; disc: number; discBills: number; lines: number;
  below: number; voids: number; edits: number; returns: number; returnValue: number;
  /** step 3: cost of what was sold (on lines whose purchase cost is known) and what those lines sold for, both before GST */
  cost: number; costedSales: number;
  /** billed items of generic products, bills with a named customer, customers whose first bill was that day */
  genericLines: number; named: number; newCust: number;
  /** requests and inquiries raised, and those that could not be met (outcome "not available") */
  inquiries: number; unmet: number;
}
export interface Daily extends Raw { day: string }

const RAW_KEYS: (keyof Raw)[] = ['bills', 'sales', 'disc', 'discBills', 'lines', 'below', 'voids', 'edits', 'returns', 'returnValue',
  'cost', 'costedSales', 'genericLines', 'named', 'newCust', 'inquiries', 'unmet'];
export const zeroRaw = (): Raw => ({
  bills: 0, sales: 0, disc: 0, discBills: 0, lines: 0, below: 0, voids: 0, edits: 0, returns: 0, returnValue: 0,
  cost: 0, costedSales: 0, genericLines: 0, named: 0, newCust: 0, inquiries: 0, unmet: 0,
});
export const addRaw = (a: Raw, b: Raw): Raw => { const o = zeroRaw(); for (const k of RAW_KEYS) o[k] = a[k] + b[k]; return o; };
const scaleRaw = (a: Raw, f: number): Raw => { const o = zeroRaw(); for (const k of RAW_KEYS) o[k] = a[k] * f; return o; };
export const roundRaw = (a: Raw): Raw => { const o = zeroRaw(); for (const k of RAW_KEYS) o[k] = Math.round(a[k] * 100) / 100; return o; };

const monthOf = (day: string) => day.slice(0, 7);
const daysIn = (month: string) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
const dd = (n: number) => String(n).padStart(2, '0');
export const firstOfMonth = (month: string) => `${month}-01`;
/** the n calendar months before a month ('2026-11' -> ['2026-10', '2026-09', '2026-08']) */
export const monthsBefore = (month: string, n: number): string[] => {
  let y = +month.slice(0, 4), m = +month.slice(5, 7);
  const out: string[] = [];
  for (let i = 0; i < n; i++) { m -= 1; if (m === 0) { m = 12; y -= 1; } out.push(`${y}-${dd(m)}`); }
  return out;
};
const phaseDays = (month: string, p: Phase) => (p === 'peak' ? PEAK_END : p === 'mid' ? MID_END - PEAK_END : daysIn(month) - MID_END);

const index = (daily: Daily[]) => { const m = new Map<string, Daily>(); for (const d of daily) m.set(d.day, d); return m; };
const sumDays = (map: Map<string, Daily>, from: string, to: string): Raw => {
  let out = zeroRaw();
  for (let d = from; d <= to; d = addDays(d, 1)) { const r = map.get(d); if (r) out = addRaw(out, r); }
  return out;
};

/** a as a percentage of b, one decimal; null when b is nothing */
const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
/** a per 100 of b, two decimals */
const per100 = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 10000) / 100 : null);

export interface Rates {
  discountPct: number | null; belowPer100Lines: number | null; voidsPer100Bills: number | null;
  editsPer100Bills: number | null; returnsPer100Bills: number | null; returnValuePct: number | null; avgBill: number | null;
  marginPct: number | null; genericPct: number | null; namedPct: number | null; newCustPer100Bills: number | null; unmetPer100Bills: number | null;
}
export const ratesOf = (r: Raw): Rates => ({
  discountPct: pct(r.disc, r.sales + r.disc),
  belowPer100Lines: per100(r.below, r.lines),
  voidsPer100Bills: per100(r.voids, r.bills),
  editsPer100Bills: per100(r.edits, r.bills),
  returnsPer100Bills: per100(r.returns, r.bills),
  returnValuePct: pct(r.returnValue, r.sales),
  avgBill: r.bills > 0 ? Math.round((r.sales / r.bills) * 100) / 100 : null,
  marginPct: pct(r.costedSales - r.cost, r.costedSales),
  genericPct: pct(r.genericLines, r.lines),
  namedPct: pct(r.named, r.bills),
  newCustPer100Bills: per100(r.newCust, r.bills),
  unmetPer100Bills: per100(r.unmet, r.bills),
});

/**
 * What a day of a given phase usually adds up to: the average over the same phase in the months before it. Only months with bills on enough
 * different days count. Null when there are not enough such months.
 */
const usualDay = (map: Map<string, Daily>, month: string, phase: Phase): { perDay: Raw; months: string[] } | null => {
  const months: string[] = [];
  let total = zeroRaw(); let days = 0;
  for (const m of monthsBefore(month, USUAL_MONTHS)) {
    let active = 0;
    for (let d = 1; d <= daysIn(m); d++) { const r = map.get(`${m}-${dd(d)}`); if (r && r.bills > 0) active++; }
    if (active < MIN_ACTIVE_DAYS) continue;
    months.push(m);
    const lo = phase === 'peak' ? 1 : phase === 'mid' ? PEAK_END + 1 : MID_END + 1;
    const hi = phase === 'peak' ? PEAK_END : phase === 'mid' ? MID_END : daysIn(m);
    total = addRaw(total, sumDays(map, `${m}-${dd(lo)}`, `${m}-${dd(hi)}`));
    days += phaseDays(m, phase);
  }
  return months.length >= MIN_USUAL_MONTHS && days > 0 ? { perDay: scaleRaw(total, 1 / days), months } : null;
};

/** the days of a week, each with its phase, and how many of each */
export const phasesOf = (days: string[]) => {
  const mix: Record<Phase, number> = { peak: 0, mid: 0, tail: 0 };
  const list = days.map((day) => { const phase = phaseOf(day); mix[phase]++; return { day, phase }; });
  return { days: list, mix };
};

/** what the days of a week would usually add up to, or null (with the reason) when the history is too thin */
export const usualWeek = (days: string[], daily: Daily[]): { raw: Raw; months: string[] } | { raw: null; reason: string } => {
  const map = index(daily);
  let raw = zeroRaw(); const months = new Set<string>();
  for (const day of days) {
    const u = usualDay(map, monthOf(day), phaseOf(day));
    if (!u) return { raw: null, reason: `Needs at least ${MIN_USUAL_MONTHS} earlier months with bills on ${MIN_ACTIVE_DAYS} or more days each.` };
    raw = addRaw(raw, u.perDay); u.months.forEach((m) => months.add(m));
  }
  return { raw: roundRaw(raw), months: [...months].sort() };
};

export type Verdict = 'above' | 'usual' | 'below' | 'unknown';

/** a rate against the usual rate: only a clear difference, backed by more than a few events, counts */
export const judgeRate = (rate: number | null, usual: number | null, count: number, usualCount: number): Verdict => {
  if (rate === null || usual === null) return 'unknown';
  const extra = count - usualCount;
  if (rate > usual * RATE_TOLERANCE && extra >= MIN_EXTRA) return 'above';
  if (rate < usual / RATE_TOLERANCE && -extra >= MIN_EXTRA) return 'below';
  return 'usual';
};

/** bills or sales against usual */
export const judgeVolume = (actual: number, usual: number | null): Verdict => {
  if (usual === null || usual <= 0) return 'unknown';
  const r = actual / usual;
  return r >= 1 + VOLUME_TOLERANCE ? 'above' : r <= 1 - VOLUME_TOLERANCE ? 'below' : 'usual';
};

export interface Verdicts {
  bills: Verdict; sales: Verdict; discount: Verdict; below: Verdict; voids: Verdict; edits: Verdict; returns: Verdict;
  margin: Verdict; generic: Verdict; unmet: Verdict;
}
/** margin and the generic share are percentages: a difference of this many points or more is worth a word */
export const MARGIN_POINTS = 3;
export const GENERIC_POINTS = 5;
/** a share against the usual share, in percentage points; no verdict without something to compare */
export const judgePoints = (now: number | null, usual: number | null, points: number): Verdict => {
  if (now === null || usual === null) return 'unknown';
  return now >= usual + points ? 'above' : now <= usual - points ? 'below' : 'usual';
};

export const verdictsOf = (actual: Raw, usual: Raw | null): Verdicts => {
  if (!usual) return { bills: 'unknown', sales: 'unknown', discount: 'unknown', below: 'unknown', voids: 'unknown', edits: 'unknown', returns: 'unknown', margin: 'unknown', generic: 'unknown', unmet: 'unknown' };
  const a = ratesOf(actual), u = ratesOf(usual);
  return {
    bills: judgeVolume(actual.bills, usual.bills), sales: judgeVolume(actual.sales, usual.sales),
    discount: judgeRate(a.discountPct, u.discountPct, actual.discBills, usual.discBills),
    below: judgeRate(a.belowPer100Lines, u.belowPer100Lines, actual.below, usual.below),
    voids: judgeRate(a.voidsPer100Bills, u.voidsPer100Bills, actual.voids, usual.voids),
    edits: judgeRate(a.editsPer100Bills, u.editsPer100Bills, actual.edits, usual.edits),
    returns: judgeRate(a.returnsPer100Bills, u.returnsPer100Bills, actual.returns, usual.returns),
    margin: judgePoints(a.marginPct, u.marginPct, MARGIN_POINTS),
    generic: judgePoints(a.genericPct, u.genericPct, GENERIC_POINTS),
    unmet: judgeRate(a.unmetPer100Bills, u.unmetPer100Bills, actual.unmet, usual.unmet),
  };
};

/**
 * Month to date against the same dates last month. The end is the week's last day, or today when the week is still running; last month's range
 * ends on the same day of the month (or its last day when that month is shorter).
 */
export const mtdRanges = (weekEnd: string, today: string) => {
  let end = weekEnd < today ? weekEnd : today;
  // a week that ends in the first days of a month belongs to the month before: compare that whole month rather than one or two days of the new one
  if (Number(end.slice(8, 10)) <= MTD_MIN_DAYS) end = addDays(firstOfMonth(monthOf(end)), -1);
  const month = monthOf(end);
  const prev = monthsBefore(month, 1)[0];
  const dom = Number(end.slice(8, 10));
  return { from: firstOfMonth(month), to: end, prevFrom: firstOfMonth(prev), prevTo: `${prev}-${dd(Math.min(dom, daysIn(prev)))}` };
};

export const mtdCompare = (daily: Daily[], weekEnd: string, today: string) => {
  const r = mtdRanges(weekEnd, today);
  const map = index(daily);
  const current = sumDays(map, r.from, r.to), previous = sumDays(map, r.prevFrom, r.prevTo);
  return { ...r, current: roundRaw(current), previous: roundRaw(previous), currentRates: ratesOf(current), previousRates: ratesOf(previous) };
};

/** the days of a week, Monday first */
export const weekDays = (start: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/** the first day of history a week needs: the first of the earliest month that can count as usual */
export const historyFrom = (start: string): string => firstOfMonth(monthsBefore(monthOf(start), USUAL_MONTHS)[USUAL_MONTHS - 1]);

/* ------------------------------------------------------------------------------------------------------------------------------------------
 * Step 2: the same week a year ago, and each person against the others.
 * ------------------------------------------------------------------------------------------------------------------------------------------ */

/** a year ago is 52 weeks back, so the days of the week line up (a Monday is set beside a Monday) */
export const YEAR_DAYS = 364;
export const yearAgo = (day: string): string => addDays(day, -YEAR_DAYS);

/**
 * The week, and the month to date, beside the same dates 52 weeks earlier. Only volume and the basket are compared: a festival that moved
 * between years changes the week, so no verdict is given, just the figures. `daily` must cover the year-ago dates.
 */
export const yearCompare = (daily: Daily[], weekStart: string, mtd: { from: string; to: string }) => {
  const map = index(daily);
  const range = (from: string, to: string) => ({ from, to, raw: roundRaw(sumDays(map, from, to)), rates: ratesOf(sumDays(map, from, to)) });
  const week = range(yearAgo(weekStart), yearAgo(addDays(weekStart, 6)));
  const month = range(yearAgo(mtd.from), yearAgo(mtd.to));
  return { available: week.raw.bills > 0, week, mtd: month };
};

/** the days of history needed to look back a year: from the earliest of the week and the month to date, to the end of the week */
export const yearFrom = (weekStart: string, mtdFrom: string): string => yearAgo(weekStart < mtdFrom ? weekStart : mtdFrom);

/** how a person's figures are set against everyone else's */
export const PEER_TOLERANCE = 1.5;
/** a person needs this many bills (and the others together too) to be compared */
export const MIN_PEER_BILLS = 20;

export interface Person extends Raw { userid: number; name: string }
export interface PeerVerdicts { discount: Verdict; below: Verdict; voids: Verdict; edits: Verdict; returns: Verdict }
export interface PersonView extends Person { rates: Rates; peerRates: Rates | null; verdicts: PeerVerdicts }

/** above the others only when the rate is well over theirs and there are several more cases than their rate would give for this person's volume */
const judgePeer = (rate: number | null, peer: number | null, count: number, expected: number): Verdict => {
  if (rate === null || peer === null) return 'unknown';
  return rate > peer * PEER_TOLERANCE && count - expected >= MIN_EXTRA ? 'above' : 'usual';
};

/**
 * Each person's rates beside the rates of everyone else in the same week: a rate is marked "above" only when it is well over what the rest of the
 * team does, which does not depend on the part of the month. People with few bills, or no one else with enough, get no verdict.
 */
export const comparePeople = (people: Person[]): PersonView[] => {
  const total = people.reduce((a, p) => addRaw(a, p), zeroRaw());
  const none: PeerVerdicts = { discount: 'unknown', below: 'unknown', voids: 'unknown', edits: 'unknown', returns: 'unknown' };
  return people.map((p) => {
    const others = zeroRaw();
    for (const k of RAW_KEYS) others[k] = total[k] - p[k];
    const rates = ratesOf(p), peerRates = ratesOf(others);
    if (p.bills < MIN_PEER_BILLS || others.bills < MIN_PEER_BILLS) return { ...p, rates, peerRates: others.bills > 0 ? peerRates : null, verdicts: none };
    const exp = (othersCount: number, base: number, mine: number) => (base > 0 ? (othersCount / base) * mine : 0);
    return {
      ...p, rates, peerRates,
      verdicts: {
        discount: judgePeer(rates.discountPct, peerRates.discountPct, p.discBills, exp(others.discBills, others.bills, p.bills)),
        below: judgePeer(rates.belowPer100Lines, peerRates.belowPer100Lines, p.below, exp(others.below, others.lines, p.lines)),
        voids: judgePeer(rates.voidsPer100Bills, peerRates.voidsPer100Bills, p.voids, exp(others.voids, others.bills, p.bills)),
        edits: judgePeer(rates.editsPer100Bills, peerRates.editsPer100Bills, p.edits, exp(others.edits, others.bills, p.bills)),
        returns: judgePeer(rates.returnsPer100Bills, peerRates.returnsPer100Bills, p.returns, exp(others.returns, others.bills, p.bills)),
      },
    };
  }).sort((a, b) => b.sales - a.sales || b.bills - a.bills);
};
