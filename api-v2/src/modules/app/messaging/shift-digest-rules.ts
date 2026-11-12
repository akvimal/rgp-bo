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
  /** bills and sales by the person who served them (the full version only) */
  byStaff?: { name: string; bills: number; sales: number }[];
  /** UPI/card taken, by terminal or app */
  digitalByProvider?: { provider: string; bills: number; amount: number }[];
  /** bills that go out for delivery, and how those stand now */
  deliveries?: { total: number; delivered: number; pending: number; failed: number };
  /** what was paid out as expenses: each with its category and amount, biggest first */
  expenseLines?: { label: string; amount: number }[];
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

/** how far from the planned start it was opened, when that is worth a word (15 minutes or more); the plan is a plan, so this is only said, never judged */
export function startNote(f: { start: string | null; openedAt: string }): string {
  const m = (t: string) => { const x = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return x ? +x[1] * 60 + +x[2] : null; };
  const planned = m(f.start || ''), actual = m(f.openedAt);
  if (planned === null || actual === null) return '';
  let d = actual - planned;
  if (d > 720) d -= 1440; else if (d < -720) d += 1440;
  if (Math.abs(d) < 15) return '';
  const mins = Math.abs(d), text = mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`;
  return ` (planned ${f.start}, ${text} ${d > 0 ? 'late' : 'early'})`;
}

const hours = (f: { start: string | null; end: string | null }) => (f.start && f.end ? ` (${f.start}-${f.end})` : '');

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

/** the sections only the full version carries: who served how much, cash against UPI/card, deliveries, expenses */
function detail(f: ShiftFacts): string[] {
  const out: string[] = [];
  const staff = (f.byStaff ?? []).filter((x) => x.bills > 0);
  if (staff.length) {
    out.push('', 'Bills by staff:');
    for (const x of staff) out.push(`• ${x.name}: ${x.bills} bill${x.bills === 1 ? '' : 's'} · ${rupees(x.sales)}`);
  }
  const total = f.cashSales + f.digitalSales + f.creditSales;
  if (total > 0) {
    const pc = (n: number) => `${Math.round((n / total) * 100)}%`;
    out.push('', `Cash ${rupees(f.cashSales)} (${pc(f.cashSales)}) · UPI/card ${rupees(f.digitalSales)} (${pc(f.digitalSales)})${f.creditSales > 0 ? ` · credit ${rupees(f.creditSales)} (${pc(f.creditSales)})` : ''}`);
    const prov = (f.digitalByProvider ?? []).filter((d) => d.amount > 0);
    if (prov.length > 1 || (prov.length === 1 && prov[0].provider !== 'OTHER')) out.push(`UPI/card by app: ${prov.map((d) => `${d.provider} ${rupees(d.amount)} (${d.bills})`).join(' · ')}`);
  }
  const d = f.deliveries;
  if (d && d.total > 0) {
    const parts = [d.delivered ? `${d.delivered} delivered` : '', d.pending ? `${d.pending} waiting` : '', d.failed ? `${d.failed} failed` : ''].filter(Boolean);
    out.push(`Deliveries: ${d.total}${parts.length ? ` (${parts.join(', ')})` : ''}`);
  }
  const lines = f.expenseLines ?? [];
  if (f.expensesCount) {
    const shown = lines.slice(0, 5).map((l) => `${l.label} ${rupees(l.amount)}`).join(', ');
    out.push(`Expenses: ${rupees(f.expensesTotal)} (${f.expensesCount})${shown ? ` — ${shown}${lines.length > 5 ? ', ...' : ''}` : ''}`);
  }
  return out;
}

/** for the store group: no cash amounts, no differences, no names (unless the owner chose the full version for the group) */
export function formatShiftGroup(f: ShiftFacts, full = false): string {
  if (full) return formatShiftManager(f);
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
    ...detail(f),
    '',
    `Drawer: expected ${rupees(f.expectedCash)}, counted ${f.countedCash === null ? 'not counted' : rupees(f.countedCash)}${v === null ? '' : ` — ${signed(v)}`}`,
  ];
  for (const d of f.digital) lines.push(`${d.provider}: system ${rupees(d.system)}, terminal ${rupees(d.counted)} — ${signed(d.variance)}`);
  const moved: string[] = [];
  if (f.expensesCount && !(f.expenseLines ?? []).length) moved.push(`expenses ${rupees(f.expensesTotal)} (${f.expensesCount})`);
  if (f.refunds) moved.push(`refunds ${rupees(f.refunds)}`);
  if (f.deposits) moved.push(`banked ${rupees(f.deposits)}`);
  if (moved.length) lines.push(`Paid from the drawer: ${moved.join(' · ')}`);
  lines.push(reconciled(f) ? '✅ Reconciled' : '⚠️ Not reconciled: check the shift in the app');
  return lines.join('\n').slice(0, 4000);
}

// ------------------------------------------------------------------------------------------------ opening a shift
export interface OpenFacts {
  store: string;
  shiftName: string;
  start: string | null;
  end: string | null;
  /** the time it was opened, India time, such as 09:05 */
  openedAt: string;
  openedBy: string | null;
  /** whose drawer it is, when that is somebody other than the opener */
  drawerOf: string | null;
  openingCash: number;
  fromVault: boolean;
  /** the shift this one took over from, when it is a handover */
  handoverFrom: string | null;
}

/** for the store group: that the shop is open, with no names and no cash (unless the owner chose the full version) */
export function formatOpenGroup(f: OpenFacts, full = false): string {
  if (full) return formatOpenManager(f);
  return `\u{1F7E2} ${f.store} — ${f.shiftName}${hours(f)} opened at ${f.openedAt}${f.handoverFrom ? ' (handover)' : ''}`;
}

/** for the people who run the shop: who opened it, whose drawer, and the opening float */
export function formatOpenManager(f: OpenFacts): string {
  const lines = [`\u{1F7E2} ${f.store} — ${f.shiftName}${hours(f)} opened at ${f.openedAt}${startNote(f)}${f.openedBy ? ` by ${f.openedBy}` : ''}`];
  if (f.handoverFrom) lines.push(`Handed over from ${f.handoverFrom}`);
  if (f.drawerOf && f.drawerOf !== f.openedBy) lines.push(`Drawer of ${f.drawerOf}`);
  lines.push(`Opening float ${rupees(f.openingCash)}${f.fromVault ? ' (taken from the vault)' : ''}`);
  return lines.join('\n');
}
