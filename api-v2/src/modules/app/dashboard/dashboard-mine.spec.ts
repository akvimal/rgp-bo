import { aimFromUsual, againstUsual, capturePct, goalProgress, ringPct, usualOf } from './dashboard-mine';

describe('staff and counter figures', () => {
  it('measures mobile capture and handles no bills', () => {
    expect(capturePct(21, 24)).toBe(88);
    expect(capturePct(0, 0)).toBeNull();
  });
  it('takes the usual as the average of earlier weeks', () => {
    expect(usualOf([100, 200, 300])).toBe(200);
    expect(usualOf([])).toBeNull();
  });
  it('compares a day with its own usual only', () => {
    expect(againstUsual(5500, 5000)).toEqual({ diff: 500, pct: 10 });
    expect(againstUsual(4000, 5000)).toEqual({ diff: -1000, pct: -20 });
    expect(againstUsual(4000, null)).toBeNull();
    expect(againstUsual(100, 0)).toEqual({ diff: 100, pct: null });
  });
  it('tracks goals and caps them at 100', () => {
    expect(goalProgress({ key: 'a', title: 'a', done: 2, of: 4, note: '' })).toEqual({ pct: 50, complete: false });
    expect(goalProgress({ key: 'a', title: 'a', done: 5, of: 4, note: '' })).toEqual({ pct: 100, complete: true });
    expect(goalProgress({ key: 'a', title: 'a', done: 0, of: 0, note: '' })).toEqual({ pct: 100, complete: true });
  });
  it('sets the aim as the usual plus a stretch and fills the ring toward it', () => {
    expect(aimFromUsual(50000)).toBe(55000);
    expect(aimFromUsual(50000, 0)).toBe(50000);
    expect(aimFromUsual(null)).toBeNull();
    expect(ringPct(27500, 55000)).toBe(50);
    expect(ringPct(99000, 55000)).toBe(100);
    expect(ringPct(10, null)).toBeNull();
  });
});
