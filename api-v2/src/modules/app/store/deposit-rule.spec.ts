import { DepositRule, checkDepositRule, describeDepositRule, evaluateDeposit, isDepositDay, lastDepositDay, nextDepositDay, parseDepositInput } from './deposit-rule';

const rule = (over: Partial<DepositRule> = {}): DepositRule => ({ threshold: 0, schedule: 'none', weekdays: [], monthdays: [], ...over });

describe('deposit rule', () => {
  // 2026-10-26 is a Monday
  const MON = '2026-10-26';

  it('is due by amount alone when the balance reaches the threshold', () => {
    const r = rule({ threshold: 10000 });
    expect(evaluateDeposit(r, 9999, null, MON)).toMatchObject({ due: false, reason: null });
    expect(evaluateDeposit(r, 10000, null, MON)).toMatchObject({ due: true, reason: 'amount', excess: 0 });
    expect(evaluateDeposit(r, 12500.5, null, MON)).toMatchObject({ due: true, reason: 'amount', excess: 2500.5 });
  });

  it('weekly: due from the scheduled weekday until cash is banked, whichever of amount or day comes first', () => {
    const r = rule({ threshold: 50000, schedule: 'weekly', weekdays: [1, 4] });          // Mon and Thu
    expect(isDepositDay(r, '2026-10-26')).toBe(true);
    expect(isDepositDay(r, '2026-10-27')).toBe(false);
    // Tuesday: the Monday deposit day passed and nothing was banked since
    expect(evaluateDeposit(r, 3000, '2026-10-20', '2026-10-27')).toMatchObject({ due: true, reason: 'schedule', since: '2026-10-26' });
    // banked on Monday: settled until Thursday
    expect(evaluateDeposit(r, 3000, '2026-10-26', '2026-10-27')).toMatchObject({ due: false, nextscheduled: '2026-10-29' });
    // the amount can come first, between deposit days
    expect(evaluateDeposit(r, 60000, '2026-10-26', '2026-10-27')).toMatchObject({ due: true, reason: 'amount', byschedule: false });
  });

  it('nothing is due on a deposit day when there is no cash to bank', () => {
    expect(evaluateDeposit(rule({ schedule: 'daily' }), 0, null, MON).due).toBe(false);
    expect(evaluateDeposit(rule({ schedule: 'daily' }), 1, '2026-10-25', MON)).toMatchObject({ due: true, reason: 'schedule', since: MON });
    expect(evaluateDeposit(rule({ schedule: 'daily' }), 500, MON, MON).due).toBe(false);   // banked today
  });

  it('monthly: days of the month, with the last day and months that are short', () => {
    const r = rule({ schedule: 'monthly', monthdays: [1, 15, 31] });
    expect(isDepositDay(r, '2026-11-01')).toBe(true);
    expect(isDepositDay(r, '2026-11-15')).toBe(true);
    expect(isDepositDay(r, '2026-11-30')).toBe(true);        // 31 falls on the last day of a 30-day month
    expect(isDepositDay(r, '2026-11-29')).toBe(false);
    expect(isDepositDay(r, '2027-02-28')).toBe(true);
    const last = rule({ schedule: 'monthly', monthdays: [0] });
    expect(isDepositDay(last, '2028-02-29')).toBe(true);
    expect(isDepositDay(last, '2028-02-28')).toBe(false);
    expect(lastDepositDay(r, '2026-11-20')).toBe('2026-11-15');
    expect(nextDepositDay(r, '2026-11-20')).toBe('2026-11-30');
  });

  it('describes the rule and checks the input', () => {
    expect(describeDepositRule(rule())).toBe('No deposit reminder is set.');
    expect(describeDepositRule(rule({ threshold: 20000, schedule: 'weekly', weekdays: [1, 4] }))).toMatch(/reaches 20,000.*Monday or Thursday.*whichever comes first/);
    expect(describeDepositRule(rule({ schedule: 'monthly', monthdays: [1, 15, 0] }))).toMatch(/1st or 15th or the last day/);
    expect(() => checkDepositRule(rule({ schedule: 'weekly' }))).toThrow(/weekday/);
    expect(() => checkDepositRule(rule({ schedule: 'monthly' }))).toThrow(/day of the month/);
    expect(() => parseDepositInput({ depositschedule: 'yearly' })).toThrow();
    expect(() => parseDepositInput({ depositweekdays: [7] })).toThrow();
    expect(() => parseDepositInput({ depositmonthdays: [32] })).toThrow();
    expect(parseDepositInput({ depositweekdays: [4, 1, 4] }).weekdays).toEqual([1, 4]);
    expect(parseDepositInput({})).toEqual({});
  });
});
