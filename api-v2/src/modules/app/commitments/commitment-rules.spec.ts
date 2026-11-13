import { allocateReceived, balanceOf, cleanAdvance, cleanLines, heldUnits, holdUntil, refundProblem, statusOf, stillHeld, totalOf } from './commitment-rules';

describe('commitment rules', () => {
  it('an advance needs an amount and a mode; digital needs how it was paid', () => {
    expect(cleanAdvance({ amount: 0, mode: 'CASH' }).ok).toBe(false);
    expect(cleanAdvance({ amount: 100 }).ok).toBe(false);
    expect(cleanAdvance({ amount: 100, mode: 'cash' })).toEqual({ ok: true, value: { amount: 100, mode: 'CASH', digimethod: null, digirefno: null } });
    expect(cleanAdvance({ amount: 100, mode: 'DIGITAL' }).ok).toBe(false);
    expect(cleanAdvance({ amount: 99.999, mode: 'digital', digimethod: 'upi', digirefno: ' ab 12 ' })).toEqual({ ok: true, value: { amount: 100, mode: 'DIGITAL', digimethod: 'UPI', digirefno: 'AB12' } });
    expect(cleanAdvance({ amount: 100, mode: 'DIGITAL', digimethod: 'UPI', digirefno: '1' }).ok).toBe(false);
  });

  it('the balance is receipts less refunds and what bills used', () => {
    expect(balanceOf([{ amount: 500 }, { amount: -120.5 }, { amount: '-79.5' }])).toBe(300);
    expect(balanceOf([])).toBe(0);
  });

  it('lines need a product or a name and a whole quantity', () => {
    expect(cleanLines([]).ok).toBe(false);
    expect(cleanLines([{ qty: 1 }]).ok).toBe(false);
    expect(cleanLines([{ productid: 4, qty: 0 }]).ok).toBe(false);
    expect(cleanLines([{ productid: 4, qty: 1.5 }]).ok).toBe(false);
    expect(cleanLines([{ productid: 4, qty: 2, agreedprice: '-1' }]).ok).toBe(false);
    expect(cleanLines([{ requestedname: '  New  tonic ', qty: 3, agreedprice: 120 }])).toEqual({ ok: true, value: [{ productid: null, requestedname: 'New tonic', qty: 3, agreedprice: 120 }] });
    expect(cleanLines([{ productid: 4, requestedname: 'ignored', qty: 1 }])).toEqual({ ok: true, value: [{ productid: 4, requestedname: null, qty: 1, agreedprice: null }] });
  });

  it('the total counts only priced lines', () => {
    expect(totalOf([{ qty: 2, agreed_price: '50.50' }, { qty: 1, agreed_price: null }])).toBe(101);
  });

  it('a received quantity covers the oldest lines first and never more than they need', () => {
    const lines = [{ id: 1, qty: 2 }, { id: 2, qty: 3 }, { id: 3, qty: 4 }];
    expect([...allocateReceived(lines, 4)]).toEqual([[1, 2], [2, 2], [3, 0]]);
    expect([...allocateReceived(lines, 100)]).toEqual([[1, 2], [2, 3], [3, 4]]);
    expect([...allocateReceived(lines, 0)]).toEqual([[1, 0], [2, 0], [3, 0]]);
  });

  it('the status follows the lines, except once collected or cancelled', () => {
    expect(statusOf('OPEN', [{ request_id: null, qty_received: 0 }])).toBe('OPEN');
    expect(statusOf('OPEN', [{ request_id: 9, qty_received: 0 }])).toBe('ORDERED');
    expect(statusOf('ORDERED', [{ request_id: 9, qty_received: 1 }, { request_id: 9, qty_received: 0 }])).toBe('READY');
    expect(statusOf('READY', [{ request_id: 9, qty_received: 0 }])).toBe('ORDERED');
    expect(statusOf('COLLECTED', [{ request_id: 9, qty_received: 0 }])).toBe('COLLECTED');
    expect(statusOf('CANCELLED', [])).toBe('CANCELLED');
  });

  it('the hold runs for the days set and releases after', () => {
    expect(holdUntil('2026-11-13', 7)).toBe('2026-11-20');
    expect(holdUntil('2026-11-28', 5)).toBe('2026-12-03');
    expect(stillHeld('2026-11-20', '2026-11-20')).toBe(true);
    expect(stillHeld('2026-11-20', '2026-11-21')).toBe(false);
    expect(stillHeld(null, '2026-11-21')).toBe(false);
  });

  it('a refund cannot be more than what is held', () => {
    expect(refundProblem('READY', 300, 300)).toBeNull();
    expect(refundProblem('READY', 300, 300.01)).toMatch(/Only 300.00/);
    expect(refundProblem('COLLECTED', 300, 100)).toMatch(/collected/);
    expect(refundProblem('OPEN', 300, 0)).toMatch(/amount/);
  });

  it('held units are packs received times the pack', () => {
    expect(heldUnits(2, 10)).toBe(20);
    expect(heldUnits(1, null)).toBe(1);
  });
});
