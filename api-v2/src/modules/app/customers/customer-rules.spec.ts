import { identityProblem, sameWords } from './customer-rules';

describe('who a customer is without a mobile number', () => {
  it('needs nothing more than the number when there is one', () => {
    expect(identityProblem('9876543210', 'Ra', null)).toBeNull();
  });
  it('needs a name and a location together when there is no number', () => {
    expect(identityProblem(null, 'Ramesh Kumar', 'Anna Nagar')).toBeNull();
    expect(identityProblem(null, 'Ramesh Kumar', null)).toMatch(/location/);
    expect(identityProblem(null, 'Ramesh Kumar', '   ')).toMatch(/location/);
    expect(identityProblem(null, null, 'Anna Nagar')).toMatch(/name/);
  });
  it('refuses a name too short to tell anyone apart', () => {
    expect(identityProblem(null, 'Ra', 'Anna Nagar')).toMatch(/3 letters/);
  });
});

describe('comparing names and locations', () => {
  it('ignores case and extra spaces', () => {
    expect(sameWords('  Anna   Nagar ', 'anna nagar')).toBe(true);
  });
  it('tells different words apart, and treats empty as empty', () => {
    expect(sameWords('Anna Nagar', 'Anna Nagar East')).toBe(false);
    expect(sameWords(null, '')).toBe(true);
  });
});
