import { CASH_TOLERANCE, ShiftRow, cashSummary, topAsked, topLookups } from './review-extras';
import { comparePeople } from './review-compare';
import { MARGIN_POINTS, judgePoints, ratesOf, verdictsOf, zeroRaw } from './review-compare';

const shift = (id: number, status: string, variance: number | null, day = '2026-11-03', who = 'Asha'): ShiftRow =>
  ({ id, shift_date: day, name: 'Morning', store: 'Main', status, expected: 1000, counted: variance === null ? null : 1000 + variance, variance, who });

describe('weekly review extras', () => {
  it('cash: counts closed shifts, those out by more than the tolerance, short and over, and the biggest', () => {
    const c = cashSummary([shift(1, 'CLOSED', 0), shift(2, 'CLOSED', -50), shift(3, 'CLOSED', 20), shift(4, 'CLOSED', 1), shift(5, 'CLOSED', -1.5)], '2026-11-09');
    expect(c).toMatchObject({ shifts: 5, closed: 5, off: 3, short: 2, over: 1, shortTotal: 51.5, overTotal: 20, biggest: 50 });
    expect(c.offList.map((r) => r.id)).toEqual([2, 3, 5]);              // the biggest difference first
    expect(CASH_TOLERANCE).toBe(1);
  });

  it('cash: a shift opened and not closed by the end of its day is listed; today and future ones are not', () => {
    const c = cashSummary([shift(1, 'OPEN', null, '2026-11-03'), shift(2, 'OPEN', null, '2026-11-09'), shift(3, 'PLANNED', null, '2026-11-02'), shift(4, 'CLOSED', 0)], '2026-11-09');
    expect(c.unclosed).toBe(1);
    expect(c.unclosedList[0].id).toBe(1);
    expect(c.closed).toBe(1);
  });

  it('cash: nothing in the week is all zeros', () => {
    expect(cashSummary([], '2026-11-09')).toMatchObject({ shifts: 0, closed: 0, off: 0, unclosed: 0, shortTotal: 0, biggest: 0 });
  });

  it('asked for: groups the same product however it was typed, most asked first', () => {
    const t = topAsked([{ product_text: 'Telma 40' }, { product_text: ' telma  40 ' }, { product_text: 'Dolo 650' }, { product_text: 'TELMA 40' }, { product_text: '' }, { product_text: 'x' }, { product_text: null }]);
    expect(t).toEqual([{ name: 'Telma 40', count: 3 }, { name: 'Dolo 650', count: 1 }]);
    expect(topAsked(Array.from({ length: 20 }, (_, i) => ({ product_text: 'Item ' + i })), 5).length).toBe(5);
  });

  it('margin, generic share, named customers, new customers and unmet requests become rates', () => {
    const r = ratesOf({ ...zeroRaw(), bills: 200, lines: 500, sales: 40000, costedSales: 30000, cost: 18000, genericLines: 150, named: 120, newCust: 10, unmet: 6 });
    expect(r.marginPct).toBe(40);                  // 12000 on 30000
    expect(r.genericPct).toBe(30);
    expect(r.namedPct).toBe(60);
    expect(r.newCustPer100Bills).toBe(5);
    expect(r.unmetPer100Bills).toBe(3);
    expect(ratesOf(zeroRaw()).marginPct).toBeNull();
  });

  it('margin is judged in percentage points against usual, and a peak week with the same margin is as usual', () => {
    expect(judgePoints(36, 40, MARGIN_POINTS)).toBe('below');
    expect(judgePoints(37.5, 40, MARGIN_POINTS)).toBe('usual');
    expect(judgePoints(44, 40, MARGIN_POINTS)).toBe('above');
    expect(judgePoints(null, 40, MARGIN_POINTS)).toBe('unknown');
    const usual = { ...zeroRaw(), bills: 400, lines: 1200, costedSales: 60000, cost: 36000, genericLines: 360, unmet: 8 };
    const peak = { ...zeroRaw(), bills: 600, lines: 1800, costedSales: 90000, cost: 54000, genericLines: 540, unmet: 12 };
    const v = verdictsOf(peak, usual);
    expect([v.margin, v.generic, v.unmet]).toEqual(['usual', 'usual', 'usual']);
    const thin = verdictsOf({ ...peak, cost: 63000 }, usual);                   // cost up: margin 30% against 40%
    expect(thin.margin).toBe('below');
    const unmet = verdictsOf({ ...peak, unmet: 40 }, usual);                    // far more unmet requests per bill, and many more of them
    expect(unmet.unmet).toBe('above');
  });
});

describe('weekly review step 4', () => {
  it('brand checks with no match: the same brand typed two ways counts once, with its composition, most often first', () => {
    const t = topLookups([
      { text: 'Telma 40', composition: null }, { text: ' telma  40', composition: 'Telmisartan 40 mg' }, { text: 'Dolo 650', composition: 'Paracetamol 650 mg' },
      { text: 'TELMA 40', composition: 'x' }, { text: '', composition: null }, { text: null, composition: null },
    ]);
    expect(t).toEqual([{ name: 'Telma 40', composition: 'Telmisartan 40 mg', count: 3 }, { name: 'Dolo 650', composition: 'Paracetamol 650 mg', count: 1 }]);
  });

  it('no match per 100 bills is a rate with a usual, and marked above usual by the same rule', () => {
    const usual = { ...zeroRaw(), bills: 400, lookups: 20, noMatch: 8 };
    const calm = verdictsOf({ ...zeroRaw(), bills: 600, lookups: 30, noMatch: 12 }, usual);
    expect(calm.lookups).toBe('usual');
    const more = verdictsOf({ ...zeroRaw(), bills: 400, lookups: 40, noMatch: 30 }, usual);
    expect(more.lookups).toBe('above');
    expect(ratesOf({ ...zeroRaw(), bills: 200, noMatch: 5 }).noMatchPer100Bills).toBe(2.5);
  });

  it('a person whose margin is well under the others is marked, once there is enough sold to say', () => {
    const p = (userid: number, name: string, costedSales: number, cost: number) => ({ ...zeroRaw(), userid, name, bills: 100, lines: 300, sales: costedSales, costedSales, cost });
    const team = [p(1, 'Asha', 20000, 10000), p(2, 'Bala', 20000, 14000), p(3, 'Chitra', 20000, 10000)];     // 50%, 30%, 50%
    const v = comparePeople(team);
    expect(v.find((x) => x.name === 'Bala')!.verdicts.margin).toBe('below');
    expect(v.find((x) => x.name === 'Asha')!.verdicts.margin).toBe('usual');
    // a margin well above the others is not a worry
    const high = comparePeople([p(1, 'Asha', 20000, 4000), p(2, 'Bala', 20000, 10000), p(3, 'Chitra', 20000, 10000)]);
    expect(high.find((x) => x.name === 'Asha')!.verdicts.margin).toBe('usual');
    // too little sold on costed lines: no verdict
    const thin = comparePeople([p(1, 'Asha', 500, 400), p(2, 'Bala', 20000, 10000), p(3, 'Chitra', 20000, 10000)]);
    expect(thin.find((x) => x.name === 'Asha')!.verdicts.margin).toBe('unknown');
  });
});
