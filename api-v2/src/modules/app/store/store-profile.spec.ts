import { parseProfileInput } from './store-profile';

describe('store profile: returns', () => {
  it('takes a store off returns, and back', () => {
    expect(parseProfileInput({ returnsallowed: false })).toEqual({ returns_allowed: false });
    expect(parseProfileInput({ returnsallowed: true })).toEqual({ returns_allowed: true });
  });

  it('leaves it alone when it is not sent, and refuses anything that is not true or false', () => {
    expect(parseProfileInput({ shiftmode: 'time' })).not.toHaveProperty('returns_allowed');
    expect(() => parseProfileInput({ returnsallowed: 'no' })).toThrow(/true or false/);
    expect(() => parseProfileInput({ returnsallowed: null })).toThrow(/true or false/);
  });
});

describe('staff credit by store', () => {
  it('reads the switch as a boolean only', () => {
    expect(parseProfileInput({ staffcreditallowed: false })).toEqual({ staff_credit_allowed: false });
    expect(parseProfileInput({ staffcreditallowed: true })).toEqual({ staff_credit_allowed: true });
    expect(() => parseProfileInput({ staffcreditallowed: 'no' })).toThrow();
    expect(parseProfileInput({ shiftmode: 'time' })).not.toHaveProperty('staff_credit_allowed');
  });
});

describe('pay later by store', () => {
  it('is its own switch, apart from staff credit', () => {
    expect(parseProfileInput({ paylaterallowed: false })).toEqual({ pay_later_allowed: false });
    expect(parseProfileInput({ staffcreditallowed: false })).not.toHaveProperty('pay_later_allowed');
    expect(() => parseProfileInput({ paylaterallowed: 'no' })).toThrow();
  });
});
