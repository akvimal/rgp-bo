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
