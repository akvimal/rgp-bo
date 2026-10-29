/**
 * The compliance register's rules (RECOGNITION_AND_COMPLIANCE sections 3 and 7): what is owed, who owns it, and which step of the ladder an item is on.
 * Pure: no framework, no database, relative imports only, so it is tested without either.
 *
 * Ladder (stage 2 reports it; "required" and "blocked" come with stage 5): Reminder before the due day, Due from the due day, Late when the item's own
 * number of days has passed (the store head is told), Escalated when the business's escalation days have passed (the Business Head is told).
 * A granted waiver holds an item at Waived until it ends. An item that is done is Done.
 */

export type ComplianceClass = 'legal' | 'cash' | 'operating' | 'customer' | 'people';
export type Step = 'reminder' | 'due' | 'late' | 'escalated' | 'waived' | 'done';
export const STEPS: Step[] = ['reminder', 'due', 'late', 'escalated', 'waived', 'done'];

export interface ItemDef {
  key: string;
  label: string;
  cls: ComplianceClass;
  /** who is asked to do it: the store head for the store, the business head, or the person on the item */
  owner: 'store_head' | 'owner' | 'person';
  /** days before the due day that it is listed as a reminder */
  remindDays: number;
  /** the config key (compliance scope) holding the days after the due day at which it is Late, with the default */
  lateKey?: string;
  lateDefault: number;
  /** a business pack this item belongs to */
  pack?: string;
  /** "do this to continue": once this many days past due the person must do it, or give a reason, at the next shift open or close (stage 5) */
  gate?: { key: string; default: number; phase: 'open' | 'close' };
}

export const ITEMS: ItemDef[] = [
  { key: 'stock_count', label: 'Stock count', cls: 'operating', owner: 'store_head', remindDays: 7, lateKey: 'stock_count_late_days', lateDefault: 3, gate: { key: 'stock_count_required_days', default: 6, phase: 'close' } },
  { key: 'outage_check', label: 'Outage kit weekly check', cls: 'operating', owner: 'store_head', remindDays: 2, lateKey: 'outage_late_days', lateDefault: 2 },
  { key: 'weekly_review', label: 'Weekly review sign-off', cls: 'operating', owner: 'store_head', remindDays: 0, lateKey: 'review_late_days', lateDefault: 2 },
  { key: 'shift_close', label: 'Close the shift and count the cash', cls: 'cash', owner: 'person', remindDays: 0, lateDefault: 0, gate: { key: 'shift_close_required_days', default: 1, phase: 'open' } },
  { key: 'licence', label: 'Licence renewal', cls: 'legal', owner: 'owner', remindDays: 30, lateDefault: 0 },
  { key: 'parked_bill', label: 'Finish or discard a parked bill', cls: 'customer', owner: 'person', remindDays: 0, lateDefault: 1 },
];

export const itemOf = (key: string): ItemDef | undefined => ITEMS.find((i) => i.key === key);

const MS = 86400000;
const t = (day: string) => Date.parse(day.slice(0, 10) + 'T00:00:00Z');
export const addDays = (day: string, n: number) => new Date(t(day) + n * MS).toISOString().slice(0, 10);
/** whole days from `from` to `to` (negative when `to` is earlier) */
export const daysBetween = (from: string, to: string) => Math.round((t(to) - t(from)) / MS);

export interface LadderInput {
  dueOn: string;
  today: string;
  /** days after the due day at which it is Late */
  lateDays: number;
  /** days after the due day at which the Business Head is told (never earlier than Late) */
  escalateDays: number;
  remindDays: number;
  done?: boolean;
  /** end day of a granted waiver, inclusive */
  waivedUntil?: string | null;
}

/** The step an item is on today, or null when it is too early to list. */
export function stepOf(i: LadderInput): Step | null {
  if (i.done) return 'done';
  if (i.waivedUntil && i.today <= i.waivedUntil) return 'waived';
  const over = daysBetween(i.dueOn, i.today);
  if (over < -i.remindDays) return null;
  if (over < 0) return 'reminder';
  const late = Math.max(0, i.lateDays);
  const esc = Math.max(late, i.escalateDays);
  if (over < late) return 'due';
  if (over < esc) return 'late';
  return 'escalated';
}

/** the numbers of days a business has chosen for an item: its own late days and the escalation days */
export function ladderFor(def: ItemDef, config: Record<string, any>): { lateDays: number; escalateDays: number } {
  const own = def.lateKey ? Number(config[def.lateKey]) : NaN;
  const lateDays = Number.isFinite(own) ? own : def.lateDefault;
  const esc = Number(config.escalate_days);
  return { lateDays, escalateDays: Number.isFinite(esc) ? esc : 3 };
}

/** whether an item has reached "do this to continue": a gate item that is this many days past its due day and not waived or done */
export function isRequired(def: ItemDef, config: Record<string, any>, input: { dueOn: string; today: string; waivedUntil?: string | null; done?: boolean }): boolean {
  if (!def.gate || input.done) return false;
  if (input.waivedUntil && input.today <= input.waivedUntil) return false;
  const own = Number(config[def.gate.key]);
  const days = Number.isFinite(own) ? own : def.gate.default;
  return daysBetween(input.dueOn, input.today) >= days;
}

/** a waiver of this many days from today, held inside the business's longest */
export function waiverEnd(today: string, days: number, max: number): { ok: true; until: string } | { ok: false; error: string } {
  if (!Number.isInteger(days) || days < 1) return { ok: false, error: 'A waiver must be at least 1 day.' };
  if (days > max) return { ok: false, error: `A waiver can be at most ${max} days.` };
  return { ok: true, until: addDays(today, days - 1) };
}

/** The ladder steps that need someone's attention now (what the Needs-you-now strip counts). */
export const NEEDS_ACTION: Step[] = ['due', 'late', 'escalated'];
export const isOpenStep = (s: Step | null): boolean => s !== null && s !== 'done';
