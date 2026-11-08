import { kpiNotes, paceStatus } from './hr-kpi-pace';

const sales = { rule: { kind: 'linear', target: 300000, floor: 100000 }, direction: 'higher' as const };
describe('pace of a higher-is-better measure', () => {
  it('is on course when the share reached keeps up with the days gone', () => {
    // 15 of 30 days gone, half way from floor to target
    expect(paceStatus({ ...sales, raw: 200000 }, 15, 30, 70).behind).toBe(false);
  });
  it('is behind when it lags well behind the days gone', () => {
    const s = paceStatus({ ...sales, raw: 120000 }, 15, 30, 70);   // 10% of the way at half the month
    expect(s.behind).toBe(true);
    expect(s.progress).toBe(20);
  });
  it('allows some slack: 70 per cent of the pace is still fine', () => {
    expect(paceStatus({ ...sales, raw: 170000 }, 15, 30, 70).behind).toBe(false);   // 35% of the way, needs 35
    expect(paceStatus({ ...sales, raw: 169000 }, 15, 30, 70).behind).toBe(true);
  });
  it('says nothing without a figure or a usable rule', () => {
    expect(paceStatus({ ...sales, raw: null }, 15, 30, 70).behind).toBe(false);
    expect(paceStatus({ rule: { kind: 'steps', steps: [] }, direction: 'higher', raw: 3 }, 15, 30, 70).behind).toBe(false);
  });
});

describe('pace of a lower-is-better measure', () => {
  const cash = { rule: { kind: 'linear', target: 0, floor: 500 }, direction: 'lower' as const };
  it('is behind once half the points are gone', () => {
    expect(paceStatus({ ...cash, raw: 100 }, 10, 30, 70).behind).toBe(false);
    expect(paceStatus({ ...cash, raw: 300 }, 10, 30, 70).behind).toBe(true);
  });
});

describe('the reminder text', () => {
  it('lists each measure with what earns full marks', () => {
    const t = kpiNotes([
      { name: 'Sales value', source: 'SYSTEM', direction: 'higher', unit: 'Rs', rule: { kind: 'linear', target: 300000, floor: 100000 } },
      { name: 'Cash short or excess', source: 'SYSTEM', direction: 'lower', unit: 'Rs', rule: { kind: 'linear', target: 0, floor: 500 } },
      { name: 'Courtesy', source: 'MANUAL', direction: null, unit: null, rule: null }]);
    expect(t).toContain('Sales value: full marks at Rs 3,00,000');
    expect(t).toContain('Cash short or excess: full marks at Rs 0 or less');
    expect(t).toContain('Courtesy: rated by your manager');
  });
});
