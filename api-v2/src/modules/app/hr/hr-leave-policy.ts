/**
 * The rules of a leave type, with no database: how its days build up, when they can first be taken, and how many can be taken together.
 *  - YEARLY  : the whole year's days are there from the start of the year (how leave has always worked).
 *  - MONTHLY : one twelfth is credited on the first of each month, from the month of joining, and the balance starts again each 1 January
 *              (what is left at the end of December lapses; nothing is carried forward).
 * A person who joins on or before the 15th earns for that month; one who joins later starts the next month.
 */
export type Accrual = 'YEARLY' | 'MONTHLY';

export interface LeavePolicy {
  annual: number;
  accrual: Accrual;
  /** the leave can be taken only this many months after the date of joining (0 = no wait) */
  waitMonths: number;
  /** the most days of this type that may be taken together (null = no limit) */
  maxTogether: number | null;
  /** weekly offs and holidays between two leave days count towards "together" */
  stretchCountsOffs: boolean;
}

export const FIRST_MONTH_CUTOFF_DAY = 15;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const day = (s: string) => Date.parse(String(s).slice(0, 10) + 'T00:00:00Z');
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** the month (1 to 12) a person starts earning in during `year`; 13 when they join after that year */
export function startMonth(joinDate: string, year: number): number {
  const jy = Number(String(joinDate).slice(0, 4)), jm = Number(String(joinDate).slice(5, 7)), jd = Number(String(joinDate).slice(8, 10));
  if (jy < year) return 1;
  if (jy > year) return 13;
  return jd <= FIRST_MONTH_CUTOFF_DAY ? jm : jm + 1;
}

/** the days credited in the year of `asOf`, up to and including its month (YEARLY: the whole year at once) */
export function creditedDays(p: Pick<LeavePolicy, 'annual' | 'accrual'>, joinDate: string, asOf: string): number {
  const annual = Number(p.annual) || 0;
  if (annual <= 0) return 0;
  if (p.accrual !== 'MONTHLY') return annual;
  const year = Number(asOf.slice(0, 4)), month = Number(asOf.slice(5, 7));
  const months = Math.max(0, Math.min(12, month) - startMonth(joinDate, year) + 1);
  return r2(Math.min(annual, (annual / 12) * months));
}

/** the first day the leave can be taken: the date of joining plus the waiting months (the day is kept, or the month's last day if it has none) */
export function eligibleFrom(joinDate: string, waitMonths: number): string {
  const n = Math.max(0, Math.floor(Number(waitMonths) || 0));
  const y = Number(joinDate.slice(0, 4)), m = Number(joinDate.slice(5, 7)) - 1, d = Number(joinDate.slice(8, 10));
  const total = y * 12 + m + n;
  const ty = Math.floor(total / 12), tm = total % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return iso(Date.UTC(ty, tm, Math.min(d, last)));
}

export interface Stretch { days: number; from: string; to: string }

/**
 * The longest run of leave that includes any of the new days. Leave days belong to one run when the dates between them are all off days
 * (weekly off or holiday), so Friday and Monday with a weekend between are one run. The run is measured in calendar days when offs between
 * count (Friday to Monday is 4), otherwise in leave days.
 */
export function longestStretch(newDays: string[], otherDays: string[], isOff: (d: string) => boolean, countOffs: boolean): Stretch {
  const mine = new Set(newDays);
  const all = Array.from(new Set([...newDays, ...otherDays])).sort();
  const runs: string[][] = [];
  for (const d of all) {
    const run = runs[runs.length - 1];
    if (run) {
      const prev = day(run[run.length - 1]);
      let bridged = true;
      for (let t = prev + 86400000; t < day(d); t += 86400000) if (!isOff(iso(t))) { bridged = false; break; }
      if (bridged) { run.push(d); continue; }
    }
    runs.push([d]);
  }
  let best: Stretch = { days: 0, from: '', to: '' };
  for (const run of runs) {
    if (!run.some((d) => mine.has(d))) continue;
    const from = run[0], to = run[run.length - 1];
    const days = countOffs ? Math.round((day(to) - day(from)) / 86400000) + 1 : run.length;
    if (days > best.days) best = { days, from, to };
  }
  return best;
}

export interface Advice { fromDay: number | null; toDay: number | null; avoidWeekdays: number[] | null }

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
const short = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/**
 * What is outside the advised days, in plain words (an empty list when everything fits). Advice only: the leave is still recorded, and the note
 * goes with it so the person who approves sees it.
 */
export function adviceNotes(days: string[], a: Advice): string[] {
  const out: string[] = [];
  if (a.fromDay && a.toDay) {
    const outside = days.filter((d) => Number(d.slice(8, 10)) < a.fromDay! || Number(d.slice(8, 10)) > a.toDay!);
    if (outside.length) out.push(`Advised between the ${ordinal(a.fromDay)} and the ${ordinal(a.toDay)} of the month: ${outside.map(short).join(', ')} ${outside.length === 1 ? 'is' : 'are'} outside it.`);
  }
  const avoid = (a.avoidWeekdays || []).filter((w) => w >= 0 && w <= 6);
  if (avoid.length) {
    const on = days.filter((d) => avoid.includes(new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay()));
    if (on.length) out.push(`Advised not on ${avoid.map((w) => WEEKDAYS[w]).join(' or ')}: ${on.map((d) => `${WEEKDAYS[new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay()]} ${short(d)}`).join(', ')}.`);
  }
  return out;
}
