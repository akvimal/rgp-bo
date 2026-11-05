import { buildChanges, cleanPeriod, reasonLabel, withGst, ChangeRow } from './price-change-rules';

const row = (o: Partial<ChangeRow>): ChangeRow => ({ product_id: 1, title: 'Product', pack: 10, price: 110, prev_price: 100, eff: '2026-11-03', reason: 'Policy', mrp: null, sale_tax: 5, ...o });

describe('the price the customer pays', () => {
  it('adds the GST the till bills', () => expect(withGst(100, 5, null)).toBe(105));
  it('is the MRP itself when the price is the most the MRP allows', () => expect(withGst(114.28, 5, 120)).toBe(120));
  it('is not capped when the price is below the ceiling', () => expect(withGst(99, 5, 120)).toBe(103.95));
  it('a zero GST rate adds nothing', () => expect(withGst(80, 0, 100)).toBe(80));
});

describe('the changes in a period', () => {
  it('a price that went up is an increase, in what the customer pays', () => {
    const { increased, decreased } = buildChanges([row({})]);
    expect(decreased).toEqual([]);
    expect(increased).toHaveLength(1);
    expect(increased[0]).toMatchObject({ oldprice: 105, newprice: 115.5, change: 10.5, pct: 10, reasonlabel: 'Pricing policy' });
  });
  it('a price that came down is a decrease', () => {
    const { increased, decreased } = buildChanges([row({ price: 90, prev_price: 100 })]);
    expect(increased).toEqual([]);
    expect(decreased[0]).toMatchObject({ change: -10.5, pct: -10 });
  });
  it('two changes in the period are one line: from before the first to now, with the last reason', () => {
    const { increased } = buildChanges([row({ prev_price: 100, price: 105, reason: 'Market', eff: '2026-11-01' }), row({ prev_price: 105, price: 120, reason: 'MRP change', eff: '2026-11-04' })]);
    expect(increased).toHaveLength(1);
    expect(increased[0]).toMatchObject({ oldprice: 105, newprice: 126, reasonlabel: 'MRP change', effdate: '2026-11-04', changes: 2 });
  });
  it('a price that went up and came back is not a change', () => {
    const r = buildChanges([row({ prev_price: 100, price: 110, eff: '2026-11-01' }), row({ prev_price: 110, price: 100, eff: '2026-11-04' })]);
    expect(r.increased).toEqual([]); expect(r.decreased).toEqual([]);
  });
  it('a change too small to show on the bill is left out', () => {
    expect(buildChanges([row({ prev_price: 100, price: 100.001 })]).increased).toEqual([]);
  });
  it('the biggest changes come first: cuts by size of the cut, rises by size of the rise', () => {
    const { increased, decreased } = buildChanges([
      row({ product_id: 1, title: 'A', prev_price: 100, price: 105 }), row({ product_id: 2, title: 'B', prev_price: 100, price: 130 }),
      row({ product_id: 3, title: 'C', prev_price: 100, price: 95 }), row({ product_id: 4, title: 'D', prev_price: 100, price: 70 }),
    ]);
    expect(increased.map((c) => c.title)).toEqual(['B', 'A']);
    expect(decreased.map((c) => c.title)).toEqual(['D', 'C']);
  });
  it('a minimum percent hides the small ones', () => {
    const { increased } = buildChanges([row({ product_id: 1, prev_price: 100, price: 102 }), row({ product_id: 2, prev_price: 100, price: 120 })], 5);
    expect(increased.map((c) => c.productid)).toEqual([2]);
  });
  it('the MRP cap is honoured: a price raised to the ceiling shows the MRP', () => {
    const { increased } = buildChanges([row({ prev_price: 99, price: 114.28, mrp: 120, sale_tax: 5 })]);
    expect(increased[0]).toMatchObject({ oldprice: 103.95, newprice: 120 });
  });
});

describe('the words and the period', () => {
  it('reasons are given in plain words, and an unknown one is kept as typed', () => {
    expect(reasonLabel('Higher PTR')).toBe('Cost rise');
    expect(reasonLabel('Something else')).toBe('Something else');
    expect(reasonLabel(null)).toBe('');
  });
  it('the period is the last 14 days by default', () => expect(cleanPeriod(undefined, undefined, '2026-11-05')).toEqual({ from: '2026-10-22', to: '2026-11-05' }));
  it('takes what is asked for', () => expect(cleanPeriod('2026-11-01', '2026-11-04', '2026-11-05')).toEqual({ from: '2026-11-01', to: '2026-11-04' }));
  it('refuses a backwards or a longer than a year period', () => {
    expect(() => cleanPeriod('2026-11-05', '2026-11-01')).toThrow(/after the last day/);
    expect(() => cleanPeriod('2024-01-01', '2026-11-05')).toThrow(/year or less/);
  });
});
