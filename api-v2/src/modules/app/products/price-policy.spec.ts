import { addDays, boundsOf, checkChange, classKey, DEFAULT_SETTINGS as ST, evaluate, lineImpact, stepLimit, Subject, suggestPrice, tradeBand } from './price-policy';

// MRP 200 with 12% GST: legal ceiling 178.57. Cost 40 per pack.
const base: Subject = { price: 100, cost: 40, mrp: 200, tax: 12, abc: 'B', lastChange: '2026-09-01', today: '2026-10-24' };
const policy = { floorMarkupPct: 60, maxDiscountPct: 70 };   // floor price 64.00; cap price 200 x 0.3 / 1.12 = 53.58 -> lower bound 64.00

describe('price policy', () => {
  it('classes from trade margin and profit rank', () => {
    expect(tradeBand(0.1)).toBe('LOW');
    expect(tradeBand(0.3)).toBe('MID');
    expect(tradeBand(0.7)).toBe('HIGH');
    expect(tradeBand(null)).toBe('LOW');
    expect(classKey('HIGH', 'A')).toBe('HIGH_A');
  });

  it('bounds: ceiling is MRP less GST, lower is the higher of floor and cap prices', () => {
    const b = boundsOf(base, policy);
    expect(b.ceiling).toBe(178.57);
    expect(b.floorP).toBe(64);
    expect(b.capP).toBe(53.58);
    expect(b.lower).toBe(64);
    expect(b.conflict).toBe(false);
  });

  it('a price inside the bounds is fine', () => {
    expect(evaluate(base, policy, ST).action).toBe('OK');
  });

  it('a price above the legal ceiling is cut straight to it', () => {
    const e = evaluate({ ...base, price: 200 }, policy, ST);
    expect(e.action).toBe('CUT');
    expect(e.violations).toEqual(['OVER_MRP']);
    expect(e.next).toBe(178.57);
  });

  it('a cost rise puts the price below the floor and the fix is a step, not a jump', () => {
    // cost 70 -> floor price 112; price 100 is below it. Step = min(10% of 100, 5% of 178.57) = 8.93
    const e = evaluate({ ...base, cost: 70 }, policy, ST);
    expect(e.action).toBe('RAISE');
    expect(e.violations).toContain('BELOW_FLOOR');
    expect(e.target).toBe(112);
    expect(e.next).toBe(108.93);
    expect(e.waitUntil).toBeNull();
    expect(e.level).toBe('STORE');
  });

  it('class A raises need the Business Head', () => {
    expect(evaluate({ ...base, cost: 70, abc: 'A' }, policy, ST).level).toBe('BUSINESS');
  });

  it('a raise is held for 14 days after the last change', () => {
    const e = evaluate({ ...base, cost: 70, lastChange: '2026-10-20' }, policy, ST);
    expect(e.waitUntil).toBe('2026-11-03');
  });

  it('a discount deeper than the cap is a violation too', () => {
    // MRP 200, 12% GST, cap 50%: cap price 89.29; price 80 is over the cap
    const e = evaluate({ ...base, price: 80 }, { floorMarkupPct: 10, maxDiscountPct: 50 }, ST);
    expect(e.violations).toEqual(['OVER_CAP']);
    expect(e.target).toBe(89.29);
  });

  it('cost above the achievable ceiling is flagged, not repriced', () => {
    expect(evaluate({ ...base, cost: 170 }, policy, ST).action).toBe('CHECK_COST');
  });

  it('a product with no price has nothing to evaluate', () => {
    expect(evaluate({ ...base, price: null }, policy, ST).action).toBe('NO_PRICE');
  });

  it('step limit is the smaller of 10% of price and 5% of the MRP', () => {
    expect(stepLimit(100, 178.57, ST)).toBe(8.93);
    expect(stepLimit(20, 178.57, ST)).toBe(2);
  });

  describe('a proposed change', () => {
    it('a small raise inside bounds is free', () => {
      expect(checkChange({ ...base, lastChange: '2026-09-01' }, policy, ST, 105).violations).toEqual([]);
    });
    it('a raise bigger than a step needs an approver (Store Head for B, within 15%)', () => {
      const r = checkChange(base, policy, ST, 112);   // +12%
      expect(r.violations).toEqual(['RAISE_TOO_BIG']);
      expect(r.level).toBe('STORE');
    });
    it('a raise over the Store Head limit needs the Business Head', () => {
      expect(checkChange(base, policy, ST, 120).level).toBe('BUSINESS');   // +20%
    });
    it('a class A raise beyond a step needs the Business Head', () => {
      expect(checkChange({ ...base, abc: 'A' }, policy, ST, 112).level).toBe('BUSINESS');
    });
    it('a raise soon after the last change is held', () => {
      const r = checkChange({ ...base, lastChange: '2026-10-20' }, policy, ST, 105);
      expect(r.violations).toEqual(['RAISE_TOO_SOON']);
    });
    it('a cut below the floor needs the Business Head', () => {
      const r = checkChange(base, policy, ST, 60);
      expect(r.violations).toEqual(['BELOW_FLOOR']);
      expect(r.level).toBe('BUSINESS');
    });
    it('a cut that stays above the lower bound is free', () => {
      expect(checkChange(base, policy, ST, 70).violations).toEqual([]);
    });
    it('a raise towards the bound from below it is held only to the step rule', () => {
      const r = checkChange({ ...base, price: 50 }, policy, ST, 54);   // still below the 64 floor, but a small raise
      expect(r.violations).toEqual([]);
    });
    it('the first price of a product is checked against the bounds only', () => {
      expect(checkChange({ ...base, price: null, lastChange: null }, policy, ST, 60).violations).toEqual(['BELOW_FLOOR']);
      expect(checkChange({ ...base, price: null, lastChange: null }, policy, ST, 90).violations).toEqual([]);
    });
  });

  it('addDays crosses month ends', () => {
    expect(addDays('2026-10-25', 14)).toBe('2026-11-08');
  });

  describe('a first price and what a purchase line means for the price', () => {
    // MRP 200, GST billed 5%: ceiling 190.47. Cost 100 with floor 25%: lowest price 125.00.
    const none: Subject = { ...base, price: null, cost: 100, tax: 5, lastChange: null };
    const usual = { floorMarkupPct: 25, maxDiscountPct: 60, usualDiscountPct: 20 };

    it('suggests the usual discount off the MRP, before GST', () => {
      const r = suggestPrice(none, usual)!;
      expect(r.price).toBe(152.38);                 // 200 x 0.8 / 1.05
      expect(r.discountPct).toBe(20);
      expect(r.markupPct).toBe(52.38);
    });

    it('never goes below the class lowest price', () => {
      expect(suggestPrice(none, { ...usual, usualDiscountPct: 50 })!.price).toBe(125);   // 50% off would be 95.24, but the floor is 125
    });

    it('never goes above the legal ceiling', () => {
      expect(suggestPrice(none, { ...usual, usualDiscountPct: 0 })!.price).toBe(190.47);
    });

    it('no suggestion when the cost is above what the MRP allows', () => {
      expect(suggestPrice({ ...none, cost: 195 }, usual)).toBeNull();
    });

    it('a line for a product with no price says so, and suggests one', () => {
      const r = lineImpact(none, usual, ST);
      expect(r.status).toBe('NO_PRICE');
      expect(r.suggestion!.price).toBe(152.38);
    });

    it('a current price above this batch MRP ceiling is flagged', () => {
      expect(lineImpact({ ...none, price: 195 }, usual, ST).status).toBe('ABOVE_CEILING');
    });

    it('a current price below the floor for this cost is flagged, with the markup it now gives', () => {
      const r = lineImpact({ ...none, price: 110 }, usual, ST);
      expect(r.status).toBe('BELOW_FLOOR');
      expect(r.markupPct).toBe(10);
    });

    it('a price inside the limits is fine', () => {
      expect(lineImpact({ ...none, price: 150 }, usual, ST).status).toBe('OK');
    });
  });
});
