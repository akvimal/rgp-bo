/** What the calendar shows: the kinds of entry, the date window asked for, and the order they are listed in. Pure, so it is tested without a database. */
export const CALENDAR_TYPES = ['holiday', 'leave', 'todo', 'licence', 'audit', 'followup', 'attendance'] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

/** one thing on the calendar; start and end are yyyy-mm-dd (end is the last day, inclusive), time is hh:mm when the thing has an hour */
export interface CalendarEntry {
  id: string;
  type: CalendarType;
  title: string;
  start: string;
  end: string;
  time?: string | null;
  storeId?: number | null;
  store?: string | null;
  who?: string | null;
  /** a short extra line (a leave reason), only for those who may read it */
  note?: string | null;
  status?: string | null;
  /** the screen that owns the thing, for the click-through */
  link?: string | null;
  /** the way to colour it: ok / warn / bad / info / muted */
  tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted';
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_WINDOW_DAYS = 100;

const dayNumber = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
const validDay = (d: string) => DAY_RE.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

/** the window must be two real dates, from not after to, and short enough that one call stays cheap */
export function windowProblem(from: string, to: string): string | null {
  if (!validDay(from ?? '') || !validDay(to ?? '')) return 'Give the first and last day as yyyy-mm-dd.';
  if (to < from) return 'The last day is before the first day.';
  if (dayNumber(to) - dayNumber(from) + 1 > MAX_WINDOW_DAYS) return `Ask for at most ${MAX_WINDOW_DAYS} days at a time.`;
  return null;
}

/** the kinds asked for (a comma list), only the known ones; none asked means all */
export function typesAsked(raw: string | undefined | null): CalendarType[] {
  const asked = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const known = CALENDAR_TYPES.filter((t) => asked.includes(t));
  return known.length ? known : [...CALENDAR_TYPES];
}

/** clip a span to the window, so a month-long leave shows only the days inside it; null when it lies outside */
export function clipToWindow(start: string, end: string, from: string, to: string): { start: string; end: string } | null {
  if (end < from || start > to) return null;
  return { start: start < from ? from : start, end: end > to ? to : end };
}

/** what a day lists first: the shop-wide and urgent things before the routine ones (a month cell shows only the first three) */
const RANK: Record<CalendarType, number> = { holiday: 0, leave: 1, licence: 2, todo: 3, audit: 4, followup: 5, attendance: 6 };

/** by day, then those with an hour in hour order (all-day first), then by kind rank and title, so the list is the same each time */
export function sortEntries(list: CalendarEntry[]): CalendarEntry[] {
  return [...list].sort((a, b) =>
    a.start.localeCompare(b.start) || (a.time ?? '').localeCompare(b.time ?? '') || RANK[a.type] - RANK[b.type] || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
