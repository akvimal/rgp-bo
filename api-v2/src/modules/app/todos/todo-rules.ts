/**
 * The rules of the to-do list that need no database: when a repeat comes next, how overdue a to-do is, and what the person should be told.
 * Days are plain 'YYYY-MM-DD' strings in the shop's time (India), so a calendar day is never shifted by the server's time zone.
 */
export type Repeat = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY' | 'EVERY_N_DAYS_AFTER_DONE';
export const REPEATS: Repeat[] = ['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY', 'EVERY_N_DAYS_AFTER_DONE'];
export type Stage = 'none' | 'soon' | 'due' | 'overdue' | 'escalated';

export interface RepeatRule {
  repeat: Repeat;
  /** WEEKLY: weekdays, 0 = Sunday ... 6 = Saturday */
  days?: number[] | null;
  /** MONTHLY: day of the month, 0 = the last day */
  day?: number | null;
  /** EVERY_N_DAYS_AFTER_DONE: N */
  every?: number | null;
}

const IST_MS = 5.5 * 3600000;
const DAY = 86400000;
const ymdToMs = (d: string) => Date.parse(d + 'T00:00:00Z');

export const addDays = (d: string, n: number): string => new Date(ymdToMs(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string): number => Math.round((ymdToMs(to) - ymdToMs(from)) / DAY);
const weekday = (d: string): number => new Date(ymdToMs(d)).getUTCDay();
const lastDayOfMonth = (d: string): number => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate();

/** today's date in India */
export const istDay = (now: Date = new Date()): string => new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);

/** the shop's time on a day as the instant it is (for storing), e.g. ('2026-11-06', '09:00') */
export function dueInstant(day: string, at: string): Date {
  return new Date(`${day}T${/^\d{2}:\d{2}$/.test(at) ? at : '09:00'}:00+05:30`);
}

/** the day (in India) an instant falls on */
export const dayOf = (when: Date | string): string => istDay(new Date(when));

/** a problem with the repeat as asked for, in plain words; null when it is usable */
export function repeatProblem(r: RepeatRule): string | null {
  if (!REPEATS.includes(r.repeat)) return 'Choose how often it repeats.';
  if (r.repeat === 'WEEKLY') {
    const d = r.days ?? [];
    if (!d.length || d.some((x) => !Number.isInteger(x) || x < 0 || x > 6)) return 'Choose the days of the week.';
  }
  if (r.repeat === 'MONTHLY') {
    const d = r.day;
    if (d === null || d === undefined || !Number.isInteger(d) || d < 0 || d > 31) return 'Choose the day of the month (0 for the last day).';
  }
  if (r.repeat === 'EVERY_N_DAYS_AFTER_DONE') {
    const n = r.every;
    if (!n || !Number.isInteger(n) || n < 1 || n > 365) return 'Choose how many days after it is done (1 to 365).';
  }
  return null;
}

/** does a calendar repeat fall on this day (EVERY_N_DAYS_AFTER_DONE has no calendar: it follows completion) */
export function occursOn(r: RepeatRule, day: string): boolean {
  switch (r.repeat) {
    case 'DAILY': return true;
    case 'WEEKDAYS': return weekday(day) >= 1 && weekday(day) <= 5;
    case 'WEEKLY': return (r.days ?? []).includes(weekday(day));
    case 'MONTHLY': {
      const dom = +day.slice(8, 10);
      const last = lastDayOfMonth(day);
      // a monthly "31st" falls on the last day of a shorter month rather than being skipped
      return r.day === 0 ? dom === last : dom === Math.min(r.day ?? 1, last);
    }
    default: return false;
  }
}

/** the first day on or after `from` that the repeat falls on (null for a repeat that follows completion) */
export function firstOnOrAfter(r: RepeatRule, from: string): string | null {
  if (r.repeat === 'EVERY_N_DAYS_AFTER_DONE') return from;
  for (let i = 0; i < 400; i++) {
    const d = addDays(from, i);
    if (occursOn(r, d)) return d;
  }
  return null;
}

/** the day of the occurrence after the one on `day` (for EVERY_N_DAYS_AFTER_DONE `day` is the day it was done) */
export function nextAfter(r: RepeatRule, day: string): string | null {
  if (r.repeat === 'EVERY_N_DAYS_AFTER_DONE') return addDays(day, r.every ?? 1);
  return firstOnOrAfter(r, addDays(day, 1));
}

/**
 * How far along the reminders a to-do is, from its due instant: a heads-up the days before, "due" from the due time, "overdue" from the next day,
 * "escalated" after `escalateDays` days late. A to-do that is not open has no stage.
 */
export function stageOf(due: Date | string, now: Date, soonDays: number, escalateDays: number): Stage {
  const dueDay = dayOf(due);
  const today = istDay(now);
  const t = new Date(due).getTime();
  if (now.getTime() >= t) {
    const late = daysBetween(dueDay, today);
    if (late <= 0) return 'due';
    return late >= Math.max(1, escalateDays) ? 'escalated' : 'overdue';
  }
  return daysBetween(today, dueDay) <= Math.max(0, soonDays) ? 'soon' : 'none';
}

/** the day a repeat's next to-do should be made: when its heads-up begins, so the reminder has a to-do to remind about */
export const makeOnOrAfter = (nextDue: string, soonDays: number): string => addDays(nextDue, -Math.max(0, soonDays));

/** a time of day as asked for ('9:00', '09:00'); null when it is not one */
export function cleanTime(v: any): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const h = +m[1], min = +m[2];
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, '0')}:${m[2]}` : null;
}
