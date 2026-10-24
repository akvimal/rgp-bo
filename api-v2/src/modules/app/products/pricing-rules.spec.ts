import { cleanRuleValue, ruleOf, RULES } from './pricing-rules';

describe('pricing rules', () => {
  it('every rule has a unique key and a default inside its own limits', () => {
    expect(new Set(RULES.map((r) => r.key)).size).toBe(RULES.length);
    for (const r of RULES.filter((x) => x.type === 'number' && x.editable)) {
      const n = Number(r.default);
      expect(n).toBeGreaterThanOrEqual(r.min!);
      expect(n).toBeLessThanOrEqual(r.max!);
    }
  });

  it('accepts a number inside the limits and rounds to two places', () => {
    expect(cleanRuleValue(ruleOf('price_step_pct')!, '12')).toEqual({ value: '12' });
    expect(cleanRuleValue(ruleOf('price_tolerance_pct')!, 0.456)).toEqual({ value: '0.46' });
  });

  it('refuses a number outside the limits, a blank, and text', () => {
    expect(cleanRuleValue(ruleOf('price_step_pct')!, 0).error).toContain('from 1 to 50');
    expect(cleanRuleValue(ruleOf('price_step_pct')!, 80).error).toBeTruthy();
    expect(cleanRuleValue(ruleOf('price_step_days')!, '').error).toBeTruthy();
    expect(cleanRuleValue(ruleOf('price_step_days')!, 'abc').error).toBeTruthy();
  });

  it('a switch is on or off only', () => {
    expect(cleanRuleValue(ruleOf('sale_mrp_guard')!, 'OFF')).toEqual({ value: 'off' });
    expect(cleanRuleValue(ruleOf('sale_mrp_guard')!, 'maybe').error).toBeTruthy();
  });

  it('the GST cap is shown but cannot be changed here', () => {
    expect(cleanRuleValue(ruleOf('sale_gst_cap_pct')!, 12).error).toContain('cannot be changed');
  });
});
