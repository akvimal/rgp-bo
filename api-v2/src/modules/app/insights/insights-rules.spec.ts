import { CoachingFacts, WeeklyFacts, change, cleanBrief, cleanCoaching, cleanNarrative, expiryAction, periodRange, plainBrief, plainCoaching, plainWeekly, unsoldBeforeExpiry, weekBounds } from './insights-rules';

describe('periods and weeks', () => {
  // 2026-11-11 is a Wednesday
  it('turns a period into dates (from the first day to the day after the last)', () => {
    expect(periodRange('today', '2026-11-11')).toMatchObject({ from: '2026-11-11', to: '2026-11-12' });
    expect(periodRange('yesterday', '2026-11-11')).toMatchObject({ from: '2026-11-10', to: '2026-11-11' });
    expect(periodRange('this_week', '2026-11-11')).toMatchObject({ from: '2026-11-09', to: '2026-11-12' });
    expect(periodRange('last_week', '2026-11-11')).toMatchObject({ from: '2026-11-02', to: '2026-11-09' });
    expect(periodRange('last_7_days', '2026-11-11')).toMatchObject({ from: '2026-11-05', to: '2026-11-12' });
    expect(periodRange('this_month', '2026-11-11')).toMatchObject({ from: '2026-11-01', to: '2026-11-12' });
    expect(periodRange('last_month', '2026-11-11')).toMatchObject({ from: '2026-10-01', to: '2026-11-01' });
    expect(periodRange('last_month', '2026-01-15')).toMatchObject({ from: '2025-12-01', to: '2026-01-01' });
    expect(periodRange('this_year', '2026-11-11')).toMatchObject({ from: '2026-01-01' });
  });
  it('refuses a period it does not know', () => { expect(periodRange('fortnight', '2026-11-11')).toBeNull(); });

  it('finds the last full week and the one before it', () => {
    expect(weekBounds('2026-11-11')).toEqual({ start: '2026-11-02', end: '2026-11-08', prevStart: '2026-10-26', prevEnd: '2026-11-01' });
    expect(weekBounds('2026-11-09')).toEqual({ start: '2026-11-02', end: '2026-11-08', prevStart: '2026-10-26', prevEnd: '2026-11-01' });   // a Monday
    expect(weekBounds('2026-11-08').start).toBe('2026-10-26');                                                                              // a Sunday still belongs to the week that is not over
  });
});

describe('change', () => {
  it('gives the difference and the per cent, and none when there was nothing before', () => {
    expect(change(120, 100)).toEqual({ abs: 20, pct: 20, dir: 'up' });
    expect(change(80, 100)).toEqual({ abs: -20, pct: -20, dir: 'down' });
    expect(change(5, 0)).toEqual({ abs: 5, pct: null, dir: 'up' });
    expect(change(100, 100).dir).toBe('flat');
  });
});

describe('stock that will not sell before it expires', () => {
  it('counts what is left on the expiry day at the current rate', () => {
    expect(unsoldBeforeExpiry({ qty: 100, daysLeft: 60, perDay: 1 })).toBe(40);
    expect(unsoldBeforeExpiry({ qty: 100, daysLeft: 60, perDay: 2 })).toBe(0);
    expect(unsoldBeforeExpiry({ qty: 10, daysLeft: 30, perDay: 0 })).toBe(10);          // nothing sells
    expect(unsoldBeforeExpiry({ qty: 0, daysLeft: 30, perDay: 1 })).toBe(0);
    expect(unsoldBeforeExpiry({ qty: 10, daysLeft: -1, perDay: 1 })).toBe(0);           // already expired is another list
  });
  it('suggests returning early, selling first, or discounting', () => {
    expect(expiryAction({ qty: 100, daysLeft: 150, perDay: 0.2, unsold: 70 })).toBe('return to vendor');
    expect(expiryAction({ qty: 100, daysLeft: 60, perDay: 1.2, unsold: 28 })).toBe('sell first');
    expect(expiryAction({ qty: 100, daysLeft: 60, perDay: 0.2, unsold: 88 })).toBe('discount to clear');
    expect(expiryAction({ qty: 100, daysLeft: 60, perDay: 5, unsold: 0 })).toBe('watch');
  });
});

