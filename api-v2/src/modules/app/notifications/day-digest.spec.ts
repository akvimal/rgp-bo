import { DayFacts, formatDayManager, groupDetailLines } from './day-digest';
import { formatStoreDaily } from './message-formatter';
import { StoreDigest } from './daily-digest.builder';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const facts = (over: Partial<DayFacts> = {}): DayFacts => ({
  shifts: [
    { name: 'Shift 1', start: '08:00', end: '14:00', status: 'CLOSED', handover: true, bills: 30, sales: 9100, cashSales: 4100, cashVariance: 0, digitalVariance: 0 },
    { name: 'Shift 2', start: '14:00', end: '22:00', status: 'CLOSED', handover: false, bills: 42, sales: 18450.5, cashSales: 9200, cashVariance: -37, digitalVariance: 0 },
  ],
  customers: { newCount: 5, returning: 18, none: 19 },
  purchases: { invoices: 2, total: 64500 },
  audits: { finished: 1, signedOff: 1, linesChanged: 3 },
  adjustments: { pending: 2, oldestDays: 3, approvedToday: 1 },
  complaints: { opened: 1, open: 2 },
  cash: { opening: 1000, cashSales: 13300, expenses: 351, refunds: 150, deposits: 8000, expected: 5799, counted: 5762 },
  expensesByCategory: [{ category: 'Courier', total: 201 }, { category: 'Tea', total: 150 }],
  overdueInvoices: 4, ...over,
});
const head = { store: 'Main Store', dateLabel: 'Sun, 01 Nov 2026', sales: 27550.5, bills: 72, prevSales: 25000 };

describe('the daily digest detail', () => {
  it('gives the store group the day by shift, customers, purchases, stock and complaints with no cash and no amounts of a difference', () => {
    const text = groupDetailLines(facts(), esc).join('\n');
    expect(text).toContain('Shift 1 (08:00-14:00): 30 bills');
    expect(text).toContain('handed over');
    expect(text).toContain('Shift 2 (14:00-22:00): 42 bills');
    expect(text).toContain('1 shift with a difference, with the store head to check');
    expect(text).toContain('Customers on record: 23 (5 new, 18 returning) · 19 bills without a customer');
    expect(text).toContain('Purchases received: 2 invoices');
    expect(text).toContain('1 audit counted · 1 signed off · 2 adjustments waiting for approval');
    expect(text).toContain('Complaints: 1 new today, 2 open');
    // the drawer, the money paid out, the purchase total and the size of a difference stay out of the group
    expect(text).not.toMatch(/cash|drawer|expense|banked|deposit|refund|variance|short|over |64,500|351|\b37\b|5,799|5,762/i);
  });

  it('is added to the store message without breaking the existing wording', () => {
    const store: StoreDigest = { storeid: 1, location: 'Main Store', sales: 27550.5, bills: 72, prevsales: 25000, returns: 0, topproducts: [], closedshifts: 2, openshifts: 0 };
    const plain = formatStoreDaily(store, '2026-11-01');
    const full = formatStoreDaily(store, '2026-11-01', facts());
    expect(full.startsWith(plain)).toBe(true);
    expect(full).toContain('<b>By shift</b>');
  });

  it('says every closed shift matches when none differ, and flags a shift still open', () => {
    const clean = facts({ shifts: [{ name: 'Shift 1', start: null, end: null, status: 'CLOSED', handover: false, bills: 3, sales: 100, cashSales: 100, cashVariance: 0.4, digitalVariance: 0 }] });
    expect(groupDetailLines(clean, esc).join('\n')).toContain('Every closed shift matches its bills');
    const open = facts({ shifts: [{ name: 'Late', start: null, end: null, status: 'OPEN', handover: false, bills: 0, sales: 0, cashSales: 0, cashVariance: null, digitalVariance: 0 }] });
    const t = groupDetailLines(open, esc).join('\n');
    expect(t).toContain('Late: 0 bills');
    expect(t).toContain('still open');
    expect(t).not.toContain('Every closed shift');
  });

  it('gives the people who run the shop the cash movement, expenses and each difference with its amount', () => {
    const text = formatDayManager(head, facts());
    expect(text.split('\n')[0]).toContain('Main Store');
    expect(text).toContain('Sales ₹27,550.50 (+10.2% vs yesterday) · 72 bills');
    expect(text).toContain('Opening ₹1,000 + cash sales ₹13,300');
    expect(text).toContain('Paid out: expenses ₹351 · refunds ₹150 · banked ₹8,000');
    expect(text).toContain('Expected ₹5,799, counted ₹5,762 — short ₹37');
    expect(text).toContain('Expenses: Courier ₹201 · Tea ₹150');
    expect(text).toContain('Shift 2 (14:00-22:00): 42 bills');
    expect(text).toContain('drawer short ₹37');
    expect(text).toContain('purchases received ₹64,500 (2 invoices)');
    expect(text).toContain('4 vendor invoices overdue');
    expect(text).toContain('To look at');
    expect(text).toContain('2 stock adjustments waiting, the oldest 3 days');
    expect(text).toContain('2 open complaints (1 new today)');
  });

  it('says plainly when there is nothing to look at, and copes with a day with no shift', () => {
    const calm = facts({
      shifts: [{ name: 'Shift 1', start: null, end: null, status: 'CLOSED', handover: false, bills: 1, sales: 50, cashSales: 50, cashVariance: 0, digitalVariance: 0 }],
      adjustments: { pending: 0, oldestDays: null, approvedToday: 0 }, complaints: { opened: 0, open: 0 },
      cash: { opening: 100, cashSales: 50, expenses: 0, refunds: 0, deposits: 0, expected: 150, counted: 150 },
    });
    expect(formatDayManager(head, calm)).toContain('Nothing to look at');
    const none = facts({ shifts: [], customers: { newCount: 0, returning: 0, none: 0 }, cash: { opening: null, cashSales: 0, expenses: 0, refunds: 0, deposits: 0, expected: null, counted: null }, expensesByCategory: [], purchases: { invoices: 0, total: 0 }, audits: { finished: 0, signedOff: 0, linesChanged: 0 }, adjustments: { pending: 0, oldestDays: null, approvedToday: 0 }, complaints: { opened: 0, open: 0 }, overdueInvoices: 0 });
    const t = formatDayManager({ ...head, sales: 0, bills: 0, prevSales: 0 }, none);
    expect(t).toContain('No customers on record');
    expect(t).not.toContain('Cash in the drawer');
    expect(t).not.toContain('NaN');
    expect(groupDetailLines(none, esc).join('\n')).toBe('');
  });
});
