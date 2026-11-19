import { bucketOf, byDay, earliestDue, MedicineDue, ownDaysPerUnit, parseSupplyDays, runOut, stockState } from './refill-supply-rules';

const P = (day: number, qty: number) => ({ day, qty });

describe('supply of one medicine', () => {
  it('reads the days one unit lasts as typed on the product', () => {
    expect(parseSupplyDays('1')).toBe(1);
    expect(parseSupplyDays(' 0,5 ')).toBe(0.5);
    expect(parseSupplyDays('0')).toBeNull();
    expect(parseSupplyDays('abc')).toBeNull();
    expect(parseSupplyDays('')).toBeNull();
    expect(parseSupplyDays(null)).toBeNull();
    expect(parseSupplyDays('400')).toBeNull();
  });

  it('adds purchases made on the same day and ignores empty lines', () => {
    expect(byDay([P(10, 10), P(10, 20), P(5, 0), P(3, 4)])).toEqual([P(3, 4), P(10, 30)]);
  });

  it('learns the days per unit from the days between purchases and the units bought', () => {
    // 30 tablets lasted 30 days, then 60 tablets lasted 60 days: one day per tablet
    expect(ownDaysPerUnit([P(0, 30), P(30, 60), P(90, 30)])).toEqual({ rate: 1, intervals: 2 });
    // a half tablet a day: 30 tablets last 60 days
    expect(ownDaysPerUnit([P(0, 30), P(60, 30), P(120, 30)]).rate).toBe(2);
  });

  it('needs two intervals, and leaves out top-ups and breaks', () => {
    expect(ownDaysPerUnit([P(0, 30), P(30, 30)])).toEqual({ rate: null, intervals: 1 });
    // a top-up 3 days later and a 200 day break are not intervals
    expect(ownDaysPerUnit([P(0, 30), P(3, 10), P(33, 30), P(233, 30)]).intervals).toBe(1);
  });

  it('says when the last purchase runs out from the customer\'s own pattern, however many units they bought', () => {
    const r = runOut([P(0, 30), P(30, 30), P(60, 90)], null)!;       // 1 day a unit, then 90 units bought on day 60
    expect(r).toMatchObject({ basis: 'own', daysPerUnit: 1, supplyDays: 90, lastDay: 60, expectedDay: 150 });
  });

  it('falls back on the product\'s days per unit for one purchase, and prefers the customer\'s pattern once there is one', () => {
    expect(runOut([P(0, 60)], 0.5)).toMatchObject({ basis: 'product', supplyDays: 30, expectedDay: 30 });
    expect(runOut([P(0, 30), P(30, 30), P(60, 30)], 0.5)).toMatchObject({ basis: 'own', supplyDays: 30 });
  });

  it('gives no estimate without a pattern or a product default', () => {
    expect(runOut([P(0, 30)], null)).toBeNull();
    expect(runOut([], 1)).toBeNull();
  });

  it('keeps a supply between 3 days and a year', () => {
    expect(runOut([P(0, 1)], 1)!.supplyDays).toBe(3);
    expect(runOut([P(0, 1000)], 1)!.supplyDays).toBe(365);
  });

  it('buckets by days past due as the list always has', () => {
    expect(bucketOf(-3)).toBe('UPCOMING');
    expect(bucketOf(0)).toBe('UPCOMING');
    expect(bucketOf(1)).toBe('OVERDUE');
    expect(bucketOf(45)).toBe('OVERDUE');
    expect(bucketOf(46)).toBe('LAPSED');
  });

  it('says whether there is stock to sell the customer', () => {
    expect(stockState(0, 0)).toBe('none');
    expect(stockState(-4, 0)).toBe('none');
    expect(stockState(20, 0)).toBe('short');
    expect(stockState(20, 5)).toBe('ok');
  });

  it('is due when the earliest medicine runs out, and names those running out together', () => {
    const m = (id: number, expected: number): MedicineDue => ({ product_id: id, title: 'M' + id, last_day: 0, qty: 30, expected_day: expected, days_per_unit: 1, supply_days: expected, basis: 'own' });
    const r = earliestDue([m(1, 40), m(2, 30), m(3, 33), m(4, 90)])!;
    expect(r.expectedDay).toBe(30);
    expect(r.due.map((x) => x.product_id)).toEqual([2, 3]);
    expect(earliestDue([])).toBeNull();
  });
});
