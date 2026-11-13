import { cleanRelationship, identityProblem, mergeProblem, sameWords } from './customer-rules';

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

describe('merging customers', () => {
  it('merges spellings of one name without asking', () => {
    expect(mergeProblem('THILLAI GOVINDAN', ['THILLA GOVINDAN'], false)).toBeNull();
    expect(mergeProblem('Ramesh Kumar', ['Ramesh Kumar R'], false)).toBeNull();
  });
  it('stops a merge of clearly different names on one number until the person says it is the same person', () => {
    expect(mergeProblem('Ramesh Kumar', ['Lakshmi Devi'], false)).toMatch(/family/);
    expect(mergeProblem('Ramesh Kumar', ['Ramesh Kumar R', 'Lakshmi Devi'], false)).toMatch(/Lakshmi Devi has a different name/);
    expect(mergeProblem('Ramesh Kumar', ['Lakshmi Devi'], true)).toBeNull();
  });
  it('names up to three of them', () => {
    const m = mergeProblem('Ramesh Kumar', ['Anbu Raj', 'Bala Murugan', 'Chitra Devi', 'Dinesh Babu'], false) as string;
    expect(m).toMatch(/Anbu Raj, Bala Murugan, Chitra Devi have a different name/);
    expect(m).not.toMatch(/Dinesh/);
  });
});

describe('how a person on a shared number is related', () => {
  it('takes one of the set in any case, or nothing', () => {
    expect(cleanRelationship('spouse')).toEqual({ ok: true, value: 'SPOUSE' });
    expect(cleanRelationship(' Child ')).toEqual({ ok: true, value: 'CHILD' });
    expect(cleanRelationship('')).toEqual({ ok: true, value: null });
    expect(cleanRelationship(undefined)).toEqual({ ok: true, value: null });
  });
  it('refuses anything else', () => {
    expect(cleanRelationship('cousin').ok).toBe(false);
  });
});
