import { overMrp, overMrpMessage, unitCeiling } from './mrp-guard';

const batches = new Map([[1, { unitMrp: 21.6, title: 'MONTU-L TAB 10\'S' }], [2, { unitMrp: 104, title: 'BRANDED 30ML' }]]);

describe('MRP guard', () => {
  it('the ceiling is the MRP less the GST billed, to two decimals, rounded down', () => {
    expect(unitCeiling(104, 5)).toBe(99.04);     // 104 / 1.05 = 99.0476
    expect(unitCeiling(200, 12)).toBe(178.57);
    expect(unitCeiling(21.6, 0)).toBe(21.6);
  });

  it('a line within the MRP passes, one at the ceiling passes', () => {
    expect(overMrp([{ itemid: 1, price: 6.7, taxpcnt: 5, qty: 2 }], batches)).toEqual([]);
    expect(overMrp([{ itemid: 2, price: 99.04, taxpcnt: 5, qty: 1 }], batches)).toEqual([]);
  });

  it('a price whose GST-inclusive amount is above the MRP is caught', () => {
    const r = overMrp([{ itemid: 2, price: 104, taxpcnt: 5, qty: 1 }], batches);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ title: 'BRANDED 30ML', billed: 109.2, mrp: 104, ceiling: 99.04 });
  });

  it('returns and unknown batches are ignored', () => {
    expect(overMrp([{ itemid: 2, price: 104, taxpcnt: 5, qty: -1 }], batches)).toEqual([]);
    expect(overMrp([{ itemid: 99, price: 500, taxpcnt: 5, qty: 1 }], batches)).toEqual([]);
  });

  it('the message names the products and says what to do', () => {
    const m = overMrpMessage(overMrp([{ itemid: 2, price: 104, taxpcnt: 5, qty: 1 }], batches));
    expect(m).toContain('BRANDED 30ML');
    expect(m).toContain('99.04');
    expect(m).toContain('manager');
  });
});
