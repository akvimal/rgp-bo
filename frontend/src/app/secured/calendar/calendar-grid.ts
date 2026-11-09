/** Date arithmetic for the calendar page. Days are yyyy-mm-dd strings; everything is done in UTC so a browser time zone or daylight saving cannot move a day. */
export type CalendarView = 'month' | 'week' | 'day';

export interface DayEntry { start: string; end: string; }

const toDate = (d: string) => new Date(`${d}T00:00:00Z`);
const fromDate = (d: Date) => d.toISOString().slice(0, 10);

/** today by the browser clock (the shop and its browsers are in the same place) */
export const localToday = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export const addDays = (day: string, n: number): string => { const d = toDate(day); d.setUTCDate(d.getUTCDate() + n); return fromDate(d); };

/** the Sunday on or before a day (the week starts on Sunday, as in the shop weekly off) */
export const weekStart = (day: string): string => addDays(day, -toDate(day).getUTCDay());

export const addMonths = (day: string, n: number): string => {
  const d = toDate(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last)); // 31 Jan + 1 month is 28 Feb, not 3 Mar
  return fromDate(target);
};

export const sameMonth = (a: string, b: string): boolean => a.slice(0, 7) === b.slice(0, 7);

/** the six weeks (42 days) a month is drawn in, starting on the Sunday on or before the 1st */
export function monthDays(cursor: string): string[] {
  const first = weekStart(`${cursor.slice(0, 7)}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export const weekDays = (cursor: string): string[] => { const s = weekStart(cursor); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };

/** the days a view draws, which is also the window asked of the server */
export function daysOf(view: CalendarView, cursor: string): string[] {
  return view === 'month' ? monthDays(cursor) : view === 'week' ? weekDays(cursor) : [cursor];
}

/** previous (-1) or next (+1) page of a view */
export function step(view: CalendarView, cursor: string, dir: 1 | -1): string {
  return view === 'month' ? addMonths(cursor, dir) : view === 'week' ? addDays(cursor, 7 * dir) : addDays(cursor, dir);
}

/** the entries that fall on each day (a span appears on every day it covers) */
export function groupByDay<T extends DayEntry>(entries: T[], days: string[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const d of days) out[d] = [];
  for (const e of entries) for (const d of days) if (e.start <= d && d <= e.end) out[d].push(e);
  return out;
}
