import { adjustmentReason, approverProblem, bandOf, canReturnToVendor, daysToExpiry, expiryEnd, lineValues, needsWitness, passNumber } from './disposal-rules';

describe('the out-pass rules', () => {
  it('numbers passes per business and year', () => {
    expect(passNumber(2026, 7)).toBe('OP-2026-0007');
    expect(passNumber(2027, 1)).toBe('OP-2027-0001');
    expect(passNumber(2026, 12345)).toBe('OP-2026-12345');
  });

  it('posts the right reason code for a line', () => {
    expect(adjustmentReason('EXPIRED', 'DESTROYED')).toBe('EXPIRED');
    expect(adjustmentReason('NEAR_EXPIRY', 'AGENCY')).toBe('EXPIRED');
    expect(adjustmentReason('DAMAGED', 'DESTROYED')).toBe('DAMAGED');
    expect(adjustmentReason('EXPIRED', 'VENDOR')).toBe('RETURNED_TO_VENDOR');
  });

  it('asks for a witness only for a scheduled drug confirmed by someone who is not a manager', () => {
    expect(needsWitness([{ schedule: 'H1' }], false)).toBe(true);
    expect(needsWitness([{ schedule: 'x' }, { schedule: null }], false)).toBe(true);
    expect(needsWitness([{ schedule: 'H' }], true)).toBe(false);          // a Store Head or Business Head confirming stands on their own
    expect(needsWitness([{ schedule: null }, {}], false)).toBe(false);    // nothing scheduled
  });

  it('works out an expiry as the end of its month', () => {
    expect(expiryEnd('2027-08-01')).toBe('2027-08-31');
    expect(expiryEnd('2028-02-01')).toBe('2028-02-29');
    expect(daysToExpiry('2026-11-01', '2026-11-12')).toBe(18);
    expect(daysToExpiry('2026-10-01', '2026-11-12')).toBe(-12);
  });

  it('puts a batch in its band', () => {
    const today = '2026-11-12';
    expect(bandOf('2026-10-01', today)).toBe('EXPIRED');
    expect(bandOf('2026-11-01', today)).toBe('D30');       // ends 30 Nov: 18 days
    expect(bandOf('2027-01-01', today)).toBe('D90');       // ends 31 Jan: 80 days
    expect(bandOf('2027-04-01', today)).toBe('D180');
    expect(bandOf('2028-01-01', today)).toBeNull();
    expect(bandOf(null, today)).toBeNull();
  });

  it('offers a return only to a vendor that takes this kind of batch back, within its days', () => {
    const today = '2026-11-12';
    expect(canReturnToVendor({ takesback: 'NONE' }, '2026-10-01', today)).toBe(false);
    expect(canReturnToVendor({}, '2026-10-01', today)).toBe(false);                                     // never set: not offered
    expect(canReturnToVendor({ takesback: 'EXPIRED' }, '2026-10-01', today)).toBe(true);
    expect(canReturnToVendor({ takesback: 'EXPIRED' }, '2026-12-01', today)).toBe(false);               // not expired yet
    expect(canReturnToVendor({ takesback: 'NEAR_EXPIRY' }, '2026-12-01', today)).toBe(true);
    expect(canReturnToVendor({ takesback: 'NEAR_EXPIRY' }, '2026-10-01', today)).toBe(false);           // already expired
    expect(canReturnToVendor({ takesback: 'BOTH', takebackdays: 30 }, '2026-10-01', today)).toBe(true);  // 12 days past
    expect(canReturnToVendor({ takesback: 'BOTH', takebackdays: 10 }, '2026-10-01', today)).toBe(false); // 12 days past: too late
    expect(canReturnToVendor({ takesback: 'BOTH', takebackdays: 10 }, '2026-12-01', today)).toBe(false); // 49 days left: too early
    expect(canReturnToVendor({ takesback: 'BOTH' }, null, today)).toBe(false);
  });

  it('values a line at cost, tax and MRP, per unit of a pack', () => {
    expect(lineValues(5, 10, 100, 12, 150)).toEqual({ cost: 50, tax: 6, mrp: 75 });
    expect(lineValues(3, 1, 20, 5, 30)).toEqual({ cost: 60, tax: 3, mrp: 90 });
    expect(lineValues(5, 0, 20, 5, 30)).toEqual({ cost: 100, tax: 5, mrp: 150 });     // a missing pack counts as 1
  });

  it('says who may approve', () => {
    const base = { role: 'Store Head', isOwner: false, isManager: true, storeIsMine: true, isMaker: false, selfMode: false };
    expect(approverProblem(base)).toBeNull();
    expect(approverProblem({ ...base, isManager: false })).toMatch(/Only a Store Head/);
    expect(approverProblem({ ...base, storeIsMine: false })).toMatch(/store you do not run/);
    expect(approverProblem({ ...base, isMaker: true })).toMatch(/your own/);
    expect(approverProblem({ ...base, isMaker: true, selfMode: true })).toBeNull();                      // "the maker may approve"
    expect(approverProblem({ ...base, isOwner: true, storeIsMine: false, isMaker: true })).toBeNull();   // an owner approves anything, even their own
  });
});