const weekly = (over: Partial<WeeklyFacts> = {}): WeeklyFacts => ({
  week: { start: '2026-11-02', end: '2026-11-08' },
  sales: { value: 120000, bills: 300, avgBill: 400, prevValue: 100000, prevBills: 280 },
  mix: { cash: 60000, digital: 50000, credit: 10000 },
  margin: { pct: 24, prevPct: 22, coverage: 95 },
  topProducts: [{ name: 'Paracetamol 650', value: 9000 }, { name: 'ORS', value: 7000 }],
  topStaff: [{ name: 'Asha', bills: 150, value: 70000 }, { name: 'Ravi', bills: 150, value: 50000 }],
  expenses: { total: 3000, prevTotal: 2000 },
  returns: { count: 2, value: 400 },
  dues: { outstanding: 8000, customers: 5 },
  expiry: { atRiskValue: 12000, atRiskBatches: 4, expiredValue: 0 },
  stock: { outOfStockSelling: 3 },
  shifts: { closed: 7, withDifference: 1 },
  attendance: { late: 2, missing: 0 },
  deliveries: { total: 10, failed: 1 },
  ...over,
});

describe('the weekly summary in plain words', () => {
  it('says how sales moved and what to look at, with something to do first', () => {
    const n = plainWeekly(weekly());
    expect(n.headline).toContain('Rs 1,20,000');
    expect(n.headline).toContain('up Rs 20,000 (+20%)');
    expect(n.wins.join(' ')).toContain('Gross margin improved to 24% from 22%');
    expect(n.wins.join(' ')).toContain('Paracetamol 650');
    expect(n.watch.join(' ')).toContain('4 batches worth Rs 12,000');
    expect(n.watch.join(' ')).toContain('3 products that sold recently are out of stock');
    expect(n.watch.join(' ')).toContain('5 customers owe Rs 8,000');
    expect(n.watch.join(' ')).toContain('1 shift of 7');
    expect(n.doFirst.length).toBeGreaterThan(0);
    expect(n.doFirst.length).toBeLessThanOrEqual(4);
  });
  it('copes with a quiet week and with nothing wrong', () => {
    expect(plainWeekly(weekly({ sales: { value: 0, bills: 0, avgBill: 0, prevValue: 0, prevBills: 0 } })).headline).toBe('No sales were recorded last week.');
    const calm = plainWeekly(weekly({ expiry: { atRiskValue: 0, atRiskBatches: 0, expiredValue: 0 }, stock: { outOfStockSelling: 0 }, dues: { outstanding: 0, customers: 0 }, shifts: { closed: 7, withDifference: 0 }, attendance: { late: 0, missing: 0 }, deliveries: { total: 4, failed: 0 }, expenses: { total: 2000, prevTotal: 2000 }, margin: null }));
    expect(calm.watch).toEqual([]);
    expect(calm.doFirst[0]).toContain('Nothing urgent');
  });
  it('flags a fall in sales and a slipping margin', () => {
    const n = plainWeekly(weekly({ sales: { value: 80000, bills: 250, avgBill: 320, prevValue: 100000, prevBills: 280 }, margin: { pct: 20, prevPct: 23, coverage: 90 } }));
    expect(n.watch.join(' ')).toContain('Sales fell Rs 20,000 (-20%)');
    expect(n.watch.join(' ')).toContain('Gross margin slipped to 20% from 23%');
  });
});

const coaching = (over: Partial<CoachingFacts> = {}): CoachingFacts => ({
  period: '2026-10', role: 'Sales Staff',
  kpi: { percent: 72, band: 'Good', prevPercent: 80, teamAvg: 81, measures: [{ name: 'Accuracy', points: 9, max: 10 }, { name: 'Upselling', points: 3, max: 10 }, { name: 'Service', points: 6, max: 10 }] },
  attendance: { present: 22, late: 4, earlyOut: 0, prevPresent: 24 },
  sales: { bills: 200, value: 90000, prevBills: 260, prevValue: 120000, teamAvgBills: 280 },
  leaveDays: 1, ...over,
});

