import { DayFacts, dayReconciled, formatDayGroup, formatDayManager, sumDigital, weekCompare } from './day-summary-rules';
import { ShiftFacts } from './shift-digest-rules';

const total = (over: Partial<ShiftFacts> = {}): ShiftFacts => ({
  store: 'Main Store', shiftName: 'The day', start: null, end: null, handover: false, closedBy: null,
  bills: 96, items: 310, sales: 41250.5, cashSales: 21000, digitalSales: 19650.5, creditSales: 600, returns: 3,
  customersNew: 9, customersReturning: 40, billsWithoutCustomer: 47, scheduledEntries: 5,
  expectedCash: 21800, countedCash: 21763, digital: [{ provider: 'PAYTM', system: 19650.5, counted: 19650.5, variance: 0 }],
  expensesCount: 3, expensesTotal: 520, refunds: 150, deposits: 5000,
  byStaff: [{ name: 'Asha K', bills: 60, sales: 26000 }, { name: 'Ravi S', bills: 36, sales: 15250.5 }], ...over,
});

const day = (over: Partial<DayFacts> = {}, t: Partial<ShiftFacts> = {}): DayFacts => ({
  total: total(t), dateLabel: 'Mon 17 Nov 2026',
  shifts: [
    { name: 'Morning', start: '09:00', end: '14:00', closedBy: 'Asha K', handover: true, bills: 50, sales: 20000, cashVariance: 0, digitalOff: false },
    { name: 'Evening', start: '14:00', end: '22:00', closedBy: 'Ravi S', handover: false, bills: 46, sales: 21250.5, cashVariance: -37, digitalOff: false },
  ],
  lastWeek: { label: 'Monday', sales: 36000, bills: 88 }, ...over,
});

describe('the day summary sent when the day ends', () => {
  it('gives the store group the day without any cash amount, difference or name', () => {
    const text = formatDayGroup(day());
    expect(text).toContain('Main Store — the day, Mon 17 Nov 2026');
    expect(text).toContain('96 bills · 310 items · sales ₹41,250.50');
    expect(text).toContain('Shifts: 2 (Morning (09:00-14:00), Evening (14:00-22:00))');
    expect(text).toContain('A difference is with the store head to check');
    expect(text).not.toMatch(/Drawer|expected|counted|expenses|Asha|Ravi|21,763|21,800|36,000/);
    expect(text).not.toContain('37');
  });

  it('tells the group when every shift matched', () => {
    const ok = day({ shifts: [{ name: 'Day', start: null, end: null, closedBy: null, handover: false, bills: 96, sales: 41250.5, cashVariance: 0, digitalOff: false }] }, { countedCash: 21800 });
    expect(dayReconciled(ok)).toBe(true);
    expect(formatDayGroup(ok)).toContain('Cash and UPI/card match the bills');
  });

  it('gives the people who run the shop each shift, the drawers, who served and the week\'s comparison', () => {
    const text = formatDayManager(day());
    expect(text).toContain('Main Store — the day, Mon 17 Nov 2026');
    expect(text).toContain('Bills by staff:');
    expect(text).toContain('• Asha K: 60 bills');
    expect(text).toContain('Last Monday: ₹36,000 (↑ 15%)');
    expect(text).toContain('• Morning (09:00-14:00) (handed over): 50 bills · ₹20,000 · Asha K — drawer matches');
    expect(text).toContain('• Evening (14:00-22:00): 46 bills · ₹21,250.50 · Ravi S — drawer short ₹37');
    expect(text).toContain('Drawers: expected ₹21,800, counted ₹21,763 — short ₹37');
    expect(text).toContain('Paid from the drawers: expenses ₹520 (3) · refunds ₹150 · banked ₹5,000');
    expect(text).toContain('Not reconciled: Evening');
  });

  it('names the shift whose terminal did not match', () => {
    const f = day({ shifts: [
      { name: 'Morning', start: null, end: null, closedBy: null, handover: true, bills: 50, sales: 20000, cashVariance: 0, digitalOff: true },
      { name: 'Evening', start: null, end: null, closedBy: null, handover: false, bills: 46, sales: 21250.5, cashVariance: 0, digitalOff: false }] }, { countedCash: 21800 });
    expect(formatDayManager(f)).toContain('terminals differ');
    expect(formatDayManager(f)).toContain('Not reconciled: Morning');
  });

  it('compares with last week only when there is something to compare with', () => {
    expect(weekCompare(41250.5, { label: 'Monday', sales: 36000 })).toBe('Last Monday: ₹36,000 (↑ 15%)');
    expect(weekCompare(30000, { label: 'Monday', sales: 36000 })).toBe('Last Monday: ₹36,000 (↓ 17%)');
    expect(weekCompare(36000, { label: 'Monday', sales: 36000 })).toBe('Last Monday: ₹36,000 (the same)');
    expect(weekCompare(100, null)).toBe('');
    expect(weekCompare(100, { label: 'Monday', sales: 0 })).toBe('');
    expect(formatDayManager(day({ lastWeek: null }))).not.toContain('Last ');
  });

  it('adds the terminals up by provider across the shifts', () => {
    const sum = sumDigital([
      [{ provider: 'PAYTM', system: 100, counted: 100, variance: 0 }, { provider: 'CARD', system: 50, counted: 45, variance: -5 }],
      [{ provider: 'PAYTM', system: 200.5, counted: 199, variance: -1.5 }],
    ]);
    expect(sum.find((d) => d.provider === 'PAYTM')).toEqual({ provider: 'PAYTM', system: 300.5, counted: 299, variance: -1.5 });
    expect(sum.find((d) => d.provider === 'CARD')?.variance).toBe(-5);
  });

  it('stays within a Telegram message', () => {
    const many = day({}, { expenseLines: Array.from({ length: 400 }, (_, i) => ({ label: `Expense number ${i}`, amount: 10 })) });
    expect(formatDayManager(many).length).toBeLessThanOrEqual(4000);
  });
});
