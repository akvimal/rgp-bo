import { addDays, cleanTime, dayOf, dueInstant, firstOnOrAfter, istDay, makeOnOrAfter, nextAfter, occursOn, repeatProblem, stageOf } from './todo-rules';

describe('the shop day', () => {
  it('is India\'s day, not the server\'s', () => {
    expect(istDay(new Date('2026-11-05T20:00:00Z'))).toBe('2026-11-06');     // 1:30 am on the 6th in India
    expect(istDay(new Date('2026-11-05T17:00:00Z'))).toBe('2026-11-05');
  });
  it('a due time is the shop\'s clock', () => {
    expect(dueInstant('2026-11-06', '09:00').toISOString()).toBe('2026-11-06T03:30:00.000Z');
    expect(dayOf(dueInstant('2026-11-06', '00:30'))).toBe('2026-11-06');
    expect(dueInstant('2026-11-06', 'nonsense').toISOString()).toBe('2026-11-06T03:30:00.000Z');
  });
});

describe('repeats', () => {
  it('daily and weekdays', () => {
    expect(nextAfter({ repeat: 'DAILY' }, '2026-11-05')).toBe('2026-11-06');
    expect(nextAfter({ repeat: 'WEEKDAYS' }, '2026-11-06')).toBe('2026-11-09');      // Friday -> Monday
    expect(firstOnOrAfter({ repeat: 'WEEKDAYS' }, '2026-11-07')).toBe('2026-11-09');  // Saturday -> Monday
  });
  it('weekly on chosen days', () => {
    const r = { repeat: 'WEEKLY' as const, days: [1, 4] };      // Monday and Thursday
    expect(firstOnOrAfter(r, '2026-11-05')).toBe('2026-11-05');       // Thursday
    expect(nextAfter(r, '2026-11-05')).toBe('2026-11-09');            // Monday
    expect(nextAfter(r, '2026-11-09')).toBe('2026-11-12');
  });
  it('monthly on a day, and on the last day', () => {
    expect(nextAfter({ repeat: 'MONTHLY', day: 15 }, '2026-11-15')).toBe('2026-12-15');
    expect(nextAfter({ repeat: 'MONTHLY', day: 0 }, '2026-11-30')).toBe('2026-12-31');
    expect(nextAfter({ repeat: 'MONTHLY', day: 0 }, '2026-01-31')).toBe('2026-02-28');
    // the 31st falls on the last day of a shorter month instead of being skipped
    expect(nextAfter({ repeat: 'MONTHLY', day: 31 }, '2026-01-31')).toBe('2026-02-28');
    expect(nextAfter({ repeat: 'MONTHLY', day: 31 }, '2026-02-28')).toBe('2026-03-31');
    expect(occursOn({ repeat: 'MONTHLY', day: 30 }, '2028-02-29')).toBe(true);
  });
  it('every N days follows the day it was done', () => {
    expect(nextAfter({ repeat: 'EVERY_N_DAYS_AFTER_DONE', every: 10 }, '2026-11-05')).toBe('2026-11-15');
    expect(firstOnOrAfter({ repeat: 'EVERY_N_DAYS_AFTER_DONE', every: 10 }, '2026-11-05')).toBe('2026-11-05');
    expect(occursOn({ repeat: 'EVERY_N_DAYS_AFTER_DONE', every: 10 }, '2026-11-05')).toBe(false);
  });
  it('asks for what is missing', () => {
    expect(repeatProblem({ repeat: 'WEEKLY' })).toContain('days of the week');
    expect(repeatProblem({ repeat: 'WEEKLY', days: [9] })).toContain('days of the week');
    expect(repeatProblem({ repeat: 'MONTHLY' })).toContain('day of the month');
    expect(repeatProblem({ repeat: 'EVERY_N_DAYS_AFTER_DONE', every: 0 })).toContain('how many days');
    expect(repeatProblem({ repeat: 'DAILY' })).toBeNull();
    expect(repeatProblem({ repeat: 'WEEKLY', days: [1] })).toBeNull();
    expect(repeatProblem({ repeat: 'FORTNIGHTLY' as any })).toContain('how often');
  });
  it('is made when its heads-up begins', () => {
    expect(makeOnOrAfter('2026-11-10', 1)).toBe('2026-11-09');
    expect(makeOnOrAfter('2026-11-10', 0)).toBe('2026-11-10');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('where a to-do is in its reminders', () => {
  const due = dueInstant('2026-11-10', '09:00');
  const at = (iso: string) => new Date(iso);
  it('nothing until the heads-up days', () => {
    expect(stageOf(due, at('2026-11-07T10:00:00+05:30'), 1, 3)).toBe('none');
    expect(stageOf(due, at('2026-11-09T00:30:00+05:30'), 1, 3)).toBe('soon');
    expect(stageOf(due, at('2026-11-10T08:59:00+05:30'), 1, 3)).toBe('soon');     // the day, before the time
  });
  it('due from the time, on that day', () => {
    expect(stageOf(due, at('2026-11-10T09:00:00+05:30'), 1, 3)).toBe('due');
    expect(stageOf(due, at('2026-11-10T23:59:00+05:30'), 1, 3)).toBe('due');
  });
  it('overdue from the next day and escalated after the limit', () => {
    expect(stageOf(due, at('2026-11-11T08:00:00+05:30'), 1, 3)).toBe('overdue');
    expect(stageOf(due, at('2026-11-12T08:00:00+05:30'), 1, 3)).toBe('overdue');
    expect(stageOf(due, at('2026-11-13T08:00:00+05:30'), 1, 3)).toBe('escalated');
    expect(stageOf(due, at('2026-11-30T08:00:00+05:30'), 1, 3)).toBe('escalated');
  });
  it('a heads-up of 0 means no heads-up, and an escalation of 0 is the next day', () => {
    expect(stageOf(due, at('2026-11-09T12:00:00+05:30'), 0, 3)).toBe('none');
    expect(stageOf(due, at('2026-11-11T08:00:00+05:30'), 0, 0)).toBe('escalated');
  });
});

describe('times of day', () => {
  it('are cleaned', () => {
    expect(cleanTime('9:05')).toBe('09:05');
    expect(cleanTime('23:59')).toBe('23:59');
    expect(cleanTime('24:00')).toBeNull();
    expect(cleanTime('soon')).toBeNull();
  });
});
