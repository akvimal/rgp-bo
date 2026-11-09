import { HISTORY_LIMIT, HistoryRow, summariseHistory, toHistoryLine } from './purchase-history';

const row = (o: Partial<HistoryRow> = {}): HistoryRow => ({
  id: 1, invoice_date: '2026-10-01', invoice_no: 'INV-1', challan_no: null, vendor_id: 5, vendor: 'Alpha Pharma', batch: 'B1', exp_date: '2028-01-31',
  qty: 10, free_qty: 1, mrp_cost: 100, ptr_value: 70, disc_pcnt: 10, tax_pcnt: 12, ...o,
});

describe('purchase history', () => {
  it('the net rate is the rate less the line discount', () => {
    expect(toHistoryLine(row(), 5).net_rate).toBe(63);
    expect(toHistoryLine(row({ disc_pcnt: 0 }), 5).net_rate).toBe(70);
    expect(toHistoryLine(row({ disc_pcnt: null }), 5).net_rate).toBe(70);
    expect(toHistoryLine(row({ ptr_value: null }), 5).net_rate).toBeNull();
  });

  it('the document is the invoice number, else the challan number, else none', () => {
    expect(toHistoryLine(row(), 5).doc_no).toBe('INV-1');
    expect(toHistoryLine(row({ invoice_no: null, challan_no: 'CH-9' }), 5).doc_no).toBe('CH-9');
    expect(toHistoryLine(row({ invoice_no: null, challan_no: null }), 5).doc_no).toBeNull();
  });

  it('marks the purchases from the vendor of the invoice being looked at', () => {
    expect(toHistoryLine(row({ vendor_id: 5 }), 5).same_vendor).toBe(true);
    expect(toHistoryLine(row({ vendor_id: 6 }), 5).same_vendor).toBe(false);
    expect(toHistoryLine(row({ vendor_id: 5 }), null).same_vendor).toBe(false);
    expect(toHistoryLine(row({ vendor_id: null }), 5).same_vendor).toBe(false);
  });

  it('summarises the last, the lowest and the highest net rate paid, newest first', () => {
    const lines = [
      row({ id: 3, invoice_date: '2026-10-01', vendor: 'Alpha', ptr_value: 80, disc_pcnt: 0 }),   // 80, the latest
      row({ id: 2, invoice_date: '2026-08-01', vendor: 'Beta', ptr_value: 70, disc_pcnt: 10 }),   // 63, the lowest
      row({ id: 1, invoice_date: '2026-06-01', vendor: 'Alpha', ptr_value: 95, disc_pcnt: 0 }),   // 95, the highest
    ].map((r) => toHistoryLine(r, 5));
    expect(summariseHistory(lines)).toEqual({
      count: 3, last: { rate: 80, vendor: 'Alpha', date: '2026-10-01' }, lowest: { rate: 63, vendor: 'Beta', date: '2026-08-01' }, highest: { rate: 95, vendor: 'Alpha', date: '2026-06-01' },
    });
  });

  it('no purchases, or none with a rate, gives no summary', () => {
    expect(summariseHistory([])).toEqual({ count: 0, last: null, lowest: null, highest: null });
    expect(summariseHistory([toHistoryLine(row({ ptr_value: 0 }), 5)])).toEqual({ count: 1, last: null, lowest: null, highest: null });
  });

  it('is limited to a hundred', () => { expect(HISTORY_LIMIT).toBe(100); });
});
