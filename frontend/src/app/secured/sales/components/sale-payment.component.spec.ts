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
