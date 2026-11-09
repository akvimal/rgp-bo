import { ADD_ONLY_REASON_CODES, REMOVE_ONLY_REASON_CODES, USER_REASON_CODES, reasonDirectionProblem } from './reason-codes';

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
