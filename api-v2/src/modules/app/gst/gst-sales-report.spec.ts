import { buildSalesReport, kindOf, ReportBill } from './gst-sales-report';
import { netByRate } from './gst-register';
import { splitBill } from './gst-tax';

const bill = (docNo: string, lines: Array<[number, number, any?]>, o: Partial<ReportBill> = {}): ReportBill => ({
  docNo, total: Math.round(lines.reduce((t, l) => t + l[0], 0) - (o.discount || 0)), discount: 0, buyerGstin: null, inter: false,
  lines: lines.map(([total, rate, kind]) => ({ total, rate, kind: kind || 'NIL_RATED' })), ...o,
});
const empty = { notes: [], cashReturns: { count: 0, amount: 0 }, cancelled: [], gaps: [] };

describe('kindOf', () => {
  it('uses the product, then the category, then nil-rated', () => {
    expect(kindOf('EXEMPT', 'NON_GST')).toBe('EXEMPT');
    expect(kindOf(null, 'non_gst')).toBe('NON_GST');
    expect(kindOf(undefined, undefined)).toBe('NIL_RATED');
    expect(kindOf('rubbish', null)).toBe('NIL_RATED');
  });
});

describe('buildSalesReport', () => {
  it('reports each rate sold, CGST and SGST halves, and the total', () => {
    const r = buildSalesReport({ ...empty, bills: [bill('I/1', [[105, 5], [118, 18], [50, 0]])] });
    expect(r.supplies.rows.map((x) => x.rate)).toEqual([0, 5, 18]);
    const five = r.supplies.rows.find((x) => x.rate === 5)!;
    expect(five).toMatchObject({ taxable: 100, tax: 5, cgst: 2.5, sgst: 2.5, igst: 0, total: 105 });
    const eighteen = r.supplies.rows.find((x) => x.rate === 18)!;
    expect(eighteen).toMatchObject({ taxable: 100, tax: 18, cgst: 9, sgst: 9 });
    expect(r.supplies.total.taxable).toBe(250);
    expect(r.supplies.total.tax).toBe(23);
  });

  it('puts the tax of an out-of-state sale in IGST', () => {
    const r = buildSalesReport({ ...empty, bills: [bill('I/1', [[118, 18]], { inter: true, buyerGstin: '29ABCDE1234F1Z5' })] });
    expect(r.supplies.rows[0]).toMatchObject({ cgst: 0, sgst: 0, igst: 18 });
    expect(r.buckets).toEqual([expect.objectContaining({ buyer: 'B2B', place: 'INTER', rate: 18, igst: 18 })]);
  });

  it('splits B2B and B2C, in-state and out-of-state, by rate', () => {
    const r = buildSalesReport({ ...empty, bills: [
      bill('I/1', [[105, 5]]), bill('I/2', [[105, 5]], { buyerGstin: '33ABCDE1234F1Z5' }), bill('I/3', [[105, 5]], { inter: true }),
    ] });
    expect(r.buckets.map((b) => `${b.buyer}-${b.place}`)).toEqual(['B2B-INTRA', 'B2C-INTER', 'B2C-INTRA']);
    expect(r.buckets.every((b) => b.taxable === 100)).toBe(true);
  });

  it('splits the 0% supplies by kind, with the bill discount shared in proportion', () => {
    const r = buildSalesReport({ ...empty, bills: [bill('I/1', [[100, 0, 'NIL_RATED'], [100, 0, 'EXEMPT'], [100, 0, 'EXEMPT']], { discount: 30, total: 270 })] });
    const byKind = Object.fromEntries(r.nil.map((n) => [n.kind, n.net]));
    expect(byKind['NIL_RATED']).toBe(90);
    expect(byKind['EXEMPT']).toBe(180);
    expect(r.nil.reduce((t, n) => t + n.net, 0)).toBe(270);
    expect(r.supplies.rows[0]).toMatchObject({ rate: 0, taxable: 270, tax: 0 });
  });

  it('subtracts credit notes by rate, and by kind for 0%', () => {
    const r = buildSalesReport({
      ...empty,
      bills: [bill('I/1', [[210, 5], [100, 0, 'EXEMPT']])],
      notes: [
        { rate: 5, taxable: 100, tax: 5, gross: 105, kind: 'NIL_RATED', buyerGstin: null, inter: false },
        { rate: 0, taxable: 40, tax: 0, gross: 40, kind: 'EXEMPT', buyerGstin: null, inter: false },
      ],
      cashReturns: { count: 2, amount: 75 },
    });
    expect(r.returns.rows.find((x) => x.rate === 5)).toMatchObject({ taxable: 100, tax: 5, cgst: 2.5, sgst: 2.5 });
    expect(r.net.rows.find((x) => x.rate === 5)).toMatchObject({ taxable: 100, tax: 5 });
    expect(r.nil).toEqual([expect.objectContaining({ kind: 'EXEMPT', supplied: 100, returned: 40, net: 60 })]);
    expect(r.returns.cash_returns).toEqual({ count: 2, amount: 75 });
  });

  it('agrees with the net output the monthly summary uses', () => {
    const bills = [bill('I/1', [[105, 5], [236, 18]]), bill('I/2', [[63, 5]], { discount: 3, total: 60 }), bill('I/3', [[59, 18]], { inter: true })];
    const notes = [{ rate: 18, taxable: 50, tax: 9, gross: 59, kind: 'NIL_RATED' as const, buyerGstin: null, inter: false }];
    const r = buildSalesReport({ ...empty, bills, notes });
    const inv = bills.flatMap((b) => splitBill(b.lines.map((l) => ({ total: l.total, rate: l.rate })), b.discount, b.inter));
    const expected = netByRate(inv, [{ rate: 18, taxable: 50, cgst: 4.5, sgst: 4.5, igst: 0, tax: 9 }]);
    expect(r.net.rows.map((x) => [x.rate, x.taxable, x.tax])).toEqual(expected.map((x) => [x.rate, x.taxable, x.tax]));
  });

  it('shows the round-off and flags a real mismatch', () => {
    const ok = buildSalesReport({ ...empty, bills: [bill('I/1', [[105.4, 5]], { total: 105 })] });
    expect(ok.tie_out.round_off).toBeCloseTo(-0.4, 2);
    expect(ok.tie_out.ok).toBe(true);
    const bad = buildSalesReport({ ...empty, bills: [bill('I/1', [[105, 5]], { total: 500 })] });
    expect(bad.tie_out.ok).toBe(false);
  });

  it('counts the documents', () => {
    const r = buildSalesReport({ ...empty, bills: [bill('I/26-27/000002', [[10, 5]]), bill('I/26-27/000001', [[10, 5]])], cancelled: ['I/26-27/000003'], gaps: ['I/26-27/000004'] });
    expect(r.documents).toEqual({ issued: 2, first: 'I/26-27/000001', last: 'I/26-27/000002', cancelled: 1, gaps: ['I/26-27/000004'] });
  });

  it('is empty and ok for a month with no bills', () => {
    const r = buildSalesReport({ ...empty, bills: [] });
    expect(r.supplies.rows).toEqual([]);
    expect(r.tie_out.ok).toBe(true);
    expect(r.documents.first).toBeNull();
  });
});
