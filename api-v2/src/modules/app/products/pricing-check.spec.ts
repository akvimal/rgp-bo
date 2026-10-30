import { analysePrices, CheckLine } from './pricing-check';

const lines = (discounts: number[], extra: Partial<CheckLine> = {}): CheckLine[] => discounts.map((d) => ({ discountPct: d, markupPct: 20, action: 'NONE', ...extra }));

describe('analysePrices', () => {
  it('puts each price in a band by how far below the MRP it is, and counts those above the ceiling and below cost', () => {
    const r = analysePrices([...lines([0, 0.2, 3, 7, 12, 20, 40]), { discountPct: -4, markupPct: 30, action: 'CUT' }, { discountPct: 10, markupPct: -5, action: 'NONE' }]);
    expect(r.products).toBe(9);
    expect(r.atMrp).toBe(2);
    expect(r.aboveCeiling).toBe(1);
    expect(r.belowCost).toBe(1);
    expect(Object.fromEntries(r.bands.map((b) => [b.key, b.count]))).toEqual({ mrp: 2, d5: 1, d10: 1, d15: 2, d25: 1, d99: 1 });
  });

  it('recommends pricing at the MRP when most products are at the MRP', () => {
    const r = analysePrices(lines([0, 0, 0, 0, 0, 0, 0, 0, 5, 12]));
    expect(r.recommendation.mode).toBe('MRP');
  });

  it('recommends a discount, with a usual and a deepest value taken from the prices, when most sit a little below the MRP', () => {
    const r = analysePrices(lines([5, 8, 10, 10, 10, 12, 12, 14, 15, 18, 0, 0]));
    expect(r.recommendation.mode).toBe('DISCOUNT');
    expect(r.recommendation.discountPct).toBe(10);
    expect(r.recommendation.maxDiscountPct).toBe(15);
  });

  it('keeps smart groups when the prices are spread out or too few to tell', () => {
    expect(analysePrices(lines([0, 10, 35, 50, 60, 70, 45, 80, 38, 90, 33])).recommendation.mode).toBe('SMART');
    expect(analysePrices(lines([0, 0, 0])).recommendation.mode).toBe('SMART');
  });

  it('counts products whose pack looks wrong and ignores prices it cannot judge', () => {
    const r = analysePrices([...lines([0, 0]), { discountPct: null, markupPct: null, action: 'CHECK_COST', packsuspect: true }]);
    expect(r.suspect).toBe(1);
    expect(r.atMrp).toBe(2);
  });
});
