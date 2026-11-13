import { ItemBill, itemRows, itemTotals, share } from './gst-sales-items';
import { buildSalesReport } from './gst-sales-report';

const bill = (lines: Array<[string, number, number]>, o: Partial<ItemBill> = {}): ItemBill => ({
  id: 1, docNo: 'I/1', date: '2026-11-02', customer: 'Walk-in', buyerGstin: null, store: 'Main', inter: false, discount: 0, kind: 'TAX',
  lines: lines.map(([product, gross, rate]) => ({ product, hsn: null, batch: 'B1', qty: 1, price: gross, gross, rate })), ...o,
});

describe('share', () => {
  it('adds up exactly, with the last taking the paisa left', () => {
    const s = share(10, [1, 1, 1]);
    expect(s.reduce((t, v) => Math.round((t + v) * 100) / 100, 0)).toBe(10);
    expect(s).toEqual([3.33, 3.33, 3.34]);
    expect(share(0, [5, 5])).toEqual([0, 0]);
    expect(share(7, [0, 0])).toEqual([0, 7]);
  });
});

describe('itemRows', () => {
  it('gives each line its share of the discount and tax, adding up to the bill rate by rate', () => {
    const b = bill([['A', 105, 5], ['B', 210, 5], ['C', 118, 18]], { discount: 30 });
    const rows = itemRows(b);
    for (const rate of [5, 18]) {
      const t = itemTotals(rows.filter((r) => r.rate === rate));
      const rep = buildSalesReport({ bills: [{ docNo: 'I/1', total: 0, discount: 30, lines: b.lines.map((l) => ({ total: l.gross, rate: l.rate, kind: 'NIL_RATED' as const })), buyerGstin: null, inter: false }], notes: [], cashReturns: { count: 0, amount: 0 }, cancelled: [], gaps: [] })
        .supplies.rows.find((x) => x.rate === rate)!;
      expect(t.taxable).toBeCloseTo(rep.taxable, 2);
      expect(t.cgst).toBeCloseTo(rep.cgst, 2);
      expect(t.sgst).toBeCloseTo(rep.sgst, 2);
    }
    expect(itemTotals(rows).discount).toBe(30);
    expect(itemTotals(rows).net).toBeCloseTo(403, 2);
  });

  it('puts the tax of an out-of-state bill in IGST', () => {
    const r = itemRows(bill([['A', 118, 18]], { inter: true }))[0];
    expect(r).toMatchObject({ taxable: 100, cgst: 0, sgst: 0, igst: 18, net: 118 });
  });

  it('keeps a cash memo to its gross, with no tax split', () => {
    const r = itemRows(bill([['A', 50, 5]], { kind: 'CASH', docNo: '17' }))[0];
    expect(r).toMatchObject({ type: 'Cash memo', gross: 50, net: 50, taxable: null, cgst: null, discount: null });
  });

  it('handles a bill with no lines', () => {
    expect(itemRows(bill([]))).toEqual([]);
    expect(itemTotals([]).lines).toBe(0);
  });
});
