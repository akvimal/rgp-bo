/**
 * The day's detail for the daily digest, and its two wordings. Pure: no framework and no database, relative imports only, so the wording is unit tested.
 *
 * The store group (everyone who works there) reads the shift-wise day, customers, purchases received, audit activity and complaints, with no cash, no expenses
 * and no amounts of any difference. The people who run the shop get the same day in a personal message with the cash movement, the expenses, and each
 * discrepancy with its amount.
 */
import { rupees, TOLERANCE } from '../messaging/shift-digest-rules';

export interface DayShift {
  name: string;
  start: string | null;
  end: string | null;
  status: string;
  handover: boolean;
  bills: number;
  sales: number;
  cashSales: number;
  /** counted less expected, once the shift is closed */
  cashVariance: number | null;
  /** terminal less system, summed over the providers, once the shift is closed */
  digitalVariance: number;
}

export interface DayFacts {
  shifts: DayShift[];
  customers: { newCount: number; returning: number; none: number };
  purchases: { invoices: number; total: number };
  audits: { finished: number; signedOff: number; linesChanged: number };
  adjustments: { pending: number; oldestDays: number | null; approvedToday: number };
  complaints: { opened: number; open: number };
  /** cash on the drawers: first opening, cash sales, paid out, and the last expected and counted */
  cash: { opening: number | null; cashSales: number; expenses: number; refunds: number; deposits: number; expected: number | null; counted: number | null };
  expensesByCategory: { category: string; total: number }[];
  overdueInvoices: number;
}

const times = (s: DayShift) => (s.start && s.end ? ` (${s.start}-${s.end})` : '');
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const isOpen = (s: DayShift) => s.status === 'OPEN';
const off = (s: DayShift) => (s.cashVariance !== null && Math.abs(s.cashVariance) > TOLERANCE) || Math.abs(s.digitalVariance) > TOLERANCE;

/** the lines added to the store group's message (HTML-escaped by the caller's escape) */
export function groupDetailLines(d: DayFacts, esc: (s: string) => string): string[] {
  const out: string[] = [];
  if (d.shifts.length) {
    out.push('', '<b>By shift</b>');
    for (const s of d.shifts) {
      out.push(`• ${esc(s.name)}${times(s)}: ${plural(s.bills, 'bill')} · ${rupees(s.sales)} · ${isOpen(s) ? 'still open' : s.handover ? 'handed over' : 'closed'}`);
    }
    const differing = d.shifts.filter(off).length;
    out.push(differing ? `⚠️ ${plural(differing, 'shift')} with a difference, with the store head to check` : d.shifts.some((s) => !isOpen(s)) ? '✅ Every closed shift matches its bills' : '');
  }
  const known = d.customers.newCount + d.customers.returning;
  if (known || d.customers.none) {
    out.push('', `\u{1F465} Customers on record: ${known}${known ? ` (${d.customers.newCount} new, ${d.customers.returning} returning)` : ''}${d.customers.none ? ` · ${plural(d.customers.none, 'bill')} without a customer` : ''}`);
  }
  if (d.purchases.invoices) out.push(`\u{1F4E6} Purchases received: ${plural(d.purchases.invoices, 'invoice')}`);
  const stock: string[] = [];
  if (d.audits.finished) stock.push(`${plural(d.audits.finished, 'audit')} counted`);
  if (d.audits.signedOff) stock.push(`${d.audits.signedOff} signed off`);
  if (d.adjustments.pending) stock.push(`${plural(d.adjustments.pending, 'adjustment')} waiting for approval`);
  if (stock.length) out.push(`\u{1F4CB} Stock: ${stock.join(' · ')}`);
  if (d.complaints.opened || d.complaints.open) out.push(`\u{1F4E3} Complaints: ${d.complaints.opened} new today, ${d.complaints.open} open`);
  return out.filter((l, i, a) => !(l === '' && a[i - 1] === ''));
}

export interface DayHeadline { store: string; dateLabel: string; sales: number; bills: number; prevSales: number }

const change = (now: number, prev: number) => (!prev ? (now ? 'new' : '-') : `${now >= prev ? '+' : '-'}${Math.abs(((now - prev) / prev) * 100).toFixed(1)}%`);
const signed = (v: number) => (Math.abs(v) <= TOLERANCE ? 'matches' : v < 0 ? `short ${rupees(-v)}` : `over ${rupees(v)}`);

