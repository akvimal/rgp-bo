import { addDays, billDiscountPct, groupReturns, isMonday, isOver, isValidDay, lastFullWeek, marked, mondayOf, pctOff, readEdit, reviewLate, summarise, weekRange } from './review-rules';

describe('weekly review rules', () => {
  it('finds the Monday of any day, including Sunday and Monday itself', () => {
    expect(mondayOf('2026-10-24')).toBe('2026-10-19');   // a Saturday
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');   // the Sunday ends the week
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(isMonday('2026-10-19')).toBe(true);
    expect(isMonday('2026-10-20')).toBe(false);
  });

  it('crosses month and year ends', () => {
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('reviews the week before this one, whatever day it is today', () => {
    expect(lastFullWeek('2026-10-24')).toBe('2026-10-12');
    expect(lastFullWeek('2026-10-26')).toBe('2026-10-19');   // Monday: the week that just ended
    expect(lastFullWeek('2026-10-25')).toBe('2026-10-12');   // Sunday: this week is not over yet
  });

  it('a week runs Monday to Sunday and can be signed once Sunday is over', () => {
    expect(weekRange('2026-10-19')).toEqual({ start: '2026-10-19', end: '2026-10-25', next: '2026-10-26' });
    expect(isOver('2026-10-19', '2026-10-25')).toBe(false);
    expect(isOver('2026-10-19', '2026-10-26')).toBe(true);
  });

  it('is late once the days of grace after the week have passed', () => {
    expect(reviewLate('2026-10-12', '2026-10-21', 3)).toBe(false);
    expect(reviewLate('2026-10-12', '2026-10-22', 3)).toBe(true);
  });

  it('accepts only real calendar days', () => {
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('2026-10-19')).toBe(true);
    expect(isValidDay('19-10-2026')).toBe(false);
    expect(isValidDay(undefined)).toBe(false);
  });

  it('measures a price below list and a discount against the bill before it', () => {
    expect(pctOff(100, 80)).toBe(20);
    expect(pctOff(0, 0)).toBe(0);
    expect(billDiscountPct(10, 90)).toBe(10);
    expect(billDiscountPct(0, 0)).toBe(0);
  });

  it('sums each kind of exception and marks the ones to look at', () => {
    const d = {
      discounts: [{ disc: 10, pct: 12 }, { disc: 5, pct: 3 }],
      below: [{ value: 7.5 }],
      voids: [{ total: 200, hours: 30 }, { total: 50, hours: 1 }],
      edits: [{ reduced: 30, flagged: true }, { reduced: 0, flagged: false }],
      returns: [{ value: 40, daysafter: 9 }, { value: 10, daysafter: 1 }, { value: 5, daysafter: 0 }],
    };
    expect(summarise({ bills: 40, sales: 8000.456 }, d)).toEqual({
      bills: 40, sales: 8000.46, discountBills: 2, discountValue: 15, belowList: 1, belowListValue: 7.5, voids: 2, voidValue: 250, edits: 2, editReduced: 30, returns: 3, returnValue: 55,
    });
    expect(marked(d)).toEqual({ bigDiscounts: 1, lateVoids: 1, flaggedEdits: 1, lateReturns: 1 });
  });

  it('reads an edit of a finished bill: a lower total, more discount or removed lines are flagged', () => {
    expect(readEdit({ total: { from: 200, to: 150 } })).toEqual({ reduced: 50, flagged: true });
    expect(readEdit({ total: { from: 100, to: 120 } })).toEqual({ reduced: 0, flagged: false });
    expect(readEdit({ discamount: { from: 0, to: 10 } }).flagged).toBe(true);
    expect(readEdit({ discamount: { from: 10, to: 0 } }).flagged).toBe(false);
    expect(readEdit({ items_removed: 1 }).flagged).toBe(true);
    expect(readEdit({ items_changed: 1, cashamt: { from: 1, to: 2 } }).flagged).toBe(false);
    expect(readEdit(null)).toEqual({ reduced: 0, flagged: false });
  });

  it('groups returns, the most frequent first', () => {
    const rows = [{ r: 'Defective', value: 10 }, { r: 'Prescription Change', value: 5 }, { r: 'Prescription Change', value: 6 }, { r: '', value: 1 }];
    expect(groupReturns(rows, (x) => x.r).map((g) => [g.name, g.count, g.value])).toEqual([['Prescription Change', 2, 11], ['Defective', 1, 10], ['(none)', 1, 1]]);
  });
});
