/**
 * Store checklists: lists of things a store ticks off (outage readiness, opening, closing, monthly housekeeping, and any the store adds itself).
 * The lists shipped here are the defaults; a business or a store may change its own copy (checklist_template). Each run keeps the wording as it
 * was when ticked, so changing a list later does not rewrite the past.
 */
export type ItemKind = 'tick' | 'text';
/** an item the system can see for itself: it ticks itself and cannot be ticked by hand */
export type AutoKind = 'price_list';

export interface ChecklistItem { key: string; label: string; kind: ItemKind; auto?: AutoKind | null }
export interface ChecklistDef { key: string; title: string; description: string; every: 'WEEKLY' | 'MONTHLY' | 'DAILY'; items: ChecklistItem[] }

const t = (key: string, label: string): ChecklistItem => ({ key, label, kind: 'tick' });

export const DEFAULT_CHECKLISTS: ChecklistDef[] = [
  {
    key: 'outage_readiness', title: 'Outage readiness', every: 'WEEKLY',
    description: 'What the shop needs to keep selling by hand from a printed price list and a numbered bill book if the power or the connection goes.',
    items: [
      t('ups_tested', 'UPS or inverter is plugged in, charged and tested (switch the mains off for a minute)'),
      t('on_ups', 'The PC, router and bill printer are on the UPS or inverter'),
      t('devices_charged', 'Laptop and phone are charged, and the phone has data for a hotspot'),
      { key: 'bill_book', label: 'The bill book has enough unused pages. Last number used', kind: 'text' },
      { key: 'price_list', label: 'The price list printed this week is at the counter', kind: 'tick', auto: 'price_list' },
      t('light', 'A torch or emergency light works'),
      t('float', 'There is change in the drawer for cash billing'),
      t('upi_ready', 'The UPI device or soundbox is charged'),
      t('procedure', 'The outage procedure is printed and kept in the bill book'),
    ],
  },
  {
    key: 'opening', title: 'Opening', every: 'DAILY',
    description: 'Before the first bill of the day.',
    items: [
      t('lights', 'Lights, fans and the shelves are ready'),
      t('system_on', 'The PC, printer and UPI device are on and working'),
      t('float', 'The cash in the drawer matches what was left yesterday'),
      t('expiry_shelf', 'Nothing expired or near expiry is on the shelf'),
      t('fridge', 'The fridge is on and at the right temperature'),
    ],
  },
  {
    key: 'closing', title: 'Closing', every: 'DAILY',
    description: 'After the last bill of the day.',
    items: [
      t('shift_closed', 'The shift is closed and the cash counted'),
      t('cash_banked', 'Cash over the limit is put in the vault or banked'),
      t('held_bills', 'No bill is left on hold'),
      t('system_off', 'The PC, printer and lights are switched off'),
      t('locked', 'The shop is locked and the keys are with the Store Head'),
    ],
  },
  {
    key: 'monthly_housekeeping', title: 'Monthly housekeeping', every: 'MONTHLY',
    description: 'Things that wear out slowly.',
    items: [
      t('ups_battery', 'The UPS or inverter battery holds for at least 30 minutes'),
      t('router_printer', 'The router and printers are clean and the paper and ink are enough'),
      t('fire_firstaid', 'The fire extinguisher is in date and the first-aid box is complete'),
      t('licences_displayed', 'Licences and the price notice are displayed and in date'),
      t('expiry_walk', 'The shelves were walked for expiry in the next three months'),
    ],
  },
];

const BY_KEY = new Map(DEFAULT_CHECKLISTS.map((d) => [d.key, d]));
export const defaultList = (key: string): ChecklistDef | undefined => BY_KEY.get(key);

/** a key for a new item: short, plain and not already in the list */
export const newItemKey = (existing: string[]): string => {
  let n = existing.length + 1;
  while (existing.includes(`c${n}`)) n++;
  return `c${n}`;
};

/** the key of a checklist a store adds itself, from its title */
export const slugKey = (title: string): string => `c_${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30)}`;

/** the list as asked for by someone editing it: trimmed, keyed, de-duplicated; a problem comes back in plain words */
export function cleanItems(raw: any): { items: ChecklistItem[]; problem: string | null } {
  if (!Array.isArray(raw) || raw.length === 0) return { items: [], problem: 'A checklist needs at least one item.' };
  if (raw.length > 40) return { items: [], problem: 'A checklist can have up to 40 items.' };
  const out: ChecklistItem[] = [];
  const keys: string[] = [];
  for (const r of raw) {
    const label = String(r?.label ?? '').trim();
    if (!label) return { items: [], problem: 'Every item needs some words.' };
    if (label.length > 200) return { items: [], problem: 'An item can be up to 200 characters.' };
    let key = String(r?.key ?? '').trim();
    if (!/^[a-z0-9_]{1,40}$/.test(key) || keys.includes(key)) key = newItemKey(keys);
    keys.push(key);
    const kind: ItemKind = r?.kind === 'text' ? 'text' : 'tick';
    const auto: AutoKind | null = r?.auto === 'price_list' ? 'price_list' : null;
    out.push({ key, label, kind, ...(auto ? { auto } : {}) });
  }
  return { items: out, problem: null };
}

