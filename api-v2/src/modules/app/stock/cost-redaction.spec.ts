import { redactCostFields } from './cost-redaction';

describe('redactCostFields', () => {
  it('leaves out what the business paid and keeps everything else', () => {
    const rows = [{ id: 1, title: 'X', mrp_cost: 10, ptr_cost: 8, ptr_value: 7, oldprice: 5, cost: 4, balance: 3, nested: { cost: 1, keep: 2 } }];
    expect(redactCostFields(rows)).toEqual([{ id: 1, title: 'X', balance: 3, nested: { keep: 2 } }]);
  });

  it('keeps dates as dates (copying a Date field by field gave an empty object)', () => {
    const when = new Date('2026-10-22T10:00:00Z');
    const out: any = redactCostFields({ purchases: [{ invoice_date: when, cost: 1 }] });
    expect(out.purchases[0].invoice_date).toBe(when);
    expect(JSON.parse(JSON.stringify(out))).toEqual({ purchases: [{ invoice_date: '2026-10-22T10:00:00.000Z' }] });
  });

  it('passes through empty and plain values', () => {
    expect(redactCostFields(null)).toBeNull();
    expect(redactCostFields(undefined)).toBeUndefined();
    expect(redactCostFields([1, 'a', null])).toEqual([1, 'a', null]);
    expect(redactCostFields({ a: null, b: 0 })).toEqual({ a: null, b: 0 });
  });
});
