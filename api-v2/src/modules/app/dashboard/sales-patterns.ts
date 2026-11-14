/**
 * Sales patterns (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 3): by hour of day, weekday, day of month and month of year.
 * Pure: relative imports only. Every figure is an average per trading day (a day with at least one bill), never a total, so months with five Sundays
 * or stores that opened late do not mislead; each bar carries how many days stand behind it.
 */

export interface DayRow { d: string; bills: number; value: number }
export interface HourRow { h: number; bills: number; value: number }

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** fewer days than this behind a bar and it is drawn as thin (the screen greys it out) */
export const THIN_DAYS = 4;

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const dowOf = (d: string) => (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const index = (v: number, base: number) => (base > 0 ? r0((v / base) * 100) : 0);
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

export interface Patterns {
  basis: { from: string; to: string; tradingDays: number; windowDays: number; monthsUsed: number };
  hour: { h: number; label: string; bills: number; value: number; avgBills: number; avgValue: number; share: number }[];
  weekday: { dow: number; label: string; days: number; avgValue: number; avgBills: number; index: number; thin: boolean }[];
  dom: { day: number; days: number; avgValue: number; index: number; thin: boolean }[];
  month: { m: number; label: string; months: number; avgValue: number; index: number; thin: boolean }[];
  months: { ym: string; value: number }[];
  notes: string[];
}

/**
 * `days`: one row per calendar day with sales over up to 36 months (any order); `hours`: the same bills grouped by hour over the last `windowDays`.
 * Today is left out (it is not finished). The first month of trading is left out of the month-of-year figures unless it is a whole month.
 */
export function patterns(days: DayRow[], hours: HourRow[], today: string, windowDays = 365): Patterns {
  const from = addDays(today, -windowDays);
  const done = days.filter((x) => x.d < today && x.bills > 0).sort((a, b) => (a.d < b.d ? -1 : 1));
  const recent = done.filter((x) => x.d >= from);
  const trading = recent.length;
  const avgDay = mean(recent.map((x) => x.value));

  const totalHourValue = hours.reduce((a, x) => a + x.value, 0);
  const hour = Array.from({ length: 24 }, (_, h) => {
    const row = hours.find((x) => x.h === h) || { h, bills: 0, value: 0 };
    return { h, label: hourLabel(h), bills: row.bills, value: r0(row.value), avgBills: trading ? r1(row.bills / trading) : 0, avgValue: trading ? r0(row.value / trading) : 0, share: totalHourValue > 0 ? r1((row.value / totalHourValue) * 100) : 0 };
  });

  const weekday = WEEKDAYS.map((label, dow) => {
    const rows = recent.filter((x) => dowOf(x.d) === dow);
    const avg = mean(rows.map((x) => x.value));
    return { dow, label, days: rows.length, avgValue: r0(avg), avgBills: r1(mean(rows.map((x) => x.bills))), index: index(avg, avgDay), thin: rows.length < THIN_DAYS };
  });

  const dom = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const rows = recent.filter((x) => +x.d.slice(8, 10) === day);
    const avg = mean(rows.map((x) => x.value));
    return { day, days: rows.length, avgValue: r0(avg), index: index(avg, avgDay), thin: rows.length < THIN_DAYS };
  });

  // monthly totals; the running month and a part-month at the start are not complete months
  const byMonth = new Map<string, number>();
  for (const x of done) byMonth.set(x.d.slice(0, 7), (byMonth.get(x.d.slice(0, 7)) || 0) + x.value);
  const firstDay = done.length ? done[0].d : today;
  const firstMonth = firstDay.slice(0, 7);
  const thisMonth = today.slice(0, 7);
  const complete = Array.from(byMonth.keys()).sort().filter((ym) => ym < thisMonth && !(ym === firstMonth && +firstDay.slice(8, 10) > 3));
  const months = complete.map((ym) => ({ ym, value: r0(byMonth.get(ym) || 0) }));
  const avgMonth = mean(months.map((x) => x.value));
  const month = MONTHS.map((label, i) => {
    const rows = months.filter((x) => +x.ym.slice(5, 7) === i + 1);
    const avg = mean(rows.map((x) => x.value));
    return { m: i + 1, label, months: rows.length, avgValue: r0(avg), index: index(avg, avgMonth), thin: rows.length < 2 };
  });

  return {
    basis: { from, to: addDays(today, -1), tradingDays: trading, windowDays, monthsUsed: months.length },
    hour, weekday, dom, month, months,
    notes: notesFor({ hour, weekday, dom, month, trading, monthsUsed: months.length }),
  };
}

