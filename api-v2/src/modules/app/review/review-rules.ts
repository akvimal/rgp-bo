/** The weekly exceptions review: which week, when it can be signed, and what is worth a second look. Pure, so it is tested without a database. */

/** a line billed this much below the list price (or more) is an exception, in percent of the list price */
export const BELOW_LIST_PCT = 0.5;
/** a bill discount this much of the bill before discount (or more) is marked for a closer look, in percent */
export const BIG_DISCOUNT_PCT = 10;
/** a return this many days after the bill (or more) is marked */
export const LATE_RETURN_DAYS = 7;
/** a bill cancelled this many hours after it was made (or more) is marked */
export const LATE_VOID_HOURS = 24;
/** the lists show at most this many rows */
export const LIST_LIMIT = 500;

const MS = 86400000;
const t = (day: string) => Date.parse(day.slice(0, 10) + 'T00:00:00Z');
export const addDays = (day: string, n: number) => new Date(t(day) + n * MS).toISOString().slice(0, 10);
export const isValidDay = (day: any): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !isNaN(t(day)) && new Date(t(day)).toISOString().slice(0, 10) === day;

/** the Monday of the week the day falls in */
export const mondayOf = (day: string): string => {
  const dow = new Date(t(day)).getUTCDay();   // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
};

export const isMonday = (day: string) => mondayOf(day) === day;

/** the week that ended before this one began: the one to review now */
export const lastFullWeek = (today: string): string => addDays(mondayOf(today), -7);

/** [start, end] with end the Sunday, and the Monday after */
export const weekRange = (start: string) => ({ start, end: addDays(start, 6), next: addDays(start, 7) });

/** a week can be signed once its Sunday is over */
export const isOver = (start: string, today: string): boolean => today >= addDays(start, 7);

/** the review is late when the week ended more than `days` days ago and is not signed */
export const reviewLate = (start: string, today: string, days: number): boolean => today >= addDays(start, 7 + days);

export const pctOff = (list: number, billed: number): number => (list > 0 ? Math.round(((list - billed) / list) * 1000) / 10 : 0);

export const billDiscountPct = (discount: number, total: number): number => {
  const before = Number(total) + Number(discount);
  return before > 0 ? Math.round((Number(discount) / before) * 1000) / 10 : 0;
};

/** counts and values of the three kinds of exception for one week, from its lists */
export interface Summary {
  bills: number; sales: number;
  discountBills: number; discountValue: number;
  belowList: number; belowListValue: number;
  voids: number; voidValue: number;
  edits: number; editReduced: number;
  returns: number; returnValue: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (rows: any[], f: (r: any) => number) => r2(rows.reduce((a, r) => a + (Number(f(r)) || 0), 0));

/** what an edit of a finished bill did: how much it took off the total, and whether it is worth a look (a lower total, more discount, lines removed) */
export const readEdit = (changes: any): { reduced: number; flagged: boolean } => {
  const c = changes || {};
  const drop = c.total ? Number(c.total.from) - Number(c.total.to) : 0;
  const reduced = drop > 0 ? r2(drop) : 0;
  const moreDiscount = c.discamount ? Number(c.discamount.to) > Number(c.discamount.from) : false;
  return { reduced, flagged: reduced > 0 || moreDiscount || (Number(c.items_removed) || 0) > 0 };
};

export const summarise = (totals: { bills: number; sales: number }, d: { discounts: any[]; below: any[]; voids: any[]; edits?: any[]; returns: any[] }): Summary => ({
  bills: totals.bills, sales: r2(totals.sales),
  discountBills: d.discounts.length, discountValue: sum(d.discounts, (r) => r.disc),
  belowList: d.below.length, belowListValue: sum(d.below, (r) => r.value),
  voids: d.voids.length, voidValue: sum(d.voids, (r) => r.total),
  edits: (d.edits ?? []).length, editReduced: sum(d.edits ?? [], (r) => r.reduced),
  returns: d.returns.length, returnValue: sum(d.returns, (r) => r.value),
});

/** how many of the exceptions are marked for a closer look */
export const marked = (d: { discounts: any[]; voids: any[]; edits?: any[]; returns: any[] }) => ({
  bigDiscounts: d.discounts.filter((r) => r.pct >= BIG_DISCOUNT_PCT).length,
  lateVoids: d.voids.filter((r) => r.hours >= LATE_VOID_HOURS).length,
  flaggedEdits: (d.edits ?? []).filter((r) => r.flagged).length,
  lateReturns: d.returns.filter((r) => r.daysafter >= LATE_RETURN_DAYS).length,
});

/** returns grouped by a key, the most frequent first */
export const groupReturns = (rows: any[], key: (r: any) => string) => {
  const m = new Map<string, { name: string; count: number; value: number }>();
  for (const r of rows) {
    const k = key(r) || '(none)';
    const g = m.get(k) ?? { name: k, count: 0, value: 0 };
    g.count += 1;
    g.value = r2(g.value + (Number(r.value) || 0));
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.value - a.value);
};
