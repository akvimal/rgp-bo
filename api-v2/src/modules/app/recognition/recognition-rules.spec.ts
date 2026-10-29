import { activityRun, beatCount, captureRun, cleanDays, decide, discountSpike, RULES, standing, tillStreak } from './recognition-rules';

describe('habit measures', () => {
  it('counts accurate shifts in a row from the newest', () => {
    expect(tillStreak([0, 20, -30, 10])).toBe(4);
    expect(tillStreak([0, 20, 90, 10])).toBe(2);
    expect(tillStreak([null, 0])).toBe(0);
    expect(tillStreak([])).toBe(0);
  });
  it('counts days of mobile capture, with a floor on bills', () => {
    const d = (bills: number, withMobile: number) => ({ bills, withMobile });
    expect(captureRun([d(20, 19), d(30, 29), d(10, 10)], 95)).toBe(3);
    expect(captureRun([d(20, 19), d(30, 20), d(10, 10)], 95)).toBe(1);
    expect(captureRun([d(3, 3), d(30, 30)], 95)).toBe(0);
  });
  it('counts days running with a record', () => {
    expect(activityRun([true, true, false, true])).toBe(2);
    expect(activityRun([])).toBe(0);
  });
  it('counts days above the own usual, not above anyone else', () => {
    const days = [{ sales: 120, usual: 100 }, { sales: 90, usual: 100 }, { sales: 150, usual: null }, { sales: 101, usual: 100 }];
    expect(beatCount(days)).toBe(2);
    expect(beatCount(days, 1)).toBe(1);
  });
  it('pauses beat-your-usual when discounts rose', () => {
    expect(discountSpike(6, 3)).toBe(true);
    expect(discountSpike(3.5, 3)).toBe(false);
    expect(discountSpike(2.5, 1)).toBe(false);      // more than 1.5x but under 2 points more
    expect(discountSpike(5, null)).toBe(false);
  });
  it('counts clean days from the last late item, or from the first active day', () => {
    expect(cleanDays('2026-10-01', '2026-09-01', '2026-10-31')).toBe(30);
    expect(cleanDays(null, '2026-10-01', '2026-10-31')).toBe(30);
    expect(cleanDays(null, null, '2026-10-31')).toBe(0);
  });
});

describe('decide', () => {
  it('awards when the habit holds and the person has no badge', () => {
    expect(decide(standing(10, 10), false, false, false)).toBe('award');
    expect(decide(standing(9, 10), false, false, false)).toBe('none');
  });
  it('does not award while an own item is late, but never takes one away for that', () => {
    expect(decide(standing(12, 10), false, true, false)).toBe('none');
    expect(decide(standing(12, 10), true, true, false)).toBe('none');
  });
  it('lapses a badge only when the run is broken and no longer holds', () => {
    expect(decide(standing(0, 10), true, false, true)).toBe('lapse');
    expect(decide(standing(11, 10), true, false, false)).toBe('none');
    expect(decide(standing(6, 10), true, false, false)).toBe('none');    // a short dip without a break keeps it
  });
});

describe('rules', () => {
  it('has unique keys and no rule on raw sales or discount depth', () => {
    expect(new Set(RULES.map((r) => r.key)).size).toBe(RULES.length);
    for (const r of RULES) expect(r.key).not.toMatch(/sales|volume|discount/);
    expect(RULES.find((r) => r.key === 'refill')?.pack).toBe('pharmacy');
  });
});