/** the personal message for the people who run the shop: plain text, the first line is its title */
export function formatDayManager(h: DayHeadline, d: DayFacts): string {
  const L: string[] = [];
  L.push(`\u{1F4CA} ${h.store} — ${h.dateLabel}`);
  L.push(`Sales ${rupees(h.sales)} (${change(h.sales, h.prevSales)} vs yesterday) · ${plural(h.bills, 'bill')}${h.bills ? ` · avg ${rupees(h.sales / h.bills)}` : ''}`);
  const known = d.customers.newCount + d.customers.returning;
  L.push(known || d.customers.none
    ? `Customers on record: ${known}${known ? ` (${d.customers.newCount} new, ${d.customers.returning} returning)` : ''}${d.customers.none ? ` · ${plural(d.customers.none, 'bill')} without a customer` : ''}`
    : 'No customers on record');

  if (d.shifts.length) {
    L.push('', 'By shift');
    for (const s of d.shifts) {
      const tail = isOpen(s) ? 'still open' : [s.cashVariance === null ? null : `drawer ${signed(s.cashVariance)}`, Math.abs(s.digitalVariance) > TOLERANCE ? `UPI/card ${signed(s.digitalVariance)}` : null].filter(Boolean).join(', ');
      L.push(`• ${s.name}${times(s)}: ${plural(s.bills, 'bill')} · ${rupees(s.sales)}${tail ? ` · ${tail}` : ''}`);
    }
  }

  const c = d.cash;
  if (c.opening !== null) {
    L.push('', 'Cash in the drawer');
    L.push(`Opening ${rupees(c.opening)} + cash sales ${rupees(c.cashSales)}`);
    const out: string[] = [];
    if (c.expenses) out.push(`expenses ${rupees(c.expenses)}`);
    if (c.refunds) out.push(`refunds ${rupees(c.refunds)}`);
    if (c.deposits) out.push(`banked ${rupees(c.deposits)}`);
    if (out.length) L.push(`Paid out: ${out.join(' · ')}`);
    if (c.expected !== null) L.push(`Expected ${rupees(c.expected)}${c.counted !== null ? `, counted ${rupees(c.counted)} — ${signed(c.counted - c.expected)}` : ''}`);
  }
  if (d.expensesByCategory.length) L.push(`Expenses: ${d.expensesByCategory.slice(0, 5).map((e) => `${e.category} ${rupees(e.total)}`).join(' · ')}`);

  const buy: string[] = [];
  if (d.purchases.invoices) buy.push(`purchases received ${rupees(d.purchases.total)} (${plural(d.purchases.invoices, 'invoice')})`);
  if (d.overdueInvoices) buy.push(`${plural(d.overdueInvoices, 'vendor invoice')} overdue`);
  if (buy.length) L.push('', `Buying: ${buy.join(' · ')}`);

  const stock: string[] = [];
  if (d.audits.finished) stock.push(`${plural(d.audits.finished, 'audit')} counted${d.audits.linesChanged ? ` (${plural(d.audits.linesChanged, 'line')} changed)` : ''}`);
  if (d.audits.signedOff) stock.push(`${d.audits.signedOff} signed off`);
  if (d.adjustments.approvedToday) stock.push(`${plural(d.adjustments.approvedToday, 'adjustment')} approved today`);
  if (stock.length) L.push(`Stock: ${stock.join(' · ')}`);

  // what needs attention, each with its amount or age
  const flags: string[] = [];
  for (const s of d.shifts) {
    if (s.cashVariance !== null && Math.abs(s.cashVariance) > TOLERANCE) flags.push(`${s.name}: drawer ${signed(s.cashVariance)}`);
    if (Math.abs(s.digitalVariance) > TOLERANCE) flags.push(`${s.name}: UPI/card ${signed(s.digitalVariance)}`);
    if (isOpen(s)) flags.push(`${s.name} is still open`);
  }
  if (d.adjustments.pending) flags.push(`${plural(d.adjustments.pending, 'stock adjustment')} waiting${d.adjustments.oldestDays ? `, the oldest ${plural(d.adjustments.oldestDays, 'day')}` : ''}`);
  if (d.complaints.open) flags.push(`${d.complaints.open} open complaint${d.complaints.open === 1 ? '' : 's'}${d.complaints.opened ? ` (${d.complaints.opened} new today)` : ''}`);
  L.push('', flags.length ? 'To look at' : '✅ Nothing to look at', ...flags.map((f) => `• ${f}`));
  return L.join('\n').slice(0, 4000);
}
