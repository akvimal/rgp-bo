import { bonusAmount, bonusSkipReason, capIncentive, effectiveCap, monthsBetween } from './hr-variable-pay';

describe('incentive cap', () => {
  it('leaves an incentive under the cap alone', () => expect(capIncentive(4200, 5000)).toEqual({ amount: 4200, capped: false }));
  it('stops it at the cap', () => expect(capIncentive(6200.5, 5000)).toEqual({ amount: 5000, capped: true }));
  it('an incentive equal to the cap is not capped', () => expect(capIncentive(5000, 5000)).toEqual({ amount: 5000, capped: false }));
  it('no cap means no limit', () => {
    expect(capIncentive(9000, null)).toEqual({ amount: 9000, capped: false });
    expect(capIncentive(9000, undefined)).toEqual({ amount: 9000, capped: false });
  });
  it('a cap of zero pays nothing', () => expect(capIncentive(900, 0)).toEqual({ amount: 0, capped: true }));
  it('never goes below zero', () => expect(capIncentive(-5, 100)).toEqual({ amount: 0, capped: false }));
  it('the person own cap wins over the job role cap, even when lower', () => {
    expect(effectiveCap(3000, 5000)).toBe(3000);
    expect(effectiveCap(null, 5000)).toBe(5000);
    expect(effectiveCap(0, 5000)).toBe(0);
    expect(effectiveCap(null, null)).toBeNull();
  });
});

describe('bonus amount', () => {
  it('a fixed amount is the same for everyone', () => expect(bonusAmount('FIXED', 2000, 12000, 20000)).toBe(2000));
  it('a share of Basic', () => expect(bonusAmount('BASIC_PCT', 100, 12000, 20000)).toBe(12000));
  it('half a month of Basic', () => expect(bonusAmount('BASIC_PCT', 50, 12345, 20000)).toBe(6172.5));
  it('a share of the full gross', () => expect(bonusAmount('GROSS_PCT', 10, 12000, 20555)).toBe(2055.5));
});

describe('bonus eligibility', () => {
  it('counts whole months only', () => {
    expect(monthsBetween('2026-04-10', '2026-10-31')).toBe(6);
    expect(monthsBetween('2026-04-10', '2026-10-09')).toBe(5);
    expect(monthsBetween('2026-11-01', '2026-10-31')).toBe(0);
  });
  it('someone who has served long enough gets it', () => expect(bonusSkipReason('2025-01-01', null, '2026-10', 6)).toBeNull());
  it('someone who joined too recently does not', () => expect(bonusSkipReason('2026-08-15', null, '2026-10', 6)).toBe('served 2 months, needs 6'));
  it('no minimum service means everyone employed', () => expect(bonusSkipReason('2026-10-20', null, '2026-10', 0)).toBeNull());
  it('someone who joins after the month does not', () => expect(bonusSkipReason('2026-11-02', null, '2026-10', 0)).toBe('joins after that month'));
  it('someone who left before the month does not, but someone who leaves during it does', () => {
    expect(bonusSkipReason('2024-01-01', '2026-09-30', '2026-10', 0)).toBe('left before that month');
    expect(bonusSkipReason('2024-01-01', '2026-10-12', '2026-10', 0)).toBeNull();
  });
});