export interface RunItem { key: string; label: string; ticked: boolean; value?: string }

/**
 * Turn what was ticked into the record kept. `ticks` is {key: true}, `values` {key: text}; `auto` is what the system saw for itself (an automatic
 * item is ticked only when the system says so). A text item is done when it has a value. Unknown keys are ignored.
 */
export function recordRun(list: ChecklistItem[], ticks: Record<string, any> | undefined, values: Record<string, any> | undefined, auto: Partial<Record<AutoKind, boolean>> = {}) {
  const items: RunItem[] = list.map((i) => {
    if (i.auto) return { key: i.key, label: i.label, ticked: !!auto[i.auto] };
    if (i.kind === 'text') {
      const v = String(values?.[i.key] ?? '').trim().slice(0, 80);
      return { key: i.key, label: i.label, ticked: v.length > 0, ...(v ? { value: v } : {}) };
    }
    return { key: i.key, label: i.label, ticked: !!(ticks && (ticks[i.key] === true || ticks[i.key] === 'true')) };
  });
  return { items, complete: items.every((i) => i.ticked) };
}

/** whole days from a date to today (both YYYY-MM-DD), never negative */
export function daysSince(fromIso: string | null, todayIso: string): number | null {
  if (!fromIso) return null;
  const d = Math.round((Date.parse(todayIso + 'T00:00:00Z') - Date.parse(String(fromIso).slice(0, 10) + 'T00:00:00Z')) / 86400000);
  return Math.max(0, d);
}

/** how long a complete run keeps a checklist "current" */
export const CURRENT_DAYS: Record<ChecklistDef['every'], number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 31 };
export const isCurrent = (every: ChecklistDef['every'], lastCompleteIso: string | null, todayIso: string): boolean => {
  const d = daysSince(lastCompleteIso, todayIso);
  return d !== null && d < CURRENT_DAYS[every];
};

/** the outage procedure printed for the counter: short steps in plain words (the pharmacy steps are left out for a business that is not one) */
const PHARMACY_STEPS = [
  "For a medicine the customer takes regularly, write the customer's mobile number.",
  'A prescription medicine (marked Rx) goes in the prescription register as usual.',
];

export const PROCEDURE: { heading: string; steps: string[] }[] = [
  { heading: 'When the power goes', steps: [
    'Make sure the PC, router and printer are on the UPS or inverter. Switch on the torch or emergency light.',
    'If the system keeps working, keep billing as usual.',
    'If the system stops, tell customers you are billing by hand and carry on from the price list.',
  ] },
  { heading: 'Billing by hand', steps: [
    'Use the next page of the bill book. Write the bill number, date and time.',
    'Write each item with its quantity and the price from the price list. Prices on the list already include GST.',
    'Write the total. Give the customer copy and keep the shop copy. Never skip a number; cross out a spoiled bill and keep it.',
    ...PHARMACY_STEPS,
  ] },
  { heading: 'Money', steps: [
    'Take cash or UPI only. For UPI, write the reference number on the bill.',
    'No credit sales, staff credit, store credit or discounts beyond the price list.',
    'No refunds: write down the return and ask the customer to come back.',
  ] },
  { heading: 'When the power is back', steps: [
    'Do not close the shift yet.',
    'The Store Head checks the bill book against the cash and UPI received, and signs.',
    'Enter every bill in the system, in bill book order.',
  ] },
];

export const procedureFor = (pharmacy: boolean) => (pharmacy ? PROCEDURE : PROCEDURE.map((p) => ({ ...p, steps: p.steps.filter((s) => !PHARMACY_STEPS.includes(s)) })));

/**
 * The checklists in the order a store wants them: the keys of the saved order first (those that still exist, once each), then any checklist the order does
 * not name (one added since) in the order it came. With no saved order the lists come as given.
 */
export function orderLists<T extends { key: string }>(lists: T[], saved: string[] | null | undefined): T[] {
  if (!saved || !saved.length) return lists;
  const byKey = new Map(lists.map((l) => [l.key, l]));
  const out: T[] = [];
  for (const k of saved) { const l = byKey.get(k); if (l && !out.includes(l)) out.push(l); }
  for (const l of lists) if (!out.includes(l)) out.push(l);
  return out;
}

