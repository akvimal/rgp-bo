import { buildPriceList, priceListEntry } from './price-list';

const base = { id: 1, title: 'MONTU-L TAB 10\'S', pack: 10, sched: null, price_ex: 100, min_mrp: 200, tmax: 5 };

describe('price list', () => {
  it('shows what a customer pays: the price with GST, per pack and per unit', () => {
    const e = priceListEntry(base)!;
    expect(e.packIncl).toBe(105);
    expect(e.unitIncl).toBe(10.5);
    expect(e.mrp).toBe(200);
    expect(e.capped).toBe(false);
  });

  it('a pack of one has the same price per unit as per pack', () => {
    const e = priceListEntry({ ...base, pack: 1, price_ex: 50, min_mrp: 100 })!;
    expect(e.packIncl).toBe(52.5);
    expect(e.unitIncl).toBe(52.5);
  });

  it('is brought down to stay within the MRP of the cheapest batch in stock', () => {
    const e = priceListEntry({ ...base, price_ex: 200, min_mrp: 200 })!;       // 200 + 5% would be 210
    expect(e.capped).toBe(true);
    expect(e.packIncl).toBeLessThanOrEqual(200);
    expect(e.unitIncl).toBeLessThanOrEqual(20);
  });

  it('never prints a unit price above the MRP of a unit, whatever the rounding', () => {
    for (let mrp = 10; mrp <= 400; mrp += 7.3) {
      for (const pack of [1, 3, 7, 10, 14, 15, 30]) {
        const e = priceListEntry({ ...base, pack, price_ex: mrp * 2, min_mrp: +mrp.toFixed(2) })!;
        expect(e.packIncl).toBeLessThanOrEqual(+mrp.toFixed(2) + 1e-9);
        expect(e.unitIncl).toBeLessThanOrEqual(Math.floor((mrp / pack) * 100 + 1e-6) / 100 + 1e-9);
      }
    }
  });

  it('marks prescription-only products', () => {
    expect(priceListEntry({ ...base, sched: 'H1' })!.rx).toBe(true);
    expect(priceListEntry({ ...base, sched: 'h' })!.rx).toBe(true);
    expect(priceListEntry({ ...base, sched: '' })!.rx).toBe(false);
    expect(priceListEntry({ ...base, sched: null })!.rx).toBe(false);
  });

  it('leaves out what cannot be priced', () => {
    expect(priceListEntry({ ...base, price_ex: 0 })).toBeNull();
    expect(priceListEntry({ ...base, min_mrp: 0 })).toBeNull();
    expect(priceListEntry({ ...base, pack: 0 })).toBeNull();
  });

  it('is alphabetical, ignoring case', () => {
    const list = buildPriceList([{ ...base, id: 1, title: 'zinc tab' }, { ...base, id: 2, title: 'Amoxil cap' }, { ...base, id: 3, title: 'bandage' }, { ...base, id: 4, title: 'no price', price_ex: 0 }]);
    expect(list.map((e) => e.title)).toEqual(['Amoxil cap', 'bandage', 'zinc tab']);
  });
});
