import { expectedSales, salesScoreVs, suggestedTarget, cashScore, combine, complianceScore, customersScore, purchasingScore, salesScore, serviceScore, stockScore } from './dashboard-health';

const settings = { weights: { sales: 25, stock: 15, cash: 15, purchasing: 10, customers: 10, compliance: 15, service: 10 }, healthyMin: 80, holdBelow: 60 };
const all = (n: number) => ({ sales: n, stock: n, cash: n, purchasing: n, customers: n, compliance: n, service: n });

describe('check scores', () => {
  it('sales is judged against the share of the target due by now, and is null without a target', () => {
    expect(salesScore(50, 100, 15, 30)).toBe(100);
    expect(salesScore(25, 100, 15, 30)).toBe(50);
    expect(salesScore(500, 100, 15, 30)).toBe(100);
    expect(salesScore(50, null, 15, 30)).toBeNull();
    expect(salesScore(50, 0, 15, 30)).toBeNull();
  });
  it('stock, service and customers have nothing to judge when there is nothing to count', () => {
    expect(stockScore(0, 0)).toBeNull();
    expect(stockScore(10, 9)).toBe(90);
    expect(serviceScore(0, 0)).toBeNull();
    expect(serviceScore(8, 6)).toBe(75);
    expect(customersScore(0, 0, 95)).toBeNull();
    expect(customersScore(100, 95, 95)).toBe(100);
    expect(customersScore(100, 47, 95)).toBe(49);
  });
  it('cash, purchasing and compliance start at full and lose points for what is wrong', () => {
    expect(cashScore(0)).toBe(100);
    expect(cashScore(2)).toBe(50);
    expect(cashScore(9)).toBe(0);
    expect(purchasingScore(0, 0)).toBe(100);
    expect(purchasingScore(1000, 250)).toBe(75);
    expect(complianceScore(0, 0)).toBe(100);
    expect(complianceScore(2, 1)).toBe(55);
    expect(complianceScore(20, 20)).toBe(0);
  });
});

describe('combine', () => {
  it('weights the checks and calls a high total with no weak check Healthy', () => {
    const r = combine(all(90), settings);
    expect(r.score).toBe(90);
    expect(r.status).toBe('healthy');
    expect(r.held).toBe(false);
  });
  it('scales the weights up when a check has no data, so it is not marked down for what it does not use', () => {
    const r = combine({ ...all(80), sales: null, service: null }, settings);
    expect(r.score).toBe(80);
    expect(r.checks.find((c) => c.key === 'sales')!.score).toBeNull();
  });
  it('holds at Watch when one check is under the safeguard, however high the total', () => {
    const r = combine({ ...all(100), compliance: 40 }, settings);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.status).toBe('watch');
    expect(r.held).toBe(true);
  });
  it('is Watch between the two thresholds and Act now below the safeguard', () => {
    expect(combine(all(70), settings).status).toBe('watch');
    expect(combine(all(70), settings).held).toBe(false);
    expect(combine(all(50), settings).status).toBe('act');
  });
  it('gives no score when no check has data', () => {
    const r = combine({}, settings);
    expect(r.score).toBeNull();
    expect(r.status).toBeNull();
  });
});

describe('sales basis', () => {
  const f = { target: 300000, day: 10, daysInMonth: 30, lastMonthSoFar: 90000, lastYearSoFar: 80000, recentMonthlyAvg: 240000 };
  it('target uses the share of the month gone, and is nothing without a target', () => {
    expect(expectedSales('target', f)).toEqual({ expected: 100000, source: 'target' });
    expect(expectedSales('target', { ...f, target: null })).toEqual({ expected: null, source: null });
  });
  it('"target or recent average" falls back to the recent months when there is no target', () => {
    expect(expectedSales('target or recent average', f).source).toBe('target');
    expect(expectedSales('target or recent average', { ...f, target: null })).toEqual({ expected: 80000, source: 'recent average' });
    expect(expectedSales('target or recent average', { ...f, target: null, recentMonthlyAvg: null })).toEqual({ expected: null, source: null });
  });
  it('last month and last year use the same days; off measures nothing', () => {
    expect(expectedSales('last month', f)).toEqual({ expected: 90000, source: 'last month' });
    expect(expectedSales('same period last year', f)).toEqual({ expected: 80000, source: 'same period last year' });
    expect(expectedSales('last month', { ...f, lastMonthSoFar: 0 }).expected).toBeNull();
    expect(expectedSales('off', f).expected).toBeNull();
  });
  it('an unknown basis behaves as the default', () => {
    expect(expectedSales('whatever', { ...f, target: null }).source).toBe('recent average');
  });
  it('scores sales against what was expected, with no score when nothing is expected', () => {
    expect(salesScoreVs(50000, 100000)).toBe(50);
    expect(salesScoreVs(150000, 100000)).toBe(100);
    expect(salesScoreVs(1, null)).toBeNull();
  });
});

describe('suggestedTarget', () => {
  it('is the same month last year plus growth, to the nearest hundred', () => {
    expect(suggestedTarget(250000, 200000, 10)).toEqual({ value: 275000, basis: 'same month last year' });
    expect(suggestedTarget(123456, null, 5)).toEqual({ value: 129600, basis: 'same month last year' });
  });
  it('uses the recent average when there is no history for the month, and nothing when there is none at all', () => {
    expect(suggestedTarget(0, 200000, 0)).toEqual({ value: 200000, basis: 'recent average' });
    expect(suggestedTarget(0, null, 10)).toEqual({ value: null, basis: null });
  });
});
