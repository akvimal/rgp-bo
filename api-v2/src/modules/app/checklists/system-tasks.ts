/**
 * The weekly and monthly jobs the system asks each store to do. Each becomes a repeating to-do in the store's pool (todo_template with a
 * system_key), made and kept in step by the checklist service. A store may switch a task off or move it to another day. Tasks that the system can
 * see for itself close themselves (`auto`), the rest are ticked by the person who did them.
 */
export interface SystemTask {
  key: string;
  title: string;
  notes: string;
  cadence: 'WEEKLY' | 'MONTHLY';
  /** WEEKLY: 0 = Sunday ... 6; MONTHLY: day of the month, 0 = the last day */
  day: number;
  link: string;
  /** the to-do closes itself when this happens: a checklist run completed, the price list printed, the weekly review signed */
  auto?: string;
  /** only for a business with this pack on */
  pack?: 'pharmacy';
  priority?: 'low' | 'normal' | 'high';
}

export const SYSTEM_TASKS: SystemTask[] = [
  { key: 'outage_check', title: 'Outage readiness check', cadence: 'WEEKLY', day: 1, link: '/secure/checklists?key=outage_readiness', auto: 'checklist:outage_readiness',
    notes: 'Go through the outage readiness checklist: UPS, devices, bill book, torch, float, UPI device. It closes when every item is ticked.' },
  { key: 'price_list', title: 'Print a fresh price list for the counter', cadence: 'WEEKLY', day: 1, link: '/secure/pricing/prices', auto: 'price_list',
    notes: "Print this week's price list (Pricing > Prices) and put it at the counter. It closes when the list is printed." },
  { key: 'weekly_review', title: 'Do the weekly review', cadence: 'WEEKLY', day: 2, link: '/secure/review', auto: 'weekly_review',
    notes: "Look at last week's discounts, edits, returns and cash, and sign the review. It closes when the week is signed." },
  { key: 'stock_exceptions', title: 'Clear negative stock and expired stock', cadence: 'WEEKLY', day: 3, link: '/secure/store/stock',
    notes: 'Look at products with negative stock and stock past its expiry. Correct them, or write down why they stand.' },
  { key: 'stock_count', title: 'Do the monthly stock count', cadence: 'MONTHLY', day: 1, link: '/secure/stock-audits',
    notes: 'Count the stock that is due this month and complete the count.', priority: 'high' },
  { key: 'monthly_housekeeping', title: 'Monthly housekeeping checklist', cadence: 'MONTHLY', day: 5, link: '/secure/checklists?key=monthly_housekeeping', auto: 'checklist:monthly_housekeeping',
    notes: 'UPS battery, printers, fire and first-aid, displayed licences, an expiry walk of the shelves. It closes when every item is ticked.' },
  { key: 'gst_check', title: "Check the month's GST sales report", cadence: 'MONTHLY', day: 5, link: '/secure/gst-filing',
    notes: "Open last month's GST sales report, look at the adjustments, and make sure it is right before filing.", priority: 'high' },
  { key: 'bank_cash_check', title: 'Match the cash book and bank statement', cadence: 'MONTHLY', day: 3, link: '/secure/finance',
    notes: 'Bank the cash that is due, import the bank statement and clear what does not match.' },
  { key: 'drug_register', title: 'Check the drug register against the bills', cadence: 'MONTHLY', day: 0, link: '/secure/schedule-register', pack: 'pharmacy',
    notes: 'Make sure every Schedule H, H1 and X sale of the month is in the register.', priority: 'high' },
];

const BY_KEY = new Map(SYSTEM_TASKS.map((x) => [x.key, x]));
export const systemTask = (key: string): SystemTask | undefined => BY_KEY.get(key);

export interface TaskSetting { enabled: boolean; day: number | null }

/** the setting that applies to a store: its own, else the business's, else the task's default */
export function effectiveSetting(task: SystemTask, own: TaskSetting | undefined, business: TaskSetting | undefined): { enabled: boolean; day: number } {
  const pick = (s?: TaskSetting) => (s && s.day !== null && s.day !== undefined ? s.day : null);
  return { enabled: own ? own.enabled : business ? business.enabled : true, day: pick(own) ?? pick(business) ?? task.day };
}

/** a day for the task's cadence, or a problem in plain words */
export function dayProblem(task: SystemTask, day: any): string | null {
  if (day === null || day === undefined || day === '') return null;
  const n = Number(day);
  if (!Number.isInteger(n)) return 'Choose a day.';
  if (task.cadence === 'WEEKLY' && (n < 0 || n > 6)) return 'Choose a day of the week.';
  if (task.cadence === 'MONTHLY' && (n < 0 || n > 31)) return 'Choose a day of the month (0 for the last day).';
  return null;
}
