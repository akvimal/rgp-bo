/**
 * The message sent when a shift is closed. Two versions of the same facts: the store group (everyone who works there) gets the shift's bills and takings
 * with no cash amounts, no differences and no names; the people who run the shop get the cash and the differences in a personal message. Pure: no framework and
 * no database, relative imports only, so the wording is unit tested.
 */
export interface ShiftFacts {
  store: string;
  shiftName: string;
  start: string | null;
  end: string | null;
  handover: boolean;
  closedBy: string | null;
  bills: number;
  items: number;
  sales: number;
  cashSales: number;
  digitalSales: number;
  creditSales: number;
  returns: number;
  customersNew: number;
  customersReturning: number;
  billsWithoutCustomer: number;
  /** scheduled-drug entries made in the shift; null where the shop does not keep a register */
  scheduledEntries: number | null;
  /** drawer: what the system expected, what was counted, and the difference (counted less expected) */
  expectedCash: number;
  countedCash: number | null;
  /** what the terminals showed against the system, one per provider, with the difference (terminal less system) */
  digital: { provider: string; system: number; counted: number; variance: number }[];
  expensesCount: number;
  expensesTotal: number;
  refunds: number;
  deposits: number;
}

/** rupees for reading: whole rupees, paise only when there are some */
export const rupees = (n: number): string => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

/** a difference within a rupee is not a difference */
export const TOLERANCE = 1;

export const cashVariance = (f: ShiftFacts): number | null => (f.countedCash === null || f.countedCash === undefined ? null : Math.round((f.countedCash - f.expectedCash) * 100) / 100);
export const digitalOff = (f: ShiftFacts) => f.digital.filter((d) => Math.abs(d.variance) > TOLERANCE);
/** true when the drawer and the terminals agree with the bills */
export const reconciled = (f: ShiftFacts): boolean => {
  const v = cashVariance(f);
  return (v === null || Math.abs(v) <= TOLERANCE) && digitalOff(f).length === 0;
};

const hours = (f: ShiftFacts) => (f.start && f.end ? ` (${f.start}-${f.end})` : '');

/** the facts both versions share */
function body(f: ShiftFacts): string[] {
  const out: string[] = [];
  out.push(`${f.bills} bill${f.bills === 1 ? '' : 's'} · ${f.items} item${f.items === 1 ? '' : 's'} · sales ${rupees(f.sales)}`);
  const split = [`cash ${rupees(f.cashSales)}`, `UPI/card ${rupees(f.digitalSales)}`];
  if (f.creditSales > 0) split.push(`credit ${rupees(f.creditSales)}`);
  out.push(split.join(' · '));
  if (f.returns > 0) out.push(`Returns taken: ${f.returns}`);
  const known = f.customersNew + f.customersReturning;
  out.push(known || f.billsWithoutCustomer
    ? `Customers on record: ${known}${known ? ` (${f.customersNew} new, ${f.customersReturning} returning)` : ''}${f.billsWithoutCustomer ? ` · ${f.billsWithoutCustomer} bill${f.billsWithoutCustomer === 1 ? '' : 's'} without a customer` : ''}`
    : 'No customers on record');
  if (f.scheduledEntries) out.push(`Scheduled-drug entries: ${f.scheduledEntries}`);
  return out;
}

/** for the store group: no cash amounts, no differences, no names */
export function formatShiftGroup(f: ShiftFacts): string {
  return [
    `\u{1F3EA} ${f.store} — ${f.shiftName}${hours(f)} ${f.handover ? 'handed over' : 'closed'}`,
    ...body(f),
    reconciled(f) ? '✅ Cash and UPI/card match the bills' : '⚠️ A difference is with the store head to check',
  ].join('\n');
}

const signed = (v: number) => (Math.abs(v) <= TOLERANCE ? 'matches' : v < 0 ? `short ${rupees(-v)}` : `over ${rupees(v)}`);

/** for the people who run the shop: the same facts, then the drawer, the terminals and the money that moved */
export function formatShiftManager(f: ShiftFacts): string {
  const v = cashVariance(f);
  const lines = [
    `\u{1F3EA} ${f.store} — ${f.shiftName}${hours(f)} ${f.handover ? 'handed over' : 'closed'}${f.closedBy ? ` by ${f.closedBy}` : ''}`,
    ...body(f),
    '',
    `Drawer: expected ${rupees(f.expectedCash)}, counted ${f.countedCash === null ? 'not counted' : rupees(f.countedCash)}${v === null ? '' : ` — ${signed(v)}`}`,
  ];
  for (const d of f.digital) lines.push(`${d.provider}: system ${rupees(d.system)}, terminal ${rupees(d.counted)} — ${signed(d.variance)}`);
  const moved: string[] = [];
  if (f.expensesCount) moved.push(`expenses ${rupees(f.expensesTotal)} (${f.expensesCount})`);
  if (f.refunds) moved.push(`refunds ${rupees(f.refunds)}`);
  if (f.deposits) moved.push(`banked ${rupees(f.deposits)}`);
  if (moved.length) lines.push(`Paid from the drawer: ${moved.join(' · ')}`);
  lines.push(reconciled(f) ? '✅ Reconciled' : '⚠️ Not reconciled: check the shift in the app');
  return lines.join('\n').slice(0, 4000);
}
