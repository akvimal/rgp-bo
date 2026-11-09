import { CalendarEntry, clipToWindow, sortEntries, typesAsked, windowProblem } from './calendar-rules';

describe('calendar rules', () => {
  it('accepts a normal window and refuses bad ones', () => {
    expect(windowProblem('2026-11-01', '2026-11-30')).toBeNull();
    expect(windowProblem('2026-11-30', '2026-11-01')).toMatch(/before/);
    expect(windowProblem('2026-02-30', '2026-03-05')).toMatch(/yyyy-mm-dd/);
    expect(windowProblem('x', '2026-03-05')).toMatch(/yyyy-mm-dd/);
    expect(windowProblem('2026-01-01', '2026-12-31')).toMatch(/at most/);
    expect(windowProblem('2026-01-01', '2026-04-10')).toBeNull(); // exactly 100 days
    expect(windowProblem('2026-01-01', '2026-04-11')).toMatch(/at most/);
  });

  it('keeps only known kinds, and all when none are asked', () => {
    expect(typesAsked('leave, todo,nonsense')).toEqual(['leave', 'todo']);
    expect(typesAsked('')).toHaveLength(7);
    expect(typesAsked(undefined)).toHaveLength(7);
    expect(typesAsked('nonsense')).toHaveLength(7);
  });

  it('clips a span to the window', () => {
    expect(clipToWindow('2026-10-25', '2026-11-03', '2026-11-01', '2026-11-30')).toEqual({ start: '2026-11-01', end: '2026-11-03' });
    expect(clipToWindow('2026-11-28', '2026-12-05', '2026-11-01', '2026-11-30')).toEqual({ start: '2026-11-28', end: '2026-11-30' });
    expect(clipToWindow('2026-10-01', '2026-10-31', '2026-11-01', '2026-11-30')).toBeNull();
    expect(clipToWindow('2026-12-01', '2026-12-02', '2026-11-01', '2026-11-30')).toBeNull();
  });

  it('orders by day, then hour, then kind', () => {
    const e = (id: string, type: any, start: string, time: string | null, title: string): CalendarEntry => ({ id, type, title, start, end: start, time, tone: 'info' });
    const out = sortEntries([e('3', 'todo', '2026-11-02', '10:00', 'b'), e('2', 'todo', '2026-11-02', null, 'z'), e('1', 'holiday', '2026-11-01', null, 'h'), e('4', 'leave', '2026-11-02', null, 'a')]);
    expect(out.map((x) => x.id)).toEqual(['1', '4', '2', '3']);
  });

  it('lists holidays and leave before follow-ups and attendance on the same day', () => {
    const e = (id: string, type: any): CalendarEntry => ({ id, type, title: 'x', start: '2026-11-08', end: '2026-11-08', tone: 'info' });
    const out = sortEntries([e('a', 'attendance'), e('f', 'followup'), e('t', 'todo'), e('l', 'leave'), e('h', 'holiday')]);
    expect(out.map((x) => x.type)).toEqual(['holiday', 'leave', 'todo', 'followup', 'attendance']);
  });
});
