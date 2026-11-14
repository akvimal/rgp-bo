import { cleanFilter, rangeOf } from './dashboard-filter.service';

describe('dashboard filter', () => {
  // 15 November 2026, 12:00 in India
  const now = new Date('2026-11-15T06:30:00Z');

  it('works out the month range of each period', () => {
    expect(rangeOf('month', now)).toEqual({ from: '2026-11', to: '2026-11' });
    expect(rangeOf('lastmonth', now)).toEqual({ from: '2026-10', to: '2026-10' });
    expect(rangeOf('6m', now)).toEqual({ from: '2026-06', to: '2026-11' });
    expect(rangeOf('12m', now)).toEqual({ from: '2025-12', to: '2026-11' });
    expect(rangeOf('fy', now)).toEqual({ from: '2026-04', to: '2027-03' });
    expect(rangeOf('lastfy', now)).toEqual({ from: '2025-04', to: '2026-03' });
  });
  it('puts January to March in the financial year that began the April before', () => {
    const feb = new Date('2027-02-10T06:30:00Z');
    expect(rangeOf('fy', feb)).toEqual({ from: '2026-04', to: '2027-03' });
    expect(rangeOf('lastmonth', new Date('2027-01-05T06:30:00Z'))).toEqual({ from: '2026-12', to: '2026-12' });
  });
  it('takes the date in India, not UTC', () => {
    // 31 October 20:00 UTC is already 1 November in India
    expect(rangeOf('month', new Date('2026-10-31T20:00:00Z'))).toEqual({ from: '2026-11', to: '2026-11' });
  });
  it('ignores a period or comparison it does not know', () => {
    expect(cleanFilter({ period: 'forever', compare: 'yoy' })).toEqual({ period: 'fy', compare: 'yoy' });
    expect(cleanFilter(null)).toEqual({ period: 'fy', compare: 'none' });
    expect(cleanFilter({ period: '12m', compare: 'prev' })).toEqual({ period: '12m', compare: 'prev' });
  });
});
