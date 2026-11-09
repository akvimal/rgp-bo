import { addDays, addMonths, daysOf, groupByDay, monthDays, step, weekStart } from './calendar-grid';

describe('calendar grid', () => {
  it('moves days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('keeps the day of the month when a month is added, clipping to the last day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-09', 1)).toBe('2026-12-09');
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
  });

  it('starts weeks on Sunday', () => {
    expect(weekStart('2026-11-09')).toBe('2026-11-08'); // a Monday is 9 Nov 2026, so the Sunday before is 8 Nov
    expect(weekStart('2026-11-08')).toBe('2026-11-08');
  });

  it('draws a month as six whole weeks that contain it', () => {
    const days = monthDays('2026-11-09');
    expect(days).toHaveLength(42);
    expect(days).toContain('2026-11-30');
    expect(days[0] <= '2026-11-01').toBeTrue();
    expect(new Date(days[0] + 'T00:00:00Z').getUTCDay()).toBe(0);
  });

  it('asks for the days a view draws', () => {
    expect(daysOf('day', '2026-11-09')).toEqual(['2026-11-09']);
    expect(daysOf('week', '2026-11-09')).toHaveLength(7);
    expect(step('week', '2026-11-09', 1)).toBe('2026-11-16');
    expect(step('month', '2026-11-09', -1)).toBe('2026-10-09');
  });

  it('puts a span on every day it covers', () => {
    const g = groupByDay([{ start: '2026-11-02', end: '2026-11-04' }, { start: '2026-11-03', end: '2026-11-03' }], ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(g['2026-11-02'].length).toBe(1);
    expect(g['2026-11-03'].length).toBe(2);
    expect(g['2026-11-05'].length).toBe(0);
  });
});
