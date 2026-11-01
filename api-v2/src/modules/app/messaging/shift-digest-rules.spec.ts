import { ShiftFacts, formatShiftGroup, formatShiftManager, reconciled, rupees } from './shift-digest-rules';

const facts = (over: Partial<ShiftFacts> = {}): ShiftFacts => ({
  store: 'Main Store', shiftName: 'Shift 2', start: '14:00', end: '22:00', handover: false, closedBy: 'Asha K',
  bills: 42, items: 118, sales: 18450.5, cashSales: 9200, digitalSales: 8650.5, creditSales: 600, returns: 2,
  customersNew: 5, customersReturning: 18, billsWithoutCustomer: 19, scheduledEntries: 3,
  expectedCash: 9700, countedCash: 9663, digital: [{ provider: 'PAYTM', system: 8650.5, counted: 8650.5, variance: 0 }],
  expensesCount: 2, expensesTotal: 351, refunds: 150, deposits: 0, ...over,
});

describe('the shift-close message', () => {
  it('writes rupees the way they are read', () => {
    expect(rupees(18450.5)).toBe('₹18,450.50');
    expect(rupees(9200)).toBe('₹9,200');
    expect(rupees(1234567)).toBe('₹12,34,567');
  });

  it('gives the store group the shift without any cash amount, difference or name', () => {
    const text = formatShiftGroup(facts());
    expect(text).toContain('Main Store — Shift 2 (14:00-22:00) closed');
    expect(text).toContain('42 bills · 118 items · sales ₹18,450.50');
    expect(text).toContain('cash ₹9,200 · UPI/card ₹8,650.50 · credit ₹600');
    expect(text).toContain('Customers on record: 23 (5 new, 18 returning) · 19 bills without a customer');
    expect(text).toContain('Scheduled-drug entries: 3');
    // nothing about the drawer, expenses, the closer or the size of a difference
    expect(text).not.toMatch(/Drawer|expected|counted|expenses|short|over |Asha|9,700|9,663|351/);
    // the drawer is 37 short: the group is told only that someone is checking
    expect(text).toContain('A difference is with the store head to check');
    expect(text).not.toContain('37');
  });

  it('says plainly when everything matches, and for a handover', () => {
    const ok = facts({ countedCash: 9700, handover: true });
    expect(reconciled(ok)).toBe(true);
    expect(formatShiftGroup(ok)).toContain('handed over');
    expect(formatShiftGroup(ok)).toContain('Cash and UPI/card match the bills');
    // a rupee or less is not a difference
    expect(reconciled(facts({ countedCash: 9699.5 }))).toBe(true);
  });

  it('flags a terminal that does not match, without saying how much, in the group', () => {
    const f = facts({ countedCash: 9700, digital: [{ provider: 'PAYTM', system: 8650.5, counted: 7873.5, variance: -777 }] });
    expect(reconciled(f)).toBe(false);
    expect(formatShiftGroup(f)).not.toContain('777');
    expect(formatShiftManager(f)).toContain('PAYTM: system ₹8,650.50, terminal ₹7,873.50 — short ₹777');
  });

  it('gives the people who run the shop the drawer, the difference, who closed and what was paid out', () => {
    const text = formatShiftManager(facts());
    expect(text).toContain('closed by Asha K');
    expect(text).toContain('Drawer: expected ₹9,700, counted ₹9,663 — short ₹37');
    expect(text).toContain('Paid from the drawer: expenses ₹351 (2) · refunds ₹150');
    expect(text).toContain('Not reconciled: check the shift in the app');
    expect(formatShiftManager(facts({ countedCash: 9800 }))).toContain('over ₹100');
  });

  it('copes with a quiet shift and a shop with no register', () => {
    const none = facts({ bills: 0, items: 0, sales: 0, cashSales: 0, digitalSales: 0, creditSales: 0, returns: 0, customersNew: 0, customersReturning: 0, billsWithoutCustomer: 0, scheduledEntries: null, expensesCount: 0, expensesTotal: 0, refunds: 0, countedCash: 9700 });
    const text = formatShiftGroup(none);
    expect(text).toContain('0 bills · 0 items');
    expect(text).toContain('No customers on record');
    expect(text).not.toContain('Scheduled-drug');
    expect(formatShiftManager(none)).not.toContain('Paid from the drawer');
  });
});
