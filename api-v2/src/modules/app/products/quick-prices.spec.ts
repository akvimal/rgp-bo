import { quickPrices } from './quick-prices';

describe('the quick price pick', () => {
  it('lists the MRP and each step of the discount, and stops at the lowest price the class allows', () => {
    const l = quickPrices({ mrp: 100, tax: 0, lower: 85, step: 5, max: 4, basis: 'excl' });
    expect(l.rungs.map((r) => [r.pct, r.price, r.allowed])).toEqual([[0, 100, true], [5, 95, true], [10, 90, true], [15, 85, true], [20, 80, false]]);
    expect(l.deepest).toBeNull();                       // 15% off is already the lowest price: no extra choice
  });

  it('adds a "deepest allowed" choice when the lowest price falls between two steps', () => {
    const l = quickPrices({ mrp: 100, tax: 0, lower: 87, step: 5, max: 4, basis: 'excl' });
    expect(l.rungs.filter((r) => r.allowed).map((r) => r.pct)).toEqual([0, 5, 10]);
    expect(l.deepest).toEqual({ pct: 13, price: 87, shown: 87 });
  });

  it('offers every step when there is no lowest price to hold to', () => {
    const l = quickPrices({ mrp: 100, tax: 0, lower: null, step: 10, max: 3, basis: 'excl' });
    expect(l.rungs.every((r) => r.allowed)).toBe(true);
    expect(l.deepest).toBeNull();
  });

  it('keeps the stored price before GST and shows the one with GST when the business prices that way', () => {
    const l = quickPrices({ mrp: 105, tax: 5, lower: 91, step: 5, max: 3, basis: 'incl' });
    expect(l.rungs[0]).toMatchObject({ pct: 0, price: 100, shown: 105, allowed: true });       // at the MRP: the ceiling, shown as the MRP itself
    expect(l.rungs[1]).toMatchObject({ pct: 5, price: 95, shown: 99.75, allowed: true });
    expect(l.rungs[3]).toMatchObject({ pct: 15, allowed: false });                              // 89.25 with GST = 85 before GST, under 91
    expect(l.deepest).toMatchObject({ price: 91, shown: 95.55 });
  });

  it('offers nothing without an MRP', () => {
    expect(quickPrices({ mrp: 0, tax: 5, lower: null, step: 5, max: 4, basis: 'excl' })).toEqual({ rungs: [], deepest: null });
  });
});
