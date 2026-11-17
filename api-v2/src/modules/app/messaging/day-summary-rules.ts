/**
 * The day summary sent to Telegram when the day's last shift is closed (the end-of-day close). Two versions of the same facts, as for a single shift: the store
 * group gets the day's bills and takings with no drawer amounts, no differences and no names; the people who run the shop get the cash, the differences, who
 * served how much and how the day compares with the same day last week. Pure: no framework and no database, relative imports only, so the wording is unit tested.
 */
import { ShiftFacts, TOLERANCE, body, cashVariance, detail, reconciled, rupees, signed } from './shift-digest-rules';

export interface DayShift {
  name: string;
  start: string | null;
  end: string | null;
  closedBy: string | null;
  handover: boolean;
  bills: number;
  sales: number;
  /** counted less expected for the drawer; null when it was not counted */
  cashVariance: number | null;
  /** the terminals disagreed with the system in this shift */
  digitalOff: boolean;
}

export interface DayFacts {
  /** the whole day laid out as one shift's facts, so the lines both versions share are written once (counts, takings, customers, staff, deliveries, expenses, drawer, terminals) */
  total: ShiftFacts;
  /** 'Mon 17 Nov 2026' */
  dateLabel: string;
  shifts: DayShift[];
  /** the same weekday a week ago: the sales and the number of bills; null when the store did not trade then */
  lastWeek: { label: string; sales: number; bills: number } | null;
}

/** how the day compares with the same day last week, in a few words; empty when there is nothing to compare with */
export function weekCompare(sales: number, last: { label: string; sales: number } | null): string {
  if (!last || !(last.sales > 0)) return '';
  const pct = Math.round(((sales - last.sales) / last.sales) * 100);
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '=';
  return `Last ${last.label}: ${rupees(last.sales)} (${pct === 0 ? 'the same' : `${arrow} ${Math.abs(pct)}%`})`;
}

const hours = (s: { start: string | null; end: string | null }) => (s.start && s.end ? ` (${s.start}-${s.end})` : '');

/** every shift closed clean: the drawers and the terminals agree with the bills */
export const dayReconciled = (f: DayFacts): boolean => f.shifts.every((s) => (s.cashVariance === null || Math.abs(s.cashVariance) <= TOLERANCE) && !s.digitalOff) && reconciled(f.total);

const shiftsLine = (f: DayFacts) => `Shifts: ${f.shifts.length} (${f.shifts.map((s) => `${s.name}${hours(s)}`).join(', ')})`;

/** for the store group: no cash amounts, no differences, no names (unless the owner chose the full version for the group) */
export function formatDayGroup(f: DayFacts, full = false): string {
  if (full) return formatDayManager(f);
  return [
    `\u{1F319} ${f.total.store} — the day, ${f.dateLabel}`,
    ...body(f.total),
    shiftsLine(f),
    dayReconciled(f) ? '✅ Cash and UPI/card match the bills' : '⚠️ A difference is with the store head to check',
  ].join('\n').slice(0, 4000);
}

/** for the people who run the shop: the day's facts, each shift on a line, the drawer, the terminals, the money that moved and the week's comparison */
export function formatDayManager(f: DayFacts): string {
  const t = f.total;
  const v = cashVariance(t);
  const lines = [
    `\u{1F319} ${t.store} — the day, ${f.dateLabel}`,
    ...body(t),
    ...detail(t),
  ];
  const cmp = weekCompare(t.sales, f.lastWeek);
  if (cmp) lines.push(cmp);
  lines.push('', 'Shifts:');
  for (const s of f.shifts) {
    const drawer = s.cashVariance === null ? 'drawer not counted' : `drawer ${signed(s.cashVariance)}`;
    lines.push(`• ${s.name}${hours(s)}${s.handover ? ' (handed over)' : ''}: ${s.bills} bill${s.bills === 1 ? '' : 's'} · ${rupees(s.sales)}${s.closedBy ? ` · ${s.closedBy}` : ''} — ${drawer}${s.digitalOff ? ', terminals differ' : ''}`);
  }
  lines.push('', `Drawers: expected ${rupees(t.expectedCash)}, counted ${t.countedCash === null ? 'not counted' : rupees(t.countedCash)}${v === null ? '' : ` — ${signed(v)}`}`);
  for (const d of t.digital) lines.push(`${d.provider}: system ${rupees(d.system)}, terminal ${rupees(d.counted)} — ${signed(d.variance)}`);
  const moved: string[] = [];
  if (t.expensesCount && !(t.expenseLines ?? []).length) moved.push(`expenses ${rupees(t.expensesTotal)} (${t.expensesCount})`);
  if (t.refunds) moved.push(`refunds ${rupees(t.refunds)}`);
  if (t.deposits) moved.push(`banked ${rupees(t.deposits)}`);
  if (moved.length) lines.push(`Paid from the drawers: ${moved.join(' · ')}`);
  const off = f.shifts.filter((s) => (s.cashVariance !== null && Math.abs(s.cashVariance) > TOLERANCE) || s.digitalOff).map((s) => s.name);
  lines.push(dayReconciled(f) ? '✅ Every shift reconciled' : `⚠️ Not reconciled${off.length ? `: ${off.join(', ')}` : ''}. Check in the app`);
  return lines.join('\n').slice(0, 4000);
}

/** the terminals' differences added up by provider across the day's shifts */
export function sumDigital(perShift: { provider: string; system: number; counted: number; variance: number }[][]): ShiftFacts['digital'] {
  const by = new Map<string, { provider: string; system: number; counted: number; variance: number }>();
  for (const list of perShift) for (const d of list) {
    const c = by.get(d.provider) || { provider: d.provider, system: 0, counted: 0, variance: 0 };
    c.system += d.system; c.counted += d.counted; c.variance += d.variance;
    by.set(d.provider, c);
  }
  return Array.from(by.values()).map((d) => ({ ...d, system: round2(d.system), counted: round2(d.counted), variance: round2(d.variance) }));
}
const round2 = (n: number) => Math.round(n * 100) / 100;

