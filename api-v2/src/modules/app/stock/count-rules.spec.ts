import { escalatedProducts, maySettleEscalated } from './count-rules';

describe('count rules', () => {
  const line = (productid: number, diff: number, unitcost: number, itemid = productid * 10) => ({ itemid, productid, diff, unitcost });

  it('marks a product whose difference at cost is over the limit, whichever way it is out', () => {
    expect([...escalatedProducts([line(1, -60, 10), line(2, 10, 10)], 500)]).toEqual([1]);
    expect([...escalatedProducts([line(1, 60, 10)], 500)]).toEqual([1]);
  });

  it('is exactly the limit: not escalated', () => {
    expect(escalatedProducts([line(1, -50, 10)], 500).size).toBe(0);
  });

  it('adds the batches of one product together, but never two products', () => {
    const lines = [line(1, -30, 10, 11), line(1, -30, 10, 12), line(2, -30, 10), line(3, 30, 10)];
    expect([...escalatedProducts(lines, 500)]).toEqual([1]);
  });

  it('only owners settle an escalated count', () => {
    expect(maySettleEscalated('Business Head')).toBe(true);
    expect(maySettleEscalated('Owner-operator')).toBe(true);
    expect(maySettleEscalated('Store Head')).toBe(false);
    expect(maySettleEscalated(null)).toBe(false);
  });
});