/** an order asked for: the keys, trimmed, once each, only those that exist; a problem in plain words when nothing usable was sent */
export function cleanOrder(raw: any, known: string[]): { keys: string[]; problem: string | null } {
  if (!Array.isArray(raw) || !raw.length) return { keys: [], problem: 'Send the checklists in the order you want them.' };
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const k of raw) { const key = String(k ?? '').trim(); if (known.includes(key) && !seen.has(key)) { seen.add(key); keys.push(key); } }
  if (!keys.length) return { keys: [], problem: 'None of those are checklists of this store.' };
  for (const k of known) if (!seen.has(k)) keys.push(k);          // a checklist left out keeps its place at the end
  return { keys, problem: null };
}

// ------------------------------------------------------------------ when a checklist is to be done
/**
 * A checklist's schedule. Not scheduled; every shift (a to-do when a shift opens); or daily, weekly (on a weekday) or monthly (on a day of the month),
 * at a time, as a repeating to-do in the store's shared list. A store keeps its own, the owner sets one for every store without its own, and with
 * neither the schedule shipped here applies.
 */
export type Cadence = 'NONE' | 'EACH_SHIFT' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export const CADENCES: Cadence[] = ['NONE', 'EACH_SHIFT', 'DAILY', 'WEEKLY', 'MONTHLY'];
export interface Schedule { cadence: Cadence; day: number | null; time: string }
export const NO_SCHEDULE: Schedule = { cadence: 'NONE', day: null, time: '09:00' };

export const DEFAULT_SCHEDULE: Record<string, Schedule> = {
  outage_readiness: { cadence: 'WEEKLY', day: 1, time: '09:00' },
  opening: { cadence: 'DAILY', day: null, time: '09:00' },
  closing: { cadence: 'DAILY', day: null, time: '21:00' },
  monthly_housekeeping: { cadence: 'MONTHLY', day: 5, time: '09:00' },
};

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ScheduleRow { cadence: string; day: number | null; at_time: string | null }

const fromRow = (r: ScheduleRow, key: string): Schedule => {
  const cadence = (CADENCES as string[]).includes(r.cadence) ? (r.cadence as Cadence) : 'NONE';
  const dflt = DEFAULT_SCHEDULE[key];
  // a weekly or monthly row with no day follows the day the list is shipped with, else the first
  const day = cadence === 'WEEKLY' ? (r.day ?? (dflt?.cadence === 'WEEKLY' ? dflt.day : null) ?? 1)
    : cadence === 'MONTHLY' ? (r.day ?? (dflt?.cadence === 'MONTHLY' ? dflt.day : null) ?? 1) : null;
  return { cadence, day, time: r.at_time && TIME_RE.test(r.at_time) ? r.at_time : (dflt?.time ?? '09:00') };
};

/** the schedule that applies to a store: its own, else the business's, else the shipped one, else none */
export function effectiveSchedule(key: string, own?: ScheduleRow | null, wide?: ScheduleRow | null): { schedule: Schedule; source: 'store' | 'business' | 'default' } {
  if (own) return { schedule: fromRow(own, key), source: 'store' };
  if (wide) return { schedule: fromRow(wide, key), source: 'business' };
  return { schedule: DEFAULT_SCHEDULE[key] ?? NO_SCHEDULE, source: 'default' };
}

/** a problem with a schedule asked for, in plain words; null when it is usable */
export function scheduleProblem(cadence: any, day: any, time: any): string | null {
  if (!(CADENCES as string[]).includes(cadence)) return 'Choose when it is done: not scheduled, every shift, daily, weekly or monthly.';
  if (cadence === 'WEEKLY') { const n = Number(day); if (day === null || day === undefined || day === '' || !Number.isInteger(n) || n < 0 || n > 6) return 'Choose the day of the week.'; }
  if (cadence === 'MONTHLY') { const n = Number(day); if (day === null || day === undefined || day === '' || !Number.isInteger(n) || n < 0 || n > 31) return 'Choose the day of the month (0 for the last day).'; }
  if (['DAILY', 'WEEKLY', 'MONTHLY'].includes(cadence) && !TIME_RE.test(String(time ?? ''))) return 'The time should look like 09:30.';
  return null;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;

/** the schedule in words */
export function scheduleLabel(s: Schedule): string {
  switch (s.cadence) {
    case 'EACH_SHIFT': return 'Every shift';
    case 'DAILY': return `Daily at ${s.time}`;
    case 'WEEKLY': return `Every ${WEEKDAYS[s.day ?? 1]} at ${s.time}`;
    case 'MONTHLY': return s.day === 0 ? `Monthly on the last day at ${s.time}` : `Monthly on the ${ordinal(s.day ?? 1)} at ${s.time}`;
    default: return 'Not scheduled';
  }
}

/** how long a complete run keeps the checklist "up to date": the schedule says how often it is done, else the list's own cadence */
export function everyOf(cadence: Cadence, fallback: ChecklistDef['every']): ChecklistDef['every'] {
  return cadence === 'EACH_SHIFT' || cadence === 'DAILY' ? 'DAILY' : cadence === 'WEEKLY' ? 'WEEKLY' : cadence === 'MONTHLY' ? 'MONTHLY' : fallback;
}
