import { buildAdjustments, AdjRow } from './gst-adjustments';

const row = (o: Partial<AdjRow>): AdjRow => ({ kind: 'WRITE_OFF', source: 'PASS', reason: 'EXPIRED', rate: 5, lines: 1, qty: 10, taxable: 100, tax: 5, ...o });

describe('buildAdjustments', () => {
  it('is empty for a month with none', () => {
    const a = buildAdjustments([]);
    expect(a.any).toBe(false);
    expect(a.write_offs.rows).toEqual([]);
    expect(a.write_offs.total).toEqual({ lines: 0, qty: 0, taxable: 0, tax: 0, mrp: 0 });
    expect(a.given_out.rows).toEqual([]);
  });

  it('totals the write-offs by source, reason and rate, and rolls the GST paid up by rate', () => {
    const a = buildAdjustments([
      row({}),
      row({ rate: 18, taxable: 200, tax: 36, qty: 4 }),
      row({ source: 'TAGGED', reason: 'EXPIRED', rate: 5, taxable: 50, tax: 2.5, qty: 5 }),
      row({ reason: 'DAMAGED', rate: 5, taxable: 10, tax: 0.5, qty: 1 }),
    ]);
    expect(a.write_offs.total).toEqual({ lines: 4, qty: 20, taxable: 360, tax: 44, mrp: 0 });
    expect(a.reversal_candidate).toEqual([{ rate: 5, taxable: 160, tax: 8 }, { rate: 18, taxable: 200, tax: 36 }]);
    expect(a.write_offs.rows[0]).toMatchObject({ label: 'Out-passes', reason_label: 'Damaged' });
    expect(a.write_offs.rows.some((r) => r.label === 'Old write-offs confirmed as expiry')).toBe(true);
  });

  it('keeps each kind in its own section', () => {
    const a = buildAdjustments([
      row({ kind: 'VENDOR_RETURN', source: 'OPEN', reason: null, rate: 12, taxable: 100, tax: 12 }),
      row({ kind: 'VENDOR_RETURN', source: 'ADJUSTED', reason: null, rate: 12, taxable: 40, tax: 4.8 }),
      row({ kind: 'VENDOR_PASS', reason: 'NEAR_EXPIRY', rate: 5, taxable: 30, tax: 1.5 }),
      row({ kind: 'CREDIT_APPLIED', source: 'CREDIT', reason: null, rate: 5, taxable: 60, tax: 3 }),
    ]);
    expect(a.write_offs.rows).toEqual([]);
    expect(a.vendor_returns.total).toMatchObject({ taxable: 140, tax: 16.8 });
    expect(a.vendor_returns.rows.map((r) => r.label)).toEqual(['Credited on a purchase invoice', 'Not yet credited by the vendor']);
    expect(a.vendor_passes.total.tax).toBe(1.5);
    expect(a.credits_applied.total.taxable).toBe(60);
    expect(a.any).toBe(true);
  });

  it('lists goods given out by reason and rate, with the MRP beside the cost', () => {
    const a = buildAdjustments([
      row({ kind: 'GIVEN_OUT', source: 'SAMPLE', reason: null, rate: 5, taxable: 100, tax: 5, mrp: 140, qty: 10 }),
      row({ kind: 'GIVEN_OUT', source: 'OWN_USE', reason: null, rate: 18, taxable: 50, tax: 9, mrp: 70, qty: 2 }),
      row({ kind: 'GIVEN_OUT', source: 'GIFT', reason: null, rate: 5, taxable: 20, tax: 1, mrp: 28, qty: 2 }),
    ]);
    expect(a.given_out.rows.map((r) => r.label)).toEqual(['Gifts and promotions', 'Own use (the shop or its staff)', 'Free samples']);
    expect(a.given_out.total).toMatchObject({ qty: 14, taxable: 170, tax: 15, mrp: 238 });
    expect(a.write_offs.rows).toEqual([]);
    expect(a.any).toBe(true);
  });

  it('rounds to paise', () => {
    const a = buildAdjustments([row({ taxable: 33.333, tax: 1.6665 }), row({ taxable: 33.333, tax: 1.6665 })]);
    expect(a.write_offs.total.taxable).toBeCloseTo(66.66, 2);
    expect(a.write_offs.by_rate[0].tax).toBeCloseTo(3.34, 2);
  });
});
