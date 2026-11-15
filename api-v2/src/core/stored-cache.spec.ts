import { isFresh, tierMaxAge, wantsRefresh } from './stored-cache';

const at = (iso: string) => Date.parse(iso);

describe('isFresh', () => {
  it('hourly: fresh within the hour, not after', () => {
    const built = at('2026-11-15T10:00:00+05:30');
    expect(isFresh('hourly', built, built + 59 * 60_000)).toBe(true);
    expect(isFresh('hourly', built, built + 61 * 60_000)).toBe(false);
  });

  it('daily: fresh the same India day, stale from the first open of the next day', () => {
    const built = at('2026-11-15T06:10:00+05:30');
    expect(isFresh('daily', built, at('2026-11-15T23:50:00+05:30'))).toBe(true);
    expect(isFresh('daily', built, at('2026-11-16T00:05:00+05:30'))).toBe(false);
  });

  it('daily: the day turns at midnight in India, not in UTC', () => {
    const built = at('2026-11-15T23:50:00+05:30');                       // 18:20 UTC the same date
    expect(isFresh('daily', built, at('2026-11-16T00:10:00+05:30'))).toBe(false);   // 18:40 UTC: still the 15th in UTC
  });

  it('daily: never older than a day, even on one date', () => {
    const built = at('2026-11-15T00:10:00+05:30');
    expect(isFresh('daily', built, built + 25 * 3600_000)).toBe(false);
  });

  it('weekly: fresh through Sunday, stale from Monday', () => {
    const built = at('2026-11-10T10:00:00+05:30');                       // a Tuesday
    expect(isFresh('weekly', built, at('2026-11-15T22:00:00+05:30'))).toBe(true);   // Sunday
    expect(isFresh('weekly', built, at('2026-11-16T00:30:00+05:30'))).toBe(false);  // Monday
  });

  it('a figure stamped in the future is not trusted', () => {
    const now = at('2026-11-15T10:00:00+05:30');
    expect(isFresh('hourly', now + 10 * 60_000, now)).toBe(false);
  });

  it('the longest age of a tier can be set', () => {
    process.env.DASH_TTL_HOURLY_MIN = '5';
    expect(tierMaxAge('hourly')).toBe(5 * 60_000);
    delete process.env.DASH_TTL_HOURLY_MIN;
    expect(tierMaxAge('hourly')).toBe(60 * 60_000);
  });
});

describe('wantsRefresh', () => {
  it('reads ?refresh=1', () => {
    expect(wantsRefresh({ refresh: '1' })).toBe(true);
    expect(wantsRefresh({ refresh: 'true' })).toBe(true);
    expect(wantsRefresh({ refresh: '0' })).toBe(false);
    expect(wantsRefresh({})).toBe(false);
    expect(wantsRefresh(undefined)).toBe(false);
  });
});
