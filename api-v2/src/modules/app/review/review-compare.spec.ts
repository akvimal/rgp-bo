import {
  Daily, MIN_ACTIVE_DAYS, comparePeople, historyFrom, yearAgo, yearCompare, yearFrom, judgeRate, judgeVolume, monthsBefore, mtdCompare, mtdRanges, phaseOf, phasesOf, ratesOf, usualWeek, verdictsOf, weekDays, zeroRaw,
} from './review-compare';

/** a month of days, the first ten busier, so there is history to compare with */
const month = (m: string, peak: number, other: number): Daily[] => {
  const n = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => {
    const day = `${m}-${String(i + 1).padStart(2, '0')}`;
    const bills = i < 10 ? peak : other;
    return { ...zeroRaw(), day, bills, sales: bills * 200, lines: bills * 3 };
  });
};

describe('comparing a week fairly', () => {
  it('tags the first ten days as peak, the next ten as middle and the rest as tail', () => {
    expect(['2026-11-01', '2026-11-10', '2026-11-11', '2026-11-20', '2026-11-21', '2026-11-30'].map(phaseOf)).toEqual(['peak', 'peak', 'mid', 'mid', 'tail', 'tail']);
    expect(phasesOf(weekDays('2026-11-09')).mix).toEqual({ peak: 2, mid: 5, tail: 0 });    // Mon 9 Nov to Sun 15 Nov
  });

  it('counts the months before a month, across a year end', () => {
    expect(monthsBefore('2026-11', 3)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(monthsBefore('2026-01', 3)).toEqual(['2025-12', '2025-11', '2025-10']);
  });

  it('usual for a peak week is the peak of the earlier months, not the quieter week before', () => {
    const history = [...month('2026-08', 100, 40), ...month('2026-09', 100, 40), ...month('2026-10', 100, 40)];
    const peakWeek = usualWeek(weekDays('2026-11-02'), history);                  // 2 to 8 Nov: all peak days
    const laterWeek = usualWeek(weekDays('2026-11-16'), history);                 // 16 to 22 Nov: middle and tail
    expect(peakWeek.raw!.bills).toBe(700);
    expect(laterWeek.raw!.bills).toBe(280);
    expect(peakWeek.raw!.sales).toBe(140000);
  });

  it("a week across the end of a month uses each day's own earlier months", () => {
    const history = [...month('2026-08', 100, 40), ...month('2026-09', 100, 40), ...month('2026-10', 100, 40), ...month('2026-11', 100, 40)];
    expect(usualWeek(weekDays('2026-11-30'), history).raw!.bills).toBe(40 + 6 * 100);   // Mon 30 Nov (tail), Tue 1 to Sun 6 Dec (peak)
  });

  it('has no usual when the history is too thin, and says why', () => {
    const thin = usualWeek(weekDays('2026-11-02'), month('2026-10', 100, 40));
    expect(thin.raw).toBeNull();
    expect((thin as any).reason).toMatch(/at least 2 earlier months/);
    // a month with bills on too few days does not count
    const sparse = month('2026-09', 100, 40).map((d, i) => (i >= MIN_ACTIVE_DAYS - 1 ? { ...d, bills: 0 } : d));
    expect(usualWeek(weekDays('2026-11-02'), [...month('2026-10', 100, 40), ...sparse]).raw).toBeNull();
  });

  it('turns totals into rates', () => {
    const r = ratesOf({ ...zeroRaw(), bills: 200, sales: 9000, disc: 1000, discBills: 20, lines: 500, below: 10, voids: 4, edits: 6, returns: 8, returnValue: 450 });
    expect(r.discountPct).toBe(10);                  // 1000 of 10000 before the discount
    expect(r.belowPer100Lines).toBe(2);
    expect(r.voidsPer100Bills).toBe(2);
    expect(r.editsPer100Bills).toBe(3);
    expect(r.returnsPer100Bills).toBe(4);
    expect(r.returnValuePct).toBe(5);
    expect(r.avgBill).toBe(45);
    expect(ratesOf(zeroRaw()).discountPct).toBeNull();
  });

  it('a peak week with more of everything but the same rates is as usual', () => {
    const usual = { ...zeroRaw(), bills: 400, sales: 80000, disc: 4000, discBills: 40, lines: 1200, below: 12, voids: 4, edits: 8, returns: 12, returnValue: 2000 };
    const peak = { ...zeroRaw(), bills: 600, sales: 120000, disc: 6000, discBills: 60, lines: 1800, below: 18, voids: 6, edits: 12, returns: 18, returnValue: 3000 };
    const v = verdictsOf(peak, usual);
    expect(v.bills).toBe('above');
    expect(v.sales).toBe('above');
    expect([v.discount, v.below, v.voids, v.edits, v.returns]).toEqual(['usual', 'usual', 'usual', 'usual', 'usual']);
  });

  it('flags a rate that is clearly higher and backed by several more events', () => {
    expect(judgeRate(6, 3, 30, 15)).toBe('above');
    expect(judgeRate(1, 3, 5, 15)).toBe('below');
    expect(judgeRate(6, 3, 12, 10)).toBe('usual');          // twice the rate, but two more events: noise in a small shop
    expect(judgeRate(3.5, 3, 40, 30)).toBe('usual');        // 17% over is inside the tolerance
    expect(judgeRate(null, 3, 0, 0)).toBe('unknown');
    expect(judgeRate(4, 0, 6, 0)).toBe('above');            // nothing usual, six now
  });

  it('judges volume to within 15 percent, and gives no verdict without a usual', () => {
    expect(judgeVolume(115, 100)).toBe('above');
    expect(judgeVolume(114, 100)).toBe('usual');
    expect(judgeVolume(85, 100)).toBe('below');
    expect(judgeVolume(50, null)).toBe('unknown');
    expect(verdictsOf(zeroRaw(), null).discount).toBe('unknown');
  });

  it('month to date runs to the week end, or today if the week is still on, against the same dates last month', () => {
    expect(mtdRanges('2026-11-15', '2026-11-20')).toEqual({ from: '2026-11-01', to: '2026-11-15', prevFrom: '2026-10-01', prevTo: '2026-10-15' });
    expect(mtdRanges('2026-11-15', '2026-11-12')).toEqual({ from: '2026-11-01', to: '2026-11-12', prevFrom: '2026-10-01', prevTo: '2026-10-12' });
    expect(mtdRanges('2026-03-31', '2026-04-05')).toEqual({ from: '2026-03-01', to: '2026-03-31', prevFrom: '2026-02-01', prevTo: '2026-02-28' });   // a shorter month last time
    // a week ending on the 1st belongs to October: the whole of October against the whole of September
    expect(mtdRanges('2026-11-01', '2026-11-09')).toEqual({ from: '2026-10-01', to: '2026-10-31', prevFrom: '2026-09-01', prevTo: '2026-09-30' });
    const c = mtdCompare([...month('2026-10', 100, 40), ...month('2026-11', 120, 50)], '2026-11-15', '2026-11-20');
    expect(c.current.bills).toBe(10 * 120 + 5 * 50);
    expect(c.previous.bills).toBe(10 * 100 + 5 * 40);
  });

  it('a year ago is 52 weeks back so a Monday is set beside a Monday', () => {
    expect(yearAgo('2026-11-09')).toBe('2025-11-10');
    expect(new Date('2025-11-10T00:00:00Z').getUTCDay()).toBe(new Date('2026-11-09T00:00:00Z').getUTCDay());
    const daily = [...month('2025-11', 100, 40), ...month('2025-10', 90, 30)];
    const c = yearCompare(daily, '2026-11-09', { from: '2026-11-01', to: '2026-11-15' });
    expect(c.week).toMatchObject({ from: '2025-11-10', to: '2025-11-16' });
    expect(c.week.raw.bills).toBe(100 + 6 * 40);                // 10 to 16 Nov 2025: the 10th is a peak day (100), the 11th to 16th are middle days (40)
    expect(c.available).toBe(true);
    expect(c.mtd).toMatchObject({ from: '2025-11-02', to: '2025-11-16' });
    expect(yearCompare([], '2026-11-09', { from: '2026-11-01', to: '2026-11-15' }).available).toBe(false);   // a new store has no year ago
    expect(yearFrom('2026-11-09', '2026-11-01')).toBe('2025-11-02');
    expect(yearFrom('2026-11-02', '2026-11-01')).toBe('2025-11-02');
  });

  it('sets each person against everyone else, not against a part of the month', () => {
    const p = (userid: number, name: string, o: Partial<Daily>) => ({ ...zeroRaw(), userid, name, ...o });
    const team = [
      p(1, 'Asha', { bills: 200, sales: 40000, disc: 400, discBills: 20, lines: 600, below: 6, voids: 2, edits: 2, returns: 4 }),
      p(2, 'Bala', { bills: 200, sales: 40000, disc: 4000, discBills: 90, lines: 600, below: 5, voids: 2, edits: 2, returns: 4 }),   // gives far more discount
      p(3, 'Chitra', { bills: 200, sales: 40000, disc: 400, discBills: 20, lines: 600, below: 6, voids: 2, edits: 2, returns: 4 }),
    ];
    const v = comparePeople(team);
    const bala = v.find((x) => x.name === 'Bala')!;
    expect(bala.verdicts.discount).toBe('above');
    expect(bala.verdicts.below).toBe('usual');
    expect(v.find((x) => x.name === 'Asha')!.verdicts.discount).toBe('usual');
    expect(v.map((x) => x.name).length).toBe(3);
    // a peak week lifts everyone alike: the same ratios, three times the volume, nobody is marked
    const busy = comparePeople(team.map((x) => ({ ...x, ...Object.fromEntries((['bills', 'sales', 'disc', 'discBills', 'lines', 'below', 'voids', 'edits', 'returns'] as const).map((k) => [k, x[k] * 3])) })));
    expect(busy.find((x) => x.name === 'Bala')!.verdicts.discount).toBe('above');           // still the outlier
    expect(busy.find((x) => x.name === 'Asha')!.verdicts.discount).toBe('usual');
  });

  it('gives no verdict to a person with few bills, or when there is no one to compare with', () => {
    const p = (userid: number, o: Partial<Daily>) => ({ ...zeroRaw(), userid, name: 'P' + userid, ...o });
    const few = comparePeople([p(1, { bills: 200, sales: 1, discBills: 20, disc: 10 }), p(2, { bills: 5, sales: 1, discBills: 5, disc: 100 })]);
    expect(few.find((x) => x.userid === 2)!.verdicts.discount).toBe('unknown');
    const alone = comparePeople([p(1, { bills: 300, sales: 1, discBills: 100, disc: 500 })]);
    expect(alone[0].verdicts.discount).toBe('unknown');
    expect(alone[0].peerRates).toBeNull();
    // a rate well over the others but only a couple of cases more: noise
    const small = comparePeople([p(1, { bills: 20, sales: 100, discBills: 3, disc: 10 }), p(2, { bills: 100, sales: 500, discBills: 5, disc: 10 })]);
    expect(small.find((x) => x.userid === 1)!.verdicts.discount).toBe('usual');
  });

  it('lists the person with the most sales first', () => {
    const p = (userid: number, sales: number) => ({ ...zeroRaw(), userid, name: 'P' + userid, bills: 30, sales });
    expect(comparePeople([p(1, 10), p(2, 30), p(3, 20)]).map((x) => x.userid)).toEqual([2, 3, 1]);
  });

  it('asks for the history from the first of the earliest month that can count', () => {
    expect(historyFrom('2026-11-09')).toBe('2026-08-01');
    expect(historyFrom('2026-01-05')).toBe('2025-10-01');
  });
});
