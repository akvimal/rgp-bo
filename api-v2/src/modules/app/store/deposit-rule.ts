import { BadRequestException } from '@nestjs/common';

/**
 * When cash is due at the bank (a store's rule). Two triggers, and whichever comes first makes a deposit due:
 *   - the amount: the cash balance has reached the threshold;
 *   - the calendar: today is, or has passed, a scheduled deposit day and nothing has been banked since that day
 *     (daily; certain weekdays; certain days of the month, 0 meaning the last day).
 * The reminders in the app and the notifications are driven by `evaluateDeposit`.
 */
export type DepositSchedule = 'none' | 'daily' | 'weekly' | 'monthly';

export interface DepositRule {
  threshold: number;
  schedule: DepositSchedule;
  /** 0 = Sunday ... 6 = Saturday */
  weekdays: number[];
  /** 1..31; a day the month does not have means its last day; 0 means the last day */
  monthdays: number[];
}

export interface DepositStatus {
  due: boolean;
  /** why: the balance reached the amount, or a deposit day came and nothing has been banked since */
  reason: 'amount' | 'schedule' | null;
  byamount: boolean;
  byschedule: boolean;
  /** the deposit day that is waiting (for a schedule reason) */
  since: string | null;
  /** how much the balance is over the threshold (0 unless the amount has been reached) */
  excess: number;
  /** the next deposit day after today, or null when there is no schedule */
  nextscheduled: string | null;
}

const SCHEDULES: DepositSchedule[] = ['none', 'daily', 'weekly', 'monthly'];
const DAY = 86400000;

const parse = (d: string) => new Date(d + 'T00:00:00Z');
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
const daysIn = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** is this date one of the rule's deposit days */
export function isDepositDay(rule: DepositRule, date: string): boolean {
  const d = parse(date);
  switch (rule.schedule) {
    case 'daily': return true;
    case 'weekly': return rule.weekdays.includes(d.getUTCDay());
    case 'monthly': {
      const day = d.getUTCDate(), last = daysIn(d.getUTCFullYear(), d.getUTCMonth());
      return rule.monthdays.some((m) => (m === 0 ? day === last : m > last ? day === last : day === m));
    }
    default: return false;
  }
}

/** the most recent deposit day on or before `today` (within the last two months), or null */
export function lastDepositDay(rule: DepositRule, today: string): string | null {
  if (rule.schedule === 'none') return null;
  const t = parse(today).getTime();
  for (let i = 0; i <= 62; i++) { const d = fmt(t - i * DAY); if (isDepositDay(rule, d)) return d; }
  return null;
}

/** the first deposit day after `today`, or null */
export function nextDepositDay(rule: DepositRule, today: string): string | null {
  if (rule.schedule === 'none') return null;
  const t = parse(today).getTime();
  for (let i = 1; i <= 62; i++) { const d = fmt(t + i * DAY); if (isDepositDay(rule, d)) return d; }
  return null;
}

/**
 * What the bank deposit looks like now. `lastDeposit` is the date of the latest bank deposit (any date format starting
 * YYYY-MM-DD). A deposit made on a deposit day settles that day. Nothing is due while there is no cash to bank.
 */
export function evaluateDeposit(rule: DepositRule, balance: number, lastDeposit: string | null, today: string): DepositStatus {
  const byamount = rule.threshold > 0 && balance >= rule.threshold;
  const day = lastDepositDay(rule, today);
  const banked = lastDeposit ? String(lastDeposit).slice(0, 10) : null;
  const byschedule = !!day && balance > 0 && (banked === null || banked < day);
  return {
    due: byamount || byschedule,
    reason: byamount ? 'amount' : byschedule ? 'schedule' : null,
    byamount, byschedule,
    since: byschedule ? day : null,
    excess: byamount ? Math.round((balance - rule.threshold) * 100) / 100 : 0,
    nextscheduled: nextDepositDay(rule, today),
  };
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = (n: number) => (n === 0 ? 'the last day' : `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as any)[n % 10] || 'th'}`);

/** the rule in words, for the settings screen and the reminders */
export function describeDepositRule(rule: DepositRule): string {
  const parts: string[] = [];
  if (rule.threshold > 0) parts.push(`the cash balance reaches ${rule.threshold.toLocaleString('en-IN')}`);
  if (rule.schedule === 'daily') parts.push('a day passes without a deposit');
  else if (rule.schedule === 'weekly' && rule.weekdays.length) parts.push(`it is ${rule.weekdays.map((d) => WEEKDAY_NAMES[d]).join(' or ')} and cash has not been banked since`);
  else if (rule.schedule === 'monthly' && rule.monthdays.length) parts.push(`it is ${rule.monthdays.map(ordinal).join(' or ')} of the month and cash has not been banked since`);
  return parts.length ? `A deposit is due when ${parts.join(', or when ')}: whichever comes first.` : 'No deposit reminder is set.';
}

/** the rule as sent from the screen (only the parts present are returned; anything unusable is refused) */
export function parseDepositInput(b: any): Partial<DepositRule> {
  const out: Partial<DepositRule> = {};
  if (b.depositschedule !== undefined) {
    if (!SCHEDULES.includes(b.depositschedule)) throw new BadRequestException('The deposit schedule must be none, daily, weekly or monthly.');
    out.schedule = b.depositschedule;
  }
  const ints = (v: any, label: string, min: number, max: number): number[] => {
    const list = Array.isArray(v) ? v : [];
    const nums = list.map((x) => Number(x));
    if (nums.some((n) => !Number.isInteger(n) || n < min || n > max)) throw new BadRequestException(`${label} are not valid.`);
    return Array.from(new Set(nums)).sort((a, c) => a - c);
  };
  if (b.depositweekdays !== undefined) out.weekdays = ints(b.depositweekdays, 'The weekdays', 0, 6);
  if (b.depositmonthdays !== undefined) out.monthdays = ints(b.depositmonthdays, 'The days of the month', 0, 31);
  return out;
}

/** the rule that would result from the stored one and the parts changed; a schedule needs its days */
export function checkDepositRule(r: DepositRule): void {
  if (r.schedule === 'weekly' && !r.weekdays.length) throw new BadRequestException('Choose at least one weekday for a weekly deposit.');
  if (r.schedule === 'monthly' && !r.monthdays.length) throw new BadRequestException('Choose at least one day of the month for a monthly deposit.');
}
