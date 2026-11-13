import { glanceOf } from './review-glance';

const base = () => ({
  summary: { bills: 200, sales: 123456, discountBills: 0, discountValue: 0, belowList: 0, belowListValue: 0, voids: 0, voidValue: 0, edits: 0, editReduced: 0, returns: 0, returnValue: 0 },
  marked: { bigDiscounts: 0, lateVoids: 0, flaggedEdits: 0, lateReturns: 0 },
  verdicts: { bills: 'usual', sales: 'usual', discount: 'usual', below: 'usual', voids: 'usual', edits: 'usual', returns: 'usual', margin: 'usual', generic: 'usual', unmet: 'usual', lookups: 'usual' } as Record<string, string>,
  cash: { closed: 6, off: 0, short: 0, over: 0, shortTotal: 0, overTotal: 0, unclosed: 0 },
});

describe('glanceOf', () => {
  it('a quiet week has no flags and says so', () => {
    const g = glanceOf(base());
    expect(g.quiet).toBe(true);
    expect(g.flags).toEqual([]);
    expect(g.tiles.find((t) => t.key === 'cash')!.main).toBe('All tally');
    expect(g.tiles.find((t) => t.key === 'sales')!.main).toBe('₹1,23,456');
    expect(g.tiles.every((t) => t.state !== 'look')).toBe(true);
  });

  it('an exception above usual is a flag, with the amount in words', () => {
    const b = base();
    b.summary.discountBills = 12; b.summary.discountValue = 3400; b.verdicts.discount = 'above';
    const g = glanceOf(b);
    expect(g.quiet).toBe(false);
    expect(g.flags.map((f) => f.key)).toEqual(['discounts']);
    expect(g.flags[0].text).toBe('12 bills with a discount (₹3,400), more than normal.');
    expect(g.tiles.find((t) => t.key === 'discounts')!.state).toBe('look');
  });

  it('a marked item is a flag even when the count is as usual', () => {
    const b = base();
    b.summary.returns = 3; b.summary.returnValue = 900; b.marked.lateReturns = 1;
    const g = glanceOf(b);
    expect(g.flags[0].text).toBe('3 returns (₹900) (1 came 7 or more days after the bill).');
  });

  it('a count that is as usual and not marked is not a flag', () => {
    const b = base();
    b.summary.edits = 4; b.summary.editReduced = 200;
    const g = glanceOf(b);
    expect(g.flags).toEqual([]);
    expect(g.tiles.find((t) => t.key === 'edits')!.note).toBe('as normal');
  });

  it('cash drawers out and shifts never closed are separate flags', () => {
    const b = base();
    b.cash = { closed: 5, off: 2, short: 2, over: 0, shortTotal: 540, overTotal: 0, unclosed: 1 };
    const g = glanceOf(b);
    expect(g.flags.map((f) => f.key)).toEqual(['cash-off', 'cash-unclosed']);
    expect(g.flags[0].text).toBe('2 cash drawers out by more than ₹1 (₹540 short).');
    expect(g.flags[1].text).toBe('1 shift was opened and never closed.');
    expect(g.tiles.find((t) => t.key === 'cash')!.state).toBe('look');
  });

  it('without anything to compare, a volume has no verdict and an exception is only noted', () => {
    const b = base();
    Object.keys(b.verdicts).forEach((k) => (b.verdicts[k] = 'unknown'));
    b.summary.voids = 2; b.summary.voidValue = 500;
    const g = glanceOf(b);
    expect(g.hasUsual).toBe(false);
    expect(g.flags).toEqual([]);
    expect(g.tiles.find((t) => t.key === 'sales')!.state).toBe('none');
    expect(g.tiles.find((t) => t.key === 'voids')!.note).toBe('nothing to compare with yet');
  });

  it('only the wrong way of the business measures is a flag', () => {
    const b = base();
    b.verdicts.margin = 'below'; b.verdicts.unmet = 'above';
    expect(glanceOf(b).flags.map((f) => f.key)).toEqual(['margin', 'unmet']);
    const c = base();
    c.verdicts.margin = 'above'; c.verdicts.unmet = 'below'; c.verdicts.sales = 'above';
    expect(glanceOf(c).flags).toEqual([]);
  });

  it('no cash information gives a neutral tile', () => {
    const b = base();
    const g = glanceOf({ ...b, cash: null });
    expect(g.tiles.find((t) => t.key === 'cash')!.state).toBe('none');
  });
});
