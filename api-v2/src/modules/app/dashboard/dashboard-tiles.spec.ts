import { compareOf, deltaOf, marginOf, periodsFor, sharePct } from './dashboard-tiles';

describe('periodsFor', () => {
  it('month to date against the same days of the previous month', () => {
    expect(periodsFor('2026-10-15', 'prev')).toEqual({ from: '2026-10-01', to: '2026-10-16', cmpFrom: '2026-09-01', cmpTo: '2026-09-16' });
  });
  it('clamps to the length of a shorter previous month', () => {
    expect(periodsFor('2026-03-31', 'prev')).toEqual({ from: '2026-03-01', to: '2026-04-01', cmpFrom: '2026-02-01', cmpTo: '2026-03-01' });
  });
  it('January compares with December of the year before', () => {
    expect(periodsFor('2026-01-10', 'prev').cmpFrom).toBe('2025-12-01');
  });
  it('the same days a year earlier, clamped for a leap day', () => {
    expect(periodsFor('2026-10-15', 'lastyear')).toEqual({ from: '2026-10-01', to: '2026-10-16', cmpFrom: '2025-10-01', cmpTo: '2025-10-16' });
    expect(periodsFor('2024-02-29', 'lastyear').cmpTo).toBe('2023-03-01');
  });
  it('anything but lastyear is the previous month', () => {
    expect(compareOf('lastyear')).toBe('lastyear');
    expect(compareOf('x')).toBe('prev');
    expect(compareOf(undefined)).toBe('prev');
  });
});

describe('deltaOf', () => {
  it('is good when it moves the right way for the metric', () => {
    expect(deltaOf(120, 100, 'up')).toEqual({ pct: 20, dir: 'up', tone: 'good' });
    expect(deltaOf(80, 100, 'up')).toEqual({ pct: -20, dir: 'down', tone: 'bad' });
    expect(deltaOf(8, 10, 'down')).toEqual({ pct: -20, dir: 'down', tone: 'good' });
    expect(deltaOf(12, 10, 'down')).toEqual({ pct: 20, dir: 'up', tone: 'bad' });
  });
  it('is flat under half a percent, and has nothing to say without a comparison', () => {
    expect(deltaOf(100.2, 100, 'up').tone).toBe('flat');
    expect(deltaOf(5, 0, 'up')).toEqual({ pct: null, dir: null, tone: null });
  });
});

describe('marginOf', () => {
  it('is the margin over the lines with a known cost, with how much of the sales that covers', () => {
    expect(marginOf(1000, 700, 1000)).toEqual({ pct: 30, coverage: 100 });
    expect(marginOf(900, 630, 1000)).toEqual({ pct: 30, coverage: 90 });
  });
  it('is withheld when too little of the sales has a cost', () => {
    expect(marginOf(500, 300, 1000)).toEqual({ pct: null, coverage: 50 });
    expect(marginOf(0, 0, 0)).toEqual({ pct: null, coverage: 0 });
  });
  it('shares are zero without a whole', () => {
    expect(sharePct(5, 0)).toBe(0);
    expect(sharePct(1, 3)).toBe(33.3);
  });
});
