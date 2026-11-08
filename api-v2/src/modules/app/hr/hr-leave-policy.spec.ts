import { adviceNotes, creditedDays, eligibleFrom, longestStretch, startMonth } from './hr-leave-policy';

const CL = { annual: 12, accrual: 'MONTHLY' as const };

describe('when a person starts earning', () => {
  it('is the joining month on or before the 15th, the next month after it', () => {
    expect(startMonth('2026-03-10', 2026)).toBe(3);
    expect(startMonth('2026-03-15', 2026)).toBe(3);
    expect(startMonth('2026-03-16', 2026)).toBe(4);
    expect(startMonth('2026-12-20', 2026)).toBe(13);
  });
  it('is January for someone who joined in an earlier year, and never for a later one', () => {
    expect(startMonth('2024-08-01', 2026)).toBe(1);
    expect(startMonth('2027-01-02', 2026)).toBe(13);
  });
});

describe('days credited as of a date', () => {
  it('builds up a twelfth a month through the year and resets each January', () => {
    expect(creditedDays(CL, '2020-01-01', '2026-01-10')).toBe(1);
    expect(creditedDays(CL, '2020-01-01', '2026-06-30')).toBe(6);
    expect(creditedDays(CL, '2020-01-01', '2026-12-31')).toBe(12);
    expect(creditedDays(CL, '2020-01-01', '2027-01-02')).toBe(1);
  });
  it('starts a joiner in the joining month (or the next)', () => {
    expect(creditedDays(CL, '2026-03-10', '2026-12-31')).toBe(10);
    expect(creditedDays(CL, '2026-03-20', '2026-12-31')).toBe(9);
    expect(creditedDays(CL, '2026-03-20', '2026-03-31')).toBe(0);
  });
  it('credits half a day a month of a 6 day sick leave', () => {
    expect(creditedDays({ annual: 6, accrual: 'MONTHLY' }, '2020-01-01', '2026-04-05')).toBe(2);
  });
  it('gives the whole year at once when it is not monthly', () => {
    expect(creditedDays({ annual: 12, accrual: 'YEARLY' }, '2026-03-10', '2026-03-11')).toBe(12);
  });
  it('is nothing for a type with no days', () => {
    expect(creditedDays({ annual: 0, accrual: 'MONTHLY' }, '2020-01-01', '2026-06-01')).toBe(0);
  });
});

describe('the first day leave can be taken', () => {
  it('is the joining date plus the waiting months', () => {
    expect(eligibleFrom('2026-03-10', 3)).toBe('2026-06-10');
    expect(eligibleFrom('2026-11-20', 3)).toBe('2027-02-20');
    expect(eligibleFrom('2026-03-10', 0)).toBe('2026-03-10');
  });
  it('falls on the last day of a shorter month', () => {
    expect(eligibleFrom('2026-05-31', 1)).toBe('2026-06-30');
    expect(eligibleFrom('2026-11-30', 3)).toBe('2027-02-28');
  });
});

describe('days taken together', () => {
  // 2026-11-06 is a Friday; the weekend 7th and 8th is off
  const off = (d: string) => d === '2026-11-07' || d === '2026-11-08' || d === '2026-11-26';
  it('two days in a row are a stretch of two', () => {
    expect(longestStretch(['2026-11-03', '2026-11-04'], [], off, true).days).toBe(2);
  });
  it('a Friday and the Monday after count as four when the weekend between counts', () => {
    const s = longestStretch(['2026-11-09'], ['2026-11-06'], off, true);
    expect([s.days, s.from, s.to]).toEqual([4, '2026-11-06', '2026-11-09']);
  });
  it('and as two when only leave days count', () => {
    expect(longestStretch(['2026-11-09'], ['2026-11-06'], off, false).days).toBe(2);
  });
  it('a working day between breaks the run', () => {
    expect(longestStretch(['2026-11-10'], ['2026-11-06'], off, true).days).toBe(1);
  });
  it('leave next to a weekend, but not across it, is not extended by it', () => {
    expect(longestStretch(['2026-11-05', '2026-11-06'], [], off, true).days).toBe(2);
  });
  it('a request next to leave already taken makes a longer stretch', () => {
    expect(longestStretch(['2026-11-12'], ['2026-11-10', '2026-11-11'], off, true).days).toBe(3);
  });
  it('only the run holding the new days is measured', () => {
    expect(longestStretch(['2026-11-03'], ['2026-11-17', '2026-11-18', '2026-11-19'], off, true).days).toBe(1);
  });
});

describe('advised days of a leave type', () => {
  const rule = { fromDay: 11, toDay: 25, avoidWeekdays: [0, 6] };
  it('says nothing when the days fit', () => {
    // Tuesday 11 and Wednesday 12 November 2026
    expect(adviceNotes(['2026-11-11', '2026-11-12'], rule)).toEqual([]);
  });
  it('names the days outside the 11th to 25th', () => {
    const n = adviceNotes(['2026-11-05', '2026-11-12'], rule);
    expect(n).toHaveLength(1);
    expect(n[0]).toContain('11th and the 25th');
    expect(n[0]).toContain('5 Nov is outside');
  });
  it('names a Saturday or Sunday', () => {
    const n = adviceNotes(['2026-11-14', '2026-11-15'], rule);
    expect(n).toHaveLength(1);
    expect(n[0]).toContain('Saturday 14 Nov');
    expect(n[0]).toContain('Sunday 15 Nov');
  });
  it('gives both notes when both are broken', () => {
    expect(adviceNotes(['2026-11-01'], rule)).toHaveLength(2);   // 1 Nov 2026 is a Sunday
  });
  it('has no advice when none is set', () => {
    expect(adviceNotes(['2026-11-01'], { fromDay: null, toDay: null, avoidWeekdays: null })).toEqual([]);
  });
  it('reads the ordinals', () => {
    expect(adviceNotes(['2026-11-02'], { fromDay: 21, toDay: 23, avoidWeekdays: null })[0]).toContain('21st and the 23rd');
  });
});
