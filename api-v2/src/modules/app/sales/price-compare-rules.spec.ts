import { customerPrice, gapPct, refUnit, RefItem, summarise, worstGap } from './price-compare-rules';

const item = (o: Partial<RefItem>): RefItem => ({ sourceId: 1, sourceName: 'PMBI Jan Aushadhi', kind: 'PMBI', name: 'Telmisartan 40 mg tablets', unitSize: "10's", packQty: 10, packKind: 'units', mrp: 30, sellPrice: null, composition: 'Telmisartan 40 mg', form: 'tablet', ...o });

describe('a list item per unit', () => {
  it('divides by the pack, and the PMBI list sells at its MRP', () => {
    expect(refUnit(item({}))).toEqual({ unitMrp: 3, unitSell: 3, perUnit: true });
  });
  it('another list has its own selling price, or none', () => {
    expect(refUnit(item({ kind: 'COMPETITOR', mrp: 120, sellPrice: 96 }))).toEqual({ unitMrp: 12, unitSell: 9.6, perUnit: true });
    expect(refUnit(item({ kind: 'COMPETITOR', mrp: 120, sellPrice: null }))).toEqual({ unitMrp: 12, unitSell: null, perUnit: true });
  });
  it('has no unit for a volume or weight pack', () => {
    expect(refUnit(item({ packKind: 'ml', packQty: 60 }))).toEqual({ unitMrp: null, unitSell: null, perUnit: false });
  });
});

describe('the shop price and the gap', () => {
  it('adds GST and never goes above the MRP', () => {
    expect(customerPrice(100, 5, 120)).toBe(105);
    expect(customerPrice(100, 12, 105)).toBe(105);
    expect(customerPrice(null, 5, 100)).toBeNull();
  });
  it('is the percent the shop is dearer (+) or cheaper (-)', () => {
    expect(gapPct(12, 10)).toBe(20);
    expect(gapPct(8, 10)).toBe(-20);
    expect(gapPct(null, 10)).toBeNull();
    expect(gapPct(10, 0)).toBeNull();
  });
});

describe('summary by list', () => {
  const items = [
    item({}),                                                                              // PMBI, 3 per unit
    item({ name: 'Telmisartan 40 mg tablets (15)', unitSize: "15's", packQty: 15, mrp: 60 }),   // PMBI, 4 per unit
    item({ sourceId: 2, sourceName: 'Apollo', kind: 'COMPETITOR', name: 'Telma 40', mrp: 128, sellPrice: 100 }),
    item({ sourceId: 2, sourceName: 'Apollo', kind: 'COMPETITOR', name: 'Telmi syrup', packKind: 'ml', packQty: 60, mrp: 90, sellPrice: 80, form: 'syrup' }),
    item({ sourceId: 3, sourceName: 'Other', kind: 'COMPETITOR', name: 'No unit', packKind: 'other', packQty: null, mrp: 50, sellPrice: 40 }),
  ];
  it('puts PMBI first, takes the cheapest selling price per unit and the gap against it', () => {
    const s = summarise(items, 'tablet', 5);
    expect(s.map((x) => x.sourceName)).toEqual(['PMBI Jan Aushadhi', 'Apollo', 'Other']);
    expect(s[0]).toMatchObject({ items: 2, unitMrp: { min: 3, max: 4 }, unitSell: { min: 3, max: 4 }, gap: 66.7 });
    expect(s[0].cheapest).toMatchObject({ unitSell: 3 });
    expect(s[1]).toMatchObject({ items: 1, unitSell: { min: 10, max: 10 }, gap: -50 });       // the syrup is another form and is left out
  });
  it('lists pack-only items apart and gives them no gap', () => {
    const s = summarise(items, 'tablet', 5);
    expect(s[2]).toMatchObject({ unitMrp: null, unitSell: null, gap: null });
    expect(s[2].perPackOnly).toHaveLength(1);
  });
  it('keeps every item when our form is not recorded', () => {
    expect(summarise(items, null, 5).find((x) => x.sourceName === 'Apollo')?.items).toBe(2);
  });
  it('takes the worst gap across lists', () => {
    expect(worstGap(summarise(items, 'tablet', 5))).toBe(66.7);
    expect(worstGap([])).toBeNull();
  });
});
