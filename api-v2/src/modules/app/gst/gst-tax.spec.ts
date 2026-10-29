import { creditFor, creditNoteNo, fyBounds, fyLabel, halves, invoiceNo, isInterState, parsePrefix, splitBill, stateOfGstin } from './gst-tax';

describe('tax on a bill', () => {
  it('works the tax out of a GST-inclusive total, rate by rate, half CGST and half SGST', () => {
    const rows = splitBill([{ total: 105, rate: 5 }, { total: 112, rate: 12 }, { total: 52.5, rate: 5 }], 0, false);
    expect(rows.map((r) => r.rate)).toEqual([5, 12]);
    expect(rows[0]).toMatchObject({ gross: 157.5, taxable: 150, tax: 7.5, cgst: 3.75, sgst: 3.75, igst: 0 });
    expect(rows[1]).toMatchObject({ gross: 112, taxable: 100, tax: 12, cgst: 6, sgst: 6 });
  });

  it('gives the odd paisa to SGST', () => {
    expect(halves(0.05)).toEqual({ cgst: 0.02, sgst: 0.03 });
    expect(halves(5.33)).toEqual({ cgst: 2.66, sgst: 2.67 });
    const r = splitBill([{ total: 112, rate: 5 }], 0, false)[0];                       // 106.67 taxable, 5.33 tax
    expect(r.taxable).toBe(106.67);
    expect(r.cgst + r.sgst).toBeCloseTo(r.tax, 2);
  });

  it('charges IGST, not CGST and SGST, between states', () => {
    const r = splitBill([{ total: 105, rate: 5 }], 0, true)[0];
    expect(r).toMatchObject({ taxable: 100, tax: 5, cgst: 0, sgst: 0, igst: 5 });
  });

  it('takes an invoice discount off the taxable value, in proportion to each rate', () => {
    const rows = splitBill([{ total: 105, rate: 5 }, { total: 112, rate: 12 }], 21.7, false);   // 10% of 217
    expect(rows[0].discount + rows[1].discount).toBeCloseTo(21.7, 2);
    expect(rows[0].gross - rows[0].discount).toBeCloseTo(94.5, 2);
    expect(rows[0].taxable).toBeCloseTo(90, 2);
    expect(rows[1].taxable).toBeCloseTo(90, 2);
    expect(rows.reduce((t, r) => t + r.taxable + r.tax, 0)).toBeCloseTo(217 - 21.7, 2);          // taxable plus tax is what was charged
  });

  it('a zero-rated line has no tax, and a bill with no lines has no rows', () => {
    expect(splitBill([{ total: 50, rate: 0 }], 0, false)[0]).toMatchObject({ taxable: 50, tax: 0 });
    expect(splitBill([], 0, false)).toEqual([]);
  });
});

describe('financial year and document numbers', () => {
  it('runs April to March', () => {
    expect(fyLabel('2026-03-31')).toBe('25-26');
    expect(fyLabel('2026-04-01')).toBe('26-27');
    expect(fyLabel('2026-10-25')).toBe('26-27');
    expect(fyBounds('2026-02-10')).toEqual({ from: '2025-04-01', to: '2026-03-31' });
    expect(fyBounds('2026-10-25')).toEqual({ from: '2026-04-01', to: '2027-03-31' });
  });

  it('numbers keep within 16 characters', () => {
    expect(invoiceNo('INV', '26-27', 123)).toBe('INV/26-27/000123');
    expect(invoiceNo('INV', '26-27', 123)).toHaveLength(16);
    expect(creditNoteNo('26-27', 7)).toBe('CN/26-27/000007');
  });

  it('knows the state from a GSTIN and whether a supply crosses a border', () => {
    expect(stateOfGstin('33ABCDE1234F1Z5')).toBe('33');
    expect(isInterState('29', '33')).toBe(true);
    expect(isInterState('33', '33')).toBe(false);
    expect(isInterState(null, '33')).toBe(false);
    expect(isInterState('33', null)).toBe(false);
  });

  it('checks the prefix', () => {
    expect(parsePrefix(' rgp ').value).toBe('RGP');
    expect(parsePrefix('R').error).toBeTruthy();
    expect(parsePrefix('R-1').error).toBeTruthy();
    expect(parsePrefix('ABCD').error).toBeTruthy();       // would make a number longer than 16 characters
  });
});

describe('credit note for a return', () => {
  it('reverses the tax at the line\'s own rate', () => {
    const c = creditFor(210, 2, 1, 5, 210, 0);                              // 2 units at 105 with 5%, one comes back
    expect(c).toEqual({ gross: 105, taxable: 100, tax: 5 });
  });

  it('follows the bill discount in proportion', () => {
    const c = creditFor(100, 1, 1, 0, 200, 20);                              // 10% off the whole bill
    expect(c.gross).toBe(90);
  });

  it('a line with no quantity gives nothing', () => {
    expect(creditFor(0, 0, 1, 5, 0, 0).gross).toBe(0);
  });
});
