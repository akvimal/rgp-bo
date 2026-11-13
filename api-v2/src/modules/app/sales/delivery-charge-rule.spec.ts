import { cleanChargePayment, digitalChargeChanged } from './delivery-charge-rule';

describe('delivery charge payment', () => {
  it('leaves the charge payment alone when the request does not mention it', () => {
    expect(cleanChargePayment({ charges: 40 })).toEqual({ ok: true, value: null });
  });
  it('needs a method for a digital charge', () => {
    expect(cleanChargePayment({ charges: 40, chargevia: 'DIGITAL' }).ok).toBe(false);
    expect(cleanChargePayment({ charges: 40, chargevia: 'digital', chargemethod: 'upi', chargeref: ' ab 12 ' })).toEqual({ ok: true, value: { chargevia: 'DIGITAL', chargemethod: 'UPI', chargeref: 'AB12' } });
  });
  it('rejects a reference that is too short and a way of paying it does not know', () => {
    expect(cleanChargePayment({ charges: 40, chargevia: 'DIGITAL', chargemethod: 'UPI', chargeref: '12' }).ok).toBe(false);
    expect(cleanChargePayment({ charges: 40, chargevia: 'CHEQUE' }).ok).toBe(false);
  });
  it('records nothing when there is no charge', () => {
    expect(cleanChargePayment({ charges: 0, chargevia: 'DIGITAL', chargemethod: 'UPI' })).toEqual({ ok: true, value: { chargevia: null, chargemethod: null, chargeref: null } });
  });
  it('a cash charge carries no method', () => {
    expect(cleanChargePayment({ charges: 30, chargevia: 'CASH', chargemethod: 'UPI' })).toEqual({ ok: true, value: { chargevia: 'CASH', chargemethod: null, chargeref: null } });
  });
  it('sees a change to a digital charge, not to a cash one', () => {
    expect(digitalChargeChanged({ charges: 40, chargevia: 'DIGITAL', chargemethod: 'UPI' }, { charges: 40, chargevia: 'DIGITAL', chargemethod: 'UPI' })).toBe(false);
    expect(digitalChargeChanged({ charges: 40, chargevia: 'DIGITAL', chargemethod: 'UPI' }, { charges: 50, chargevia: 'DIGITAL', chargemethod: 'UPI' })).toBe(true);
    expect(digitalChargeChanged({ charges: 40, chargevia: 'CASH' }, { charges: 40, chargevia: 'DIGITAL', chargemethod: 'UPI' })).toBe(true);
    expect(digitalChargeChanged({ charges: 40, chargevia: 'CASH' }, { charges: 60, chargevia: 'CASH' })).toBe(false);
  });
});
