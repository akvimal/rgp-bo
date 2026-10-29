import { asValues, checkScope, checkValue, CONFIG_DEFS, defOf, resolveConfig } from './config-schema';

const base = { today: '2026-10-25', businessType: 'pharmacy', packs: ['pharmacy'] };
const row = (key: string, value: any, from = '2026-10-01', scope = 'compliance') => ({ scope, key, value, effective_from: from });
const get = (items: any[], key: string) => items.find((x) => x.key === key);

describe('resolveConfig', () => {
  it('gives the default when the business has chosen nothing', () => {
    const r = resolveConfig({ ...base, rows: [] });
    expect(get(r, 'stock_count_late_days')).toMatchObject({ value: 3, source: 'default', since: null });
  });

  it('uses the business choice once it has begun, not before', () => {
    expect(get(resolveConfig({ ...base, rows: [row('stock_count_late_days', 5, '2026-10-26')] }), 'stock_count_late_days').value).toBe(3);
    expect(get(resolveConfig({ ...base, rows: [row('stock_count_late_days', 5, '2026-10-25')] }), 'stock_count_late_days')).toMatchObject({ value: 5, source: 'business' });
  });

  it('takes the latest choice that has begun', () => {
    const r = resolveConfig({ ...base, rows: [row('stock_count_late_days', 5, '2026-09-01'), row('stock_count_late_days', 2, '2026-10-10'), row('stock_count_late_days', 6, '2026-11-01')] });
    expect(get(r, 'stock_count_late_days').value).toBe(2);
  });

  it('uses the default of the business type', () => {
    expect(get(resolveConfig({ ...base, businessType: 'general', packs: [], rows: [] }), 'product_term').value).toBe('Item');
    expect(get(resolveConfig({ ...base, rows: [] }), 'product_term').value).toBe('Medicine');
  });

  it('hides pack keys from a business without the pack', () => {
    const r = resolveConfig({ ...base, businessType: 'general', packs: [], rows: [] });
    expect(get(r, 'drug_register')).toBeUndefined();
    expect(get(r, 'refill_on')).toBeUndefined();
    expect(get(resolveConfig({ ...base, rows: [] }), 'drug_register')).toMatchObject({ locked: true, value: 'block' });
  });

  it('ignores a stored value that fails its floor, and never moves a locked key', () => {
    const r = resolveConfig({ ...base, rows: [row('stock_count_late_days', 99), row('drug_register', 'off'), row('capture_pct', 10, '2026-10-01', 'recognition')] });
    expect(get(r, 'stock_count_late_days').value).toBe(3);
    expect(get(r, 'drug_register').value).toBe('block');
    expect(get(r, 'capture_pct').value).toBe(95);
  });

  it('marks keys the plan does not let the business change', () => {
    const r = resolveConfig({ ...base, rows: [], planLocked: ['recognition', 'compliance.waiver_max_days'] });
    expect(get(r, 'till_streak').planLocked).toBe(true);
    expect(get(r, 'waiver_max_days').planLocked).toBe(true);
    expect(get(r, 'escalate_days').planLocked).toBe(false);
  });

  it('can be limited to one scope', () => {
    expect(resolveConfig({ ...base, scope: 'health', rows: [] }).every((x) => x.scope === 'health')).toBe(true);
  });
});

describe('checkValue', () => {
  const d = (k: string) => defOf(CONFIG_DEFS.find((x) => x.key === k)!.scope, k)!;
  it('keeps numbers inside the floor', () => {
    expect(checkValue(d('capture_pct'), 80)).toBeNull();
    expect(checkValue(d('capture_pct'), 60)).toMatch(/below 70/);
    expect(checkValue(d('capture_pct'), 101)).toMatch(/above 100/);
    expect(checkValue(d('capture_pct'), 80.5)).toMatch(/whole number/);
    expect(checkValue(d('w_sales'), 22)).toMatch(/steps of 5/);
  });
  it('checks choices and switches', () => {
    expect(checkValue(d('amounts'), 'without GST')).toBeNull();
    expect(checkValue(d('amounts'), 'net')).toMatch(/one of/);
    expect(checkValue(d('till_on'), 'yes')).toMatch(/on or off/);
  });
  it('refuses to change a locked key', () => {
    expect(checkValue(d('drug_register'), 'block')).toMatch(/required/);
  });
});

describe('checkScope', () => {
  it('needs the health weights to add up to 100', () => {
    const ok = asValues(resolveConfig({ ...base, scope: 'health', rows: [] }));
    expect(checkScope('health', ok)).toBeNull();
    expect(checkScope('health', { ...ok, w_sales: 30 })).toMatch(/add up to 105/);
  });
  it('keeps the Watch safeguard below the Healthy score', () => {
    const ok = asValues(resolveConfig({ ...base, scope: 'health', rows: [] }));
    expect(checkScope('health', { ...ok, hold_below: 80, healthy_min: 70 })).toMatch(/safeguard/);
  });
});

describe('pending changes', () => {
  it('shows the next change that has not begun yet, and nothing when there is none', () => {
    const r = resolveConfig({ ...base, rows: [row('stock_count_late_days', 5, '2026-10-26'), row('stock_count_late_days', 6, '2026-11-01')] });
    expect(get(r, 'stock_count_late_days')).toMatchObject({ value: 3, source: 'default', pending: { value: 5, from: '2026-10-26' } });
    expect(get(resolveConfig({ ...base, rows: [] }), 'stock_count_late_days').pending).toBeNull();
    expect(get(resolveConfig({ ...base, rows: [row('stock_count_late_days', 5, '2026-10-25')] }), 'stock_count_late_days').pending).toBeNull();
  });
});