describe('the staff coaching note in plain words', () => {
  it('names what went well, where to focus, a tip, and what to say', () => {
    const c = plainCoaching(coaching());
    expect(c.strengths.join(' ')).toContain('Accuracy');
    expect(c.focus.join(' ')).toContain('fell 8 points');
    expect(c.focus.join(' ')).toContain('below the team average of 81%');
    expect(c.focus.join(' ')).toContain('Upselling scored 3 of 10');
    expect(c.focus.join(' ')).toContain('4 late arrivals');
    expect(c.focus.join(' ')).toContain('Sales served fell 25%');
    expect(c.tips.length).toBeGreaterThan(0);
    expect(c.talk[0]).toContain('what went well');
  });
  it('has praise and no problems for a strong, punctual month', () => {
    const c = plainCoaching(coaching({
      kpi: { percent: 92, band: 'Excellent', prevPercent: 85, teamAvg: 80, measures: [{ name: 'Accuracy', points: 10, max: 10 }, { name: 'Service', points: 9, max: 10 }] },
      attendance: { present: 24, late: 0, earlyOut: 0, prevPresent: 24 }, sales: { bills: 300, value: 150000, prevBills: 250, prevValue: 120000, teamAvgBills: 250 },
    }));
    expect(c.strengths.join(' ')).toContain('92%');
    expect(c.strengths.join(' ')).toContain('On time every day');
    expect(c.focus).toEqual(['Nothing stands out as a problem this month.']);
  });
  it('works with no KPI and no sales yet', () => {
    const c = plainCoaching(coaching({ kpi: null, sales: null, attendance: { present: 5, late: 0, earlyOut: 0, prevPresent: 0 } }));
    expect(c.strengths.length).toBeGreaterThan(0);
    expect(c.talk.length).toBeGreaterThan(1);
  });
});

describe('cleaning what the assistant returns', () => {
  const fb = plainWeekly(weekly());
  it('keeps a good answer, trimmed and limited', () => {
    const n = cleanNarrative({ headline: '  Sales rose.  ', wins: ['a', 'b'], watch: ['c'], do_first: ['d'] }, fb);
    expect(n).toEqual({ headline: 'Sales rose.', wins: ['a', 'b'], watch: ['c'], doFirst: ['d'] });
    expect(cleanNarrative({ headline: 'x', wins: Array(20).fill('y'), watch: [] }, fb).wins).toHaveLength(5);
  });
  it('falls back to the plain version when the answer is empty or malformed', () => {
    expect(cleanNarrative({}, fb)).toBe(fb);
    expect(cleanNarrative(null, fb)).toBe(fb);
    expect(cleanNarrative({ headline: 'x', wins: 'not a list', watch: 5 }, fb)).toBe(fb);
  });
  it('does the same for coaching', () => {
    const fc = plainCoaching(coaching());
    expect(cleanCoaching({ strengths: ['good'], focus: ['f'], tips: ['t'], talk_points: ['p'] }, fc)).toEqual({ strengths: ['good'], focus: ['f'], tips: ['t'], talk: ['p'] });
    expect(cleanCoaching({}, fc)).toBe(fc);
  });
});

describe('the buying brief', () => {
  const reorder = [
    { title: 'ORS Powder', qty: 40, daysLeft: 3, reasons: ['Low Stock', 'Fast Moving'] },
    { title: 'Vitamin C', qty: 20, daysLeft: 25, reasons: ['Low Stock'] },
    { title: 'Old tonic', qty: 5, daysLeft: null, reasons: ['Slow Mover'] },
    { title: 'Cough syrup', qty: 12, daysLeft: 5, reasons: ['Low Stock'] },
  ];
  const risk = [{ product: 'Antacid gel', unsold: 30, value: 2100, daysLeft: 90, action: 'discount to clear' }];
  it('puts what is nearly out first and says what to clear', () => {
    const b = plainBrief(reorder, risk);
    expect(b.buyFirst[0]).toContain('ORS Powder');
    expect(b.buyFirst.join(' ')).toContain('Cough syrup');
    expect(b.buyFirst.join(' ')).not.toContain('Vitamin C');
    expect(b.clear[0]).toBe('Antacid gel: 30 units (Rs 2,100 at cost) will not sell in 90 days. Discount to clear.');
    expect(b.watch[0]).toContain('slow mover');
    expect(b.headline).toBe('4 products to order, and Rs 2,100 of stock at risk of expiring unsold.');
  });
  it('is calm when there is nothing to do, and falls back when the answer is empty', () => {
    expect(plainBrief([], []).headline).toContain('Nothing needs ordering');
    const fb = plainBrief(reorder, risk);
    expect(cleanBrief({}, fb)).toBe(fb);
    expect(cleanBrief({ headline: 'h', buy_first: ['a'], clear: [] }, fb)).toEqual({ headline: 'h', buyFirst: ['a'], clear: [], watch: [] });
  });
});
