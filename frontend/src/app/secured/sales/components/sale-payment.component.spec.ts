import { SalePaymentComponent } from './sale-payment.component';

/** the payment box without a screen: only the rule for "no way of paying is chosen yet" */
const make = (total: number, payment: any = {}) => {
  const c = new SalePaymentComponent({ get: () => ({ subscribe: () => undefined }) } as any, { staffCreditAllowed: true, payLaterAllowed: true } as any);
  c.total = total;
  c.payment = payment;
  return c;
};

describe('SalePaymentComponent: choosing how it is paid', () => {
  it('asks for a choice as soon as there is something to pay, and not before', () => {
    expect(make(0).modeMissing).toBeFalse();
    expect(make(250).modeMissing).toBeTrue();
  });

  it('is satisfied by pressing Cash or Digital / split', () => {
    const cash = make(250);
    cash.setCashMode(true);
    expect(cash.payment.modechosen).toBeTrue();
    expect(cash.modeMissing).toBeFalse();
    const digital = make(250);
    digital.setCashMode(false);
    expect(digital.modeMissing).toBeFalse();
    expect(digital.payment.digiamt).toBe(250);
  });

  it('is satisfied by a whole bill on staff credit', () => {
    const c = make(250, { staffcredit: true });
    expect(c.modeMissing).toBeFalse();
  });

  it('is satisfied when store credit covers the bill, but not when it covers only part', () => {
    expect(make(100, { usecredit: true, creditbalance: 150 }).modeMissing).toBeFalse();
    expect(make(100, { usecredit: true, creditbalance: 40 }).modeMissing).toBeTrue();
    const part = make(100, { usecredit: true, creditbalance: 40 });
    part.setCashMode(true);
    expect(part.modeMissing).toBeFalse();
  });

  it('is satisfied by Pay later for the whole bill, but not for part of it', () => {
    expect(make(100, { latemode: true, dueamt: null }).modeMissing).toBeFalse();
    expect(make(100, { latemode: true, dueamt: 100 }).modeMissing).toBeFalse();
    const part = make(100, { latemode: true, dueamt: 30 });
    expect(part.modeMissing).toBeTrue();             // 70 is still to be paid now
    part.setCashMode(true);
    expect(part.modeMissing).toBeFalse();
  });

  it('a bill reopened from the saved ones counts as chosen', () => {
    expect(make(250, { modechosen: true }).modeMissing).toBeFalse();
  });

  it('tells the form every time it is checked, so Complete follows', () => {
    const c = make(250);
    const seen: any[] = [];
    c.updated.subscribe((p: any) => seen.push(p.modemissing));
    c.ngDoCheck();
    c.setCashMode(true);
    c.ngDoCheck();
    expect(seen).toEqual([true, false]);
  });
});

describe('SalePaymentComponent: collecting a customer order', () => {
  it('takes the advance held off the bill, after store credit, and no more than the bill', () => {
    const c = make(100, { usecredit: true, creditbalance: 30, usecommitment: true, commitmentid: 7, commitmentheld: 500 });
    expect(c.storeCreditUse).toBe(30);
    expect(c.commitmentUse).toBe(70);
    expect(c.creditUse).toBe(100);
    expect(c.modeMissing).toBeFalse();
  });

  it('leaves the rest of the bill to cash or digital when the advance is smaller', () => {
    const c = make(300, { usecommitment: true, commitmentid: 7, commitmentheld: 120 });
    expect(c.commitmentUse).toBe(120);
    expect(c.modeMissing).toBeTrue();
  });

  it('uses nothing until an order is chosen', () => {
    expect(make(100, { usecommitment: true, commitmentheld: 50 }).commitmentUse).toBe(0);
    expect(make(100, { usecommitment: false, commitmentid: 7, commitmentheld: 50 }).commitmentUse).toBe(0);
  });

  it('choosing an order sets what it holds; unticking forgets it', () => {
    const c = make(100);
    c.commitments = [{ id: 7, held: 40, items: 'Tonic x1' }, { id: 8, held: 90, items: 'Syrup x2' }];
    c.pickCommitment(8);
    expect(c.payment.commitmentid).toBe(8);
    expect(c.commitmentUse).toBe(90);
    c.payment.usecommitment = false;
    c.commitmentToggle();
    expect(c.payment.commitmentid).toBeNull();
    expect(c.commitmentUse).toBe(0);
  });
});
