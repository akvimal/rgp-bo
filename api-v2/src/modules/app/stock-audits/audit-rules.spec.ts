import { auditNo, escalateAll, expectedQty, financialYear, matchRate, mayCertify, nextYearEnd, recountProblem, standardPlans, variance } from './audit-rules';

describe('stock audit rules', () => {
  it('numbers an audit as SA-0012', () => {
    expect(auditNo(12)).toBe('SA-0012');
    expect(auditNo(12345)).toBe('SA-12345');
  });

  it('finds the financial year, April to March', () => {
    expect(financialYear('2026-10-24')).toMatchObject({ start: '2026-04-01', end: '2027-03-31', label: '2026-27', year: 2026 });
    expect(financialYear('2027-03-31').label).toBe('2026-27');
    expect(financialYear('2027-04-01').label).toBe('2027-28');
  });

  it('puts the full count on the next 31 March', () => {
    expect(nextYearEnd('2026-10-24')).toBe('2027-03-31');
    expect(nextYearEnd('2027-03-31')).toBe('2027-03-31');
    expect(nextYearEnd('2027-04-01')).toBe('2028-03-31');
  });

  it('seeds weekly fast movers and rotation, monthly scheduled drugs and expiry, and a yearly full count', () => {
    const plans = standardPlans(['A', 'B', 'C'], '2026-10-24');
    expect(plans.map((p) => [p.scope, p.frequency_days]).sort()).toEqual([['ALL', 365], ['EXPIRY', 30], ['FAST', 7], ['ROTATE', 7], ['SCHEDULE', 30]]);
    expect(plans.find((p) => p.scope === 'ROTATE')!.categories).toEqual(['A', 'B', 'C']);
    expect(plans.find((p) => p.scope === 'ALL')!.first_due).toBe('2027-03-31');
  });

  it('leaves out the scheduled-drugs plan for a business that is not a pharmacy', () => {
    expect(standardPlans(['A', 'B'], '2026-10-24', { pharmacy: false }).some((p) => p.scope === 'SCHEDULE')).toBe(false);
    expect(standardPlans(['A', 'B'], '2026-10-24', { pharmacy: true }).some((p) => p.scope === 'SCHEDULE')).toBe(true);
    expect(standardPlans(['A', 'B'], '2026-10-24').some((p) => p.scope === 'SCHEDULE')).toBe(true);
  });

  it('skips the rotation when there are fewer than two categories', () => {
    expect(standardPlans(['A'], '2026-10-24').some((p) => p.scope === 'ROTATE')).toBe(false);
  });

  it('sends every difference in a scheduled-drug audit to the Business Head', () => {
    expect(escalateAll('SCHEDULE')).toBe(true);
    expect(escalateAll('FAST')).toBe(false);
    expect(escalateAll(null)).toBe(false);
  });

  it('needs two different signers, except for a one-person shop', () => {
    expect(mayCertify(5, 6, 'Store Head')).toEqual({ ok: true, alone: false });
    expect(mayCertify(5, 5, 'Store Head')).toEqual({ ok: false, alone: false });
    expect(mayCertify(5, 5, 'Business Head')).toEqual({ ok: false, alone: false });
    expect(mayCertify(5, 5, 'Owner-operator')).toEqual({ ok: true, alone: true });
    expect(mayCertify(null, 5, 'Store Head')).toEqual({ ok: true, alone: false });
  });

  it('measures the match rate over the lines that were counted', () => {
    expect(matchRate([{ book_qty: 5, counted_qty: 5 }, { book_qty: 5, counted_qty: 4 }, { book_qty: 3, counted_qty: null }])).toBe(50);
    expect(matchRate([])).toBe(0);
  });

  it('adds up short and excess at cost, and a recount replaces the first count', () => {
    const v = variance([
      { book_qty: 10, counted_qty: 8, unit_cost: 5 },                    // 2 short = 10
      { book_qty: 10, counted_qty: 13, unit_cost: 2 },                   // 3 excess = 6
      { book_qty: 10, counted_qty: 4, recount_qty: 9, unit_cost: 10 },   // recounted: 1 short = 10
      { book_qty: 4, counted_qty: null, unit_cost: 99 },                 // not counted
    ]);
    expect(v).toEqual({ shortUnits: 3, excessUnits: 3, shortValue: 20, excessValue: 6, netUnits: 0, netValue: -14 });
  });

  it('works out what should be on the shelf when counting finished', () => {
    expect(expectedQty(50, 2, 0)).toBe(48);          // two sold during the count
    expect(expectedQty(50, 2, 3)).toBe(51);          // and three came back as a return
    expect(expectedQty(50, 0, -5)).toBe(45);         // five written off as expired meanwhile
  });

  it('measures the difference against the expected quantity, not the book at the start', () => {
    // 50 on the book, 2 sold while counting, 48 counted: nothing is missing
    const lines = [{ book_qty: 50, expected_qty: 48, counted_qty: 48, unit_cost: 10 }, { book_qty: 50, expected_qty: 48, counted_qty: 47, unit_cost: 10 }];
    expect(matchRate(lines)).toBe(50);
    expect(variance(lines)).toEqual({ shortUnits: 1, excessUnits: 0, shortValue: 10, excessValue: 0, netUnits: -1, netValue: -10 });
    // a line with no expected quantity (an old count) falls back to the book
    expect(variance([{ book_qty: 10, counted_qty: 8, unit_cost: 1 }]).shortUnits).toBe(2);
  });

  it('holds a large difference until it has been counted again', () => {
    expect(recountProblem({ escalated: true, recount_qty: null })).toMatch(/count it again/);
    expect(recountProblem({ escalated: true, recount_qty: 3 })).toBeNull();
    expect(recountProblem({ escalated: false, recount_qty: null })).toBeNull();
  });
});
