import { cashAdjustment, changesOf, correctionProblem, correctionWarnings, paymentProblem, reasonProblem } from './sale-correction';

const ok = { status: 'COMPLETE', shiftId: 5, shiftStatus: 'OPEN', returns: 0, isOwn: true, canCorrectAny: false };

describe('correctionProblem', () => {
  it('allows an own completed bill in the open shift', () => expect(correctionProblem(ok)).toBeNull());
  it('refuses a closed shift', () => expect(correctionProblem({ ...ok, shiftStatus: 'CLOSED' })).toMatch(/shift is closed/));
  it('refuses a bill with no shift', () => expect(correctionProblem({ ...ok, shiftId: null })).toMatch(/not on a shift/));
  it('refuses a held or voided bill', () => {
    expect(correctionProblem({ ...ok, status: 'PENDING' })).toMatch(/completed/);
    expect(correctionProblem({ ...ok, status: 'VOID' })).toMatch(/voided/);
  });
  it('refuses once something was returned', () => expect(correctionProblem({ ...ok, returns: 1 })).toMatch(/returned/));
  it("refuses someone else's bill unless a manager", () => {
    expect(correctionProblem({ ...ok, isOwn: false })).toMatch(/only the bills you rang/);
    expect(correctionProblem({ ...ok, isOwn: false, canCorrectAny: true })).toBeNull();
  });
});

describe('reasonProblem', () => {
  it('needs three letters', () => { expect(reasonProblem(' a ')).not.toBeNull(); expect(reasonProblem('typo')).toBeNull(); });
});

describe('paymentProblem', () => {
  const before = { cash: 300, digital: 200 };
  it('allows moving between cash and digital', () => expect(paymentProblem(before, { cash: 500, digital: 0 })).toBeNull());
  it('allows the same total split differently with a method', () => expect(paymentProblem(before, { cash: 0, digital: 500, method: 'UPI' })).toBeNull());
  it('refuses a different total', () => expect(paymentProblem(before, { cash: 300, digital: 100, method: 'UPI' })).toMatch(/must stay 500.00/));
  it('needs a method for a digital amount', () => expect(paymentProblem(before, { cash: 0, digital: 500 })).toMatch(/Choose how/));
  it('refuses negatives', () => expect(paymentProblem(before, { cash: 600, digital: -100 })).toMatch(/negative/));
  it('ignores paise rounding noise', () => expect(paymentProblem({ cash: 10.1, digital: 20.2 }, { cash: 30.3, digital: 0 })).toBeNull());
});

describe('changesOf', () => {
  const base = { cash: 500, digital: 0, method: null, refno: null, servedBy: 4, servedByName: 'Anand', rx: '' };
  it('is empty when nothing differs', () => expect(changesOf(base, { ...base })).toEqual([]));
  it('names a payment move', () => {
    const c = changesOf(base, { ...base, cash: 0, digital: 500, method: 'UPI' });
    expect(c).toEqual(['payment: cash 500.00, digital 0.00 → cash 0.00, digital 500.00 (UPI)']);
  });
  it('names who served', () => expect(changesOf(base, { ...base, servedBy: 7, servedByName: 'Meena' })).toEqual(['served by: Anand → Meena']));
  it('names a prescription change', () => expect(changesOf(base, { ...base, rx: '{"a":1}' })).toEqual(['prescription detail changed']));
});

describe('cashAdjustment', () => {
  it('adds when cash rises', () => expect(cashAdjustment(100, 250)).toEqual({ category: 'SALE', deposit: 150, withdraw: 0 }));
  it('takes out when cash falls', () => expect(cashAdjustment(250, 100)).toEqual({ category: 'SALE_VOID', deposit: 0, withdraw: 150 }));
  it('is null when same', () => expect(cashAdjustment(100, 100.001)).toBeNull());
});

describe('correctionWarnings', () => {
  it('always ends with the audit line', () => {
    const w = correctionWarnings([], { cashMoves: false, digitalMoves: false, taxInvoice: false });
    expect(w).toEqual(['Every change is written to the audit log with your name and the reason.']);
  });
  it('names the cash, digital, tax invoice and register effects', () => {
    const w = correctionWarnings(['prescription detail changed'], { cashMoves: true, digitalMoves: true, taxInvoice: true });
    expect(w.length).toBe(5);
  });
});
