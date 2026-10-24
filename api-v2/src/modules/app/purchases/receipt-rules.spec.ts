import { awaitingInvoice, cleanRef, gstPeriodFor } from './receipt-rules';

describe('receipt rules', () => {
  it('stores a blank number as null', () => {
    expect(cleanRef('  ')).toBeNull();
    expect(cleanRef(undefined)).toBeNull();
    expect(cleanRef(' INV/1 ')).toBe('INV/1');
  });

  it('a receipt with no invoice number is awaiting its invoice', () => {
    expect(awaitingInvoice({ invoiceno: null })).toBe(true);
    expect(awaitingInvoice({ invoice_no: '' })).toBe(true);
    expect(awaitingInvoice({ invoiceno: 'A-1' })).toBe(false);
  });

  it('has no GST month until the invoice number is entered', () => {
    expect(gstPeriodFor(null, '2026-10-20')).toBeNull();
    expect(gstPeriodFor('A-1', '2026-10-20')).toBe('2026-10');
    expect(gstPeriodFor('A-1', null)).toBeNull();
  });
});