const pctText = (idx: number) => (idx >= 100 ? `${idx - 100}% above` : `${100 - idx}% below`);

/** the sentences under the charts: only what is clear enough to say (a gap under five points is not a pattern, a bar with few days is not trusted) */
export function notesFor(p: { hour: Patterns['hour']; weekday: Patterns['weekday']; dom: Patterns['dom']; month: Patterns['month']; trading: number; monthsUsed: number }): string[] {
  const out: string[] = [];
  if (p.trading < 14) return ['Not enough trading days yet to read a pattern (at least two weeks of sales are needed).'];

  // the busiest two hours in a row
  let best = { h: -1, share: 0 };
  for (let h = 0; h < 23; h++) {
    const s = p.hour[h].share + p.hour[h + 1].share;
    if (s > best.share) best = { h, share: s };
  }
  if (best.h >= 0 && best.share > 0) out.push(`Busiest hours: ${hourLabel(best.h)} to ${hourLabel(best.h + 2)} bring ${r0(best.share)}% of sales.`);

  const wd = p.weekday.filter((x) => !x.thin);
  if (wd.length >= 4) {
    const hi = wd.reduce((a, b) => (b.index > a.index ? b : a));
    const lo = wd.reduce((a, b) => (b.index < a.index ? b : a));
    const bits: string[] = [];
    if (hi.index >= 105) bits.push(`${WEEKDAYS_LONG[hi.dow]} are ${pctText(hi.index)} your average day`);
    if (lo.index <= 95) bits.push(`${WEEKDAYS_LONG[lo.dow]} ${pctText(lo.index)}`);
    if (bits.length) out.push(bits.join('; ') + '.');
  }

  const third = (a: number, b: number) => {
    const rows = p.dom.filter((x) => x.day >= a && x.day <= b && x.days >= 1);
    const days = rows.reduce((s, x) => s + x.days, 0);
    return days ? rows.reduce((s, x) => s + x.avgValue * x.days, 0) / days : 0;
  };
  const t1 = third(1, 10), t2 = third(11, 20), t3 = third(21, 31);
  const rest = mean([t2, t3].filter((x) => x > 0));
  if (t1 > 0 && rest > 0) {
    const d = r0(((t1 - rest) / rest) * 100);
    if (Math.abs(d) >= 5) out.push(`The first ten days of the month are ${Math.abs(d)}% ${d > 0 ? 'above' : 'below'} the rest of the month${d > 0 ? ' (salary and pension days)' : ''}.`);
  }

  if (p.monthsUsed >= 12) {
    const mo = p.month.filter((x) => !x.thin);
    if (mo.length >= 6) {
      const hi = mo.reduce((a, b) => (b.index > a.index ? b : a));
      const lo = mo.reduce((a, b) => (b.index < a.index ? b : a));
      if (hi.index >= 105) out.push(`${MONTHS_LONG[hi.m - 1]} is your strongest month (${hi.index} against an average month of 100)${lo.index <= 95 ? `, ${MONTHS_LONG[lo.m - 1]} the weakest (${lo.index})` : ''}.`);
    }
  } else out.push('The month-by-month season needs at least 12 complete months of sales.');
  return out;
}
