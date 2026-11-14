import { rollupCut } from './dashboard-rollup.service';

describe('roll-up cut', () => {
  it('reads everything live when the roll-up has never been built', () => {
    expect(rollupCut(null, '2026-11-15', '2026-04-01')).toBeNull();
  });
  it('uses the roll-up for whole months older than three months', () => {
    // today is in November, so the first day three months back is 1 August
    expect(rollupCut('2026-11-14', '2026-11-15', '2026-04-01')).toBe('2026-08-01');
  });
  it('never goes past the day after the roll-up is complete through', () => {
    expect(rollupCut('2026-06-10', '2026-11-15', '2026-04-01')).toBe('2026-06-11');
  });
  it('reads live when the whole range is recent', () => {
    expect(rollupCut('2026-11-14', '2026-11-15', '2026-09-01')).toBeNull();
    expect(rollupCut('2026-11-14', '2026-11-15', '2026-08-01')).toBeNull();
  });
  it('crosses a year end', () => {
    expect(rollupCut('2027-02-14', '2027-02-15', '2026-04-01')).toBe('2026-11-01');
  });
});
