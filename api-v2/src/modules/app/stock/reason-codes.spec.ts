import { ADD_ONLY_REASON_CODES, REMOVE_ONLY_REASON_CODES, USER_REASON_CODES, givenOutProblem, isGivenOut, reasonDirectionProblem } from './reason-codes';

describe('stock adjustment reasons and direction', () => {
  it('lets a loss reason take stock out', () => REMOVE_ONLY_REASON_CODES.forEach((c) => expect(reasonDirectionProblem(c, -3)).toBe('')));
  it('lets a gain reason put stock in', () => ADD_ONLY_REASON_CODES.forEach((c) => expect(reasonDirectionProblem(c, 3)).toBe('')));
  it('refuses a loss reason that adds stock', () => REMOVE_ONLY_REASON_CODES.forEach((c) => expect(reasonDirectionProblem(c, 3)).toMatch(/adds stock/)));
  it('refuses a gain reason that removes stock', () => ADD_ONLY_REASON_CODES.forEach((c) => expect(reasonDirectionProblem(c, -3)).toMatch(/removes stock/)));
  it('lets Correction and Other go either way', () => ['CORRECTION', 'OTHER'].forEach((c) => { expect(reasonDirectionProblem(c, 5)).toBe(''); expect(reasonDirectionProblem(c, -5)).toBe(''); }));
  it('is case-insensitive and says nothing for system codes or no quantity', () => {
    expect(reasonDirectionProblem('damaged', 2)).not.toBe('');
    expect(reasonDirectionProblem('TRANSFER_IN', 2)).toBe('');
    expect(reasonDirectionProblem('DAMAGED', 0)).toBe('');
    expect(reasonDirectionProblem(undefined, 4)).toBe('');
  });
  it('offers the three new gain reasons to staff', () => ['FOUND', 'NOT_ENTERED', 'CUSTOMER_RETURN'].forEach((c) => expect(USER_REASON_CODES as readonly string[]).toContain(c)));
});

describe('stock given out without a sale', () => {
  it('knows the three reasons, takes stock out only, and needs a note', () => {
    for (const c of ['SAMPLE', 'GIFT', 'OWN_USE', 'sample']) expect(isGivenOut(c)).toBe(true);
    for (const c of ['DAMAGED', 'OTHER', '', null]) expect(isGivenOut(c)).toBe(false);
    for (const c of ['SAMPLE', 'GIFT', 'OWN_USE']) {
      expect(USER_REASON_CODES as readonly string[]).toContain(c);
      expect(reasonDirectionProblem(c, -2)).toBe('');
      expect(reasonDirectionProblem(c, 2)).toMatch(/adds stock/);
      expect(givenOutProblem(c, '')).toMatch(/who it went to/);
      expect(givenOutProblem(c, '  ')).not.toBe('');
      expect(givenOutProblem(c, 'Dr Rao clinic')).toBe('');
    }
    expect(givenOutProblem('DAMAGED', '')).toBe('');
  });
});
