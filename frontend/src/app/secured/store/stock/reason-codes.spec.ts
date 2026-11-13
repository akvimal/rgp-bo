import { ADD_REASONS, REMOVE_REASONS, adjustmentPlan, directionOfQty, needsComment, reasonLabel, reasonsFor } from './reason-codes';

describe('stock adjustment reasons', () => {
  it('has its own reasons for each direction, with no loss reason on an addition', () => {
    expect(REMOVE_REASONS.map((r) => r.value)).toEqual(['DAMAGED', 'EXPIRED', 'RETURNED_TO_VENDOR', 'SHRINKAGE', 'SAMPLE', 'GIFT', 'OWN_USE', 'CORRECTION', 'OTHER']);
    expect(ADD_REASONS.map((r) => r.value)).toEqual(['FOUND', 'NOT_ENTERED', 'CUSTOMER_RETURN', 'CORRECTION', 'OTHER']);
    expect(reasonsFor('')).toEqual([]);
    expect(reasonsFor('ADD').some((r) => r.value === 'DAMAGED')).toBe(false);
  });

  it('says a stored code in words, system codes too, and an unknown code as it is', () => {
    expect(reasonLabel('SHRINKAGE')).toBe('Lost or missing');
    expect(reasonLabel('FOUND')).toBe('Found in a count');
    expect(reasonLabel('CORRECTION')).toBe('Correction');
    expect(reasonLabel('TRANSFER_IN')).toBe('Transfer in');
    expect(reasonLabel('WEIRD')).toBe('WEIRD');
    expect(reasonLabel(null)).toBe('');
  });

  it('reads the direction from a stored quantity', () => {
    expect(directionOfQty(-4)).toBe('REMOVE');
    expect(directionOfQty(4)).toBe('ADD');
    expect(directionOfQty(0)).toBe('');
  });

  it('plans a removal as a negative quantity and shows the stock after', () => {
    expect(adjustmentPlan('REMOVE', 5, 42)).toEqual({ signed: -5, after: 37, problem: '' });
    expect(adjustmentPlan('ADD', 5, 42)).toEqual({ signed: 5, after: 47, problem: '' });
  });

  it('refuses what cannot be done, in words', () => {
    expect(adjustmentPlan('', 5, 42).problem).toMatch(/removed or added/);
    expect(adjustmentPlan('REMOVE', 0, 42).problem).toMatch(/how many/);
    expect(adjustmentPlan('REMOVE', -3, 42).problem).toMatch(/how many/);
    expect(adjustmentPlan('REMOVE', 1.5, 42).problem).toMatch(/whole number/);
    expect(adjustmentPlan('REMOVE', 43, 42).problem).toMatch(/at most 42/);
    expect(adjustmentPlan('REMOVE', 42, 42)).toEqual({ signed: -42, after: 0, problem: '' });         // everything can go
    expect(adjustmentPlan('ADD', 500, 0).problem).toBe('');                                          // adding has no ceiling
  });

  it('asks for a few words for Other and Correction only', () => {
    expect(needsComment('OTHER')).toBe(true);
    expect(needsComment('CORRECTION')).toBe(true);
    expect(needsComment('DAMAGED')).toBe(false);
  });
});
