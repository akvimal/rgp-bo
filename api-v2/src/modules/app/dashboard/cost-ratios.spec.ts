import { costRatios } from './cost-ratios';

const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const sales = months.map((month) => ({ month, sales: 10000 }));
const rent = (v: number[]) => v.map((amount, i) => ({ month: months[i], grp: 'Premises', amount }));

describe('cost ratios', () => {
  it('gives each month as a share of sales', () => {
    const r = costRatios(rent([1000, 1000, 1000, 1000, 1000, 1000]), sales, months);
    expect(r.groups[0].series[0]).toMatchObject({ amount: 1000, pct: 10 });
  });
  it('flags the latest month when it is above the usual band', () => {
    const r = costRatios(rent([1000, 1100, 900, 1000, 1050, 2000]), sales, months);
    expect(r.groups[0].status).toBe('high');
    expect(r.notes[0]).toContain('Premises is 20% of sales');
  });
  it('calls a month inside the band usual, and one below it low', () => {
    expect(costRatios(rent([1000, 1100, 900, 1000, 1050, 1000]), sales, months).groups[0].status).toBe('usual');
    expect(costRatios(rent([1000, 1100, 900, 1000, 1050, 100]), sales, months).groups[0].status).toBe('low');
  });
  it('says there is not enough history with fewer than four earlier months', () => {
    const r = costRatios(rent([0, 0, 0, 1000, 1000, 1000]).filter((c) => c.month >= '2026-04'), sales, months);
    expect(r.groups[0].status).toBe('thin');
    expect(r.notes.join(' ')).toContain('at least four');
  });
  it('can treat an earlier month as the latest, and has no ratio for a month with no sales', () => {
    const r = costRatios(rent([1000, 1000, 1000, 1000, 5000, 1000]), sales, months, { latest: '2026-05' });
    expect(r.groups[0].status).toBe('high');
    const none = costRatios(rent([1, 1, 1, 1, 1, 1]), [], months);
    expect(none.groups[0].series[0].pct).toBeNull();
  });
});
