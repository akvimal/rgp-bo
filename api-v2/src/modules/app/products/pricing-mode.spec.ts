import { boundsOf, checkChange, DEFAULT_SETTINGS, evaluate } from './price-policy';
import { effectivePolicy, effectiveSteps, MODE_DEFAULTS, ModeSettings, previewMode, priceBeforeGst, priceWithGst, readModeSettings, validateModeSettings } from './pricing-mode';

const ms = (o: Partial<ModeSettings> = {}): ModeSettings => ({ ...MODE_DEFAULTS, ...o });
const stored = { floorMarkupPct: 60, maxDiscountPct: 80, usualDiscountPct: 50 };
const row = (k: string, v: any) => ({ setting_key: k, setting_value: v });

describe('how a business prices', () => {
  it('reads the stored settings, and falls back to how the app always worked when none are stored', () => {
    expect(readModeSettings([])).toEqual({ mode: 'SMART', basis: 'excl', discountPct: 10, maxDiscountPct: 15, minMarginPct: 0 });
    expect(readModeSettings([row('pricing_mode', 'mrp'), row('price_basis', 'incl'), row('mode_discount_pct', '12.5')])).toMatchObject({ mode: 'MRP', basis: 'incl', discountPct: 12.5 });
    expect(readModeSettings([row('pricing_mode', 'nonsense')]).mode).toBe('SMART');
  });

  it('gives the class rules different limits for each mode, and keeps the stored ones only for SMART', () => {
    expect(effectivePolicy(ms({ mode: 'MRP' }), stored)).toEqual({ floorMarkupPct: 0, maxDiscountPct: 0, usualDiscountPct: 0 });
    expect(effectivePolicy(ms({ mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 15, minMarginPct: 5 }), stored)).toEqual({ floorMarkupPct: 5, maxDiscountPct: 15, usualDiscountPct: 10 });
    expect(effectivePolicy(ms({ mode: 'SMART' }), stored)).toBe(stored);
  });

  it('does not step a raise under MRP: the price is raised to the MRP at once', () => {
    expect(effectiveSteps(ms({ mode: 'MRP' }), DEFAULT_SETTINGS).stepDays).toBe(0);
    expect(effectiveSteps(ms({ mode: 'DISCOUNT' }), DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS);
    const subject = { price: 80, cost: 60, mrp: 105, tax: 5, abc: 'C' as const, lastChange: '2026-10-29', today: '2026-10-30' };
    const mrp = evaluate(subject, effectivePolicy(ms({ mode: 'MRP' }), stored), effectiveSteps(ms({ mode: 'MRP' }), DEFAULT_SETTINGS));
    expect(mrp.action).toBe('RAISE');
    expect(mrp.next).toBe(100);                  // straight to the ceiling, a day after the last change
    expect(mrp.waitUntil).toBeNull();
  });

  it('under MRP the lowest price is the MRP: a price at the MRP is fine, a lower one is out of policy, even by a paisa', () => {
    const p = effectivePolicy(ms({ mode: 'MRP' }), stored);
    const s = { price: 95.23, cost: 60, mrp: 100, tax: 5, abc: 'C' as const, lastChange: null, today: '2026-10-30' };
    expect(boundsOf(s, p).conflict).toBe(false);
    expect(evaluate(s, p, DEFAULT_SETTINGS).action).toBe('OK');
    expect(evaluate({ ...s, price: 90 }, p, DEFAULT_SETTINGS).action).toBe('RAISE');
    expect(checkChange(s, p, DEFAULT_SETTINGS, 90).violations).toContain('OVER_CAP');
  });

  it('checks the settings a screen sends and leaves the rest as stored', () => {
    expect(validateModeSettings({ mode: 'discount', discountPct: 10, maxDiscountPct: 20 }, ms())).toMatchObject({ value: { mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 20 } });
    expect(validateModeSettings({ mode: 'sometimes' }, ms()).error).toContain('how you price');
    expect(validateModeSettings({ basis: 'maybe' }, ms()).error).toContain('GST');
    expect(validateModeSettings({ discountPct: 30, maxDiscountPct: 20 }, ms()).error).toContain('deeper');
    expect(validateModeSettings({ discountPct: -1 }, ms()).error).toContain('0 to 90');
    expect(validateModeSettings({ minMarginPct: 'x' }, ms()).error).toContain('minimum margin');
    expect(validateModeSettings({ basis: 'incl' }, ms({ mode: 'MRP' })).value).toMatchObject({ mode: 'MRP', basis: 'incl' });
  });

  it('shows what a setting does to a real product', () => {
    const mrp = previewMode(ms({ mode: 'MRP' }), { mrp: 100, cost: 70, tax: 5 })!;
    expect(mrp.priceIncl).toBe(100);
    expect(mrp.price).toBe(95.23);
    expect(mrp.summary).toContain('Sells at the MRP: 100.00 with GST');
    const d = previewMode(ms({ mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 15 }), { mrp: 100, cost: 70, tax: 5 })!;
    expect(d.priceIncl).toBeCloseTo(90, 1);
    expect(d.discountPct).toBeCloseTo(10, 0);
    expect(d.lowestIncl).toBeCloseTo(85, 1);
    expect(d.summary).toContain('10.00% off the MRP');
    const loss = previewMode(ms({ mode: 'MRP' }), { mrp: 100, cost: 99, tax: 5 })!;
    expect(loss.belowCost).toBe(true);
    expect(previewMode(ms({ mode: 'SMART' }), { mrp: 100, cost: 70, tax: 5 })).toBeNull();
  });

  it('turns a price before GST into what the customer pays and back, and never past the MRP', () => {
    expect(priceWithGst(95.23, 5, 100)).toBe(100);                // the ceiling is shown as the MRP itself
    expect(priceWithGst(90, 5, 100)).toBe(94.5);
    expect(priceWithGst(90, 5)).toBe(94.5);
    expect(priceBeforeGst(100, 5, 100)).toBe(95.23);
    expect(priceBeforeGst(94.5, 5, 100)).toBe(90);
    expect(priceBeforeGst(120, 5, 100)).toBe(95.23);              // never above the ceiling
    expect(priceBeforeGst(105, 5)).toBe(100);
  });
});
