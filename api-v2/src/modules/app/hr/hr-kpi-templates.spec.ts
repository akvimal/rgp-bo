import { SYSTEM_MEASURES, checkRule, gatePassed, pctFor } from './hr-kpi-engine.service';
import { KPI_TEMPLATES, templateTotals } from './hr-kpi-templates';

describe('KPI starter sets', () => {
  it('has a set for each position, and every set adds up to 100 points', () => {
    expect(KPI_TEMPLATES.map((t) => t.position)).toEqual(['Sales Staff', 'Pharmacist', 'Store Head']);
    for (const t of KPI_TEMPLATES) expect(templateTotals(t).points).toBe(100);
  });
  it('has legal gates in every set and no points on a gate', () => {
    for (const t of KPI_TEMPLATES) {
      expect(templateTotals(t).gates).toBeGreaterThanOrEqual(2);
      for (const m of t.metrics.filter((x) => x.gate)) expect(m.max).toBe(0);
    }
  });
  it('names each measure once within a set', () => {
    for (const t of KPI_TEMPLATES) {
      const names = t.metrics.map((m) => m.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
  it('uses only measures the system has, with rules that pass the same checks as the setup screen', () => {
    const keys = SYSTEM_MEASURES.map((m) => m.key);
    for (const t of KPI_TEMPLATES) {
      for (const m of t.metrics) {
        if (m.source === 'SYSTEM') {
          expect(keys).toContain(m.system_key);
          expect(() => checkRule(m.system_key!, m.rule)).not.toThrow();
        } else {
          expect(m.rating_scale).toBeGreaterThanOrEqual(2);
          if (m.gate) expect(m.rating_scale).toBe(2);
        }
      }
    }
  });
  it('is mostly measured by the system for the people at the counter', () => {
    const sales = KPI_TEMPLATES.find((t) => t.position === 'Sales Staff')!;
    expect(templateTotals(sales).system).toBeGreaterThanOrEqual(60);
  });
  it('scores prescription details on scheduled-drug sales instead of making them a gate', () => {
    // a regular customer may not bring the latest prescription, and some will not bring one: one such sale must not zero the month's incentive
    for (const t of KPI_TEMPLATES) expect(t.metrics.filter((m) => m.gate && /scheduled drugs sold with prescription/i.test(m.name))).toHaveLength(0);
    const sales = KPI_TEMPLATES.find((t) => t.position === 'Sales Staff')!;
    const rx = sales.metrics.find((m) => m.name === 'Prescription details on scheduled-drug sales')!;
    expect(rx.gate).toBeFalsy();
    expect(rx.max).toBeGreaterThan(0);
  });
  it('leaves absent days out of the weekend pharmacist set', () => {
    const p = KPI_TEMPLATES.find((t) => t.position === 'Pharmacist')!;
    expect(p.metrics.some((m) => m.system_key === 'ABSENT_DAYS')).toBe(false);
    expect(p.metrics.filter((m) => m.system_key === 'CUSTOMER_CAPTURE')[0].min_activity).toBeLessThan(30);
  });
});

describe('KPI gates and the customer-capture measure', () => {
  it('is met when a low-is-better figure stays within the limit, and a high-is-better figure reaches it', () => {
    expect(gatePassed('lower', 1000, 800)).toBe(true);
    expect(gatePassed('lower', 1000, 1000)).toBe(true);
    expect(gatePassed('lower', 1000, 1001)).toBe(false);
    expect(gatePassed('higher', 80, 80)).toBe(true);
    expect(gatePassed('higher', 80, 79.9)).toBe(false);
  });
  it('accepts a gate rule with a limit and refuses a bad one', () => {
    expect(checkRule('CASH_VARIANCE', { kind: 'gate', limit: 1000 })).toEqual({ kind: 'gate', limit: 1000 });
    expect(() => checkRule('CASH_VARIANCE', { kind: 'gate', limit: -1 })).toThrow();
    expect(() => checkRule('CASH_VARIANCE', { kind: 'gate' })).toThrow();
  });
  it('has the capture measure, higher is better, in per cent', () => {
    const m = SYSTEM_MEASURES.find((x) => x.key === 'CUSTOMER_CAPTURE')!;
    expect(m).toMatchObject({ unit: '%', direction: 'higher' });
    expect(checkRule('CUSTOMER_CAPTURE', { kind: 'linear', target: 90, floor: 60 })).toEqual({ kind: 'linear', target: 90, floor: 60 });
    expect(() => checkRule('CUSTOMER_CAPTURE', { kind: 'steps', steps: [{ upto: 5, pct: 100 }] })).toThrow();
    expect(pctFor({ kind: 'linear', target: 90, floor: 60 }, 75)).toBe(50);
  });
});
