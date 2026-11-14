import { buildMatrix, changePct, compareRange, financialYear, monthsBetween } from './money-matrix';

const M = ['2026-04', '2026-05'];
const rows = [
  { month: '2026-04', cls: 'INCOME', grp: 'Sales', category: 'Tablets', amount: 1000 },
  { month: '2026-05', cls: 'INCOME', grp: 'Sales', category: 'Tablets', amount: 1500 },
  { month: '2026-05', cls: 'INCOME_REDUCTION', grp: 'Returns', category: 'Tablets', amount: 100 },
  { month: '2026-04', cls: 'COST_OF_GOODS', grp: 'Purchases', category: 'Tablets', amount: 600 },
  { month: '2026-04', cls: 'OPERATING_COST', grp: 'Premises', category: 'Rent', amount: 200 },
  { month: '2026-05', cls: 'PEOPLE', grp: 'People', category: 'Salaries', amount: 300 },
  { month: '2026-05', cls: 'UNCLASSIFIED', grp: 'Unclassified', category: 'Gift', amount: 50, unclassified: true },
  { month: '2026-05', cls: 'CAPITAL_OWNER', grp: 'Owner', category: 'Drawings', amount: 5000 },
  { month: '2026-01', cls: 'INCOME', grp: 'Sales', category: 'Tablets', amount: 9999 },
];

describe('money matrix', () => {
  it('lists the months and the financial year', () => {
    expect(monthsBetween('2026-04', '2027-03')).toHaveLength(12);
    expect(financialYear('2026-02-10')).toMatchObject({ from: '2025-04', to: '2026-03' });
    expect(financialYear('2026-11-15')).toMatchObject({ from: '2026-04', to: '2027-03' });
  });
  it('compares with the months before, or a year earlier', () => {
    expect(compareRange('2026-04', '2026-06', 'prev')).toEqual({ from: '2026-01', to: '2026-03' });
    expect(compareRange('2026-04', '2026-06', 'yoy')).toEqual({ from: '2025-04', to: '2025-06' });
    expect(compareRange('2026-04', '2026-06', 'none')).toBeNull();
  });
  it('sums sales net of returns; profit leaves out capital and unclassified money', () => {
    const m = buildMatrix(rows, M);
    expect(m.summary.sales.total).toBe(2400);
    expect(m.summary.runningCost.total).toBe(500);
    expect(m.summary.profit!.total).toBe(1300);
    expect(m.summary.profit!.cells).toEqual([200, 1100]);
    expect(m.sections.find((s) => s.cls === 'CAPITAL_OWNER')!.total).toBe(5000);
    expect(m.sections.find((s) => s.cls === 'UNCLASSIFIED')!.rows[0].unclassified).toBe(true);
  });
  it('ignores months outside the range', () => {
    expect(buildMatrix(rows, M).sections.find((s) => s.cls === 'INCOME')!.total).toBe(2500);
  });
  it('gives a manager no purchases, margin or profit', () => {
    const m = buildMatrix(rows, M, { hideCost: true });
    expect(m.summary.profit).toBeNull();
    expect(m.summary.margin).toBeNull();
    expect(m.summary.purchases).toBeNull();
    expect(m.sections.some((s) => s.cls === 'COST_OF_GOODS')).toBe(false);
    expect(m.summary.sales.total).toBe(2400);
  });
  it('shows the change against the compare period and the share of sales', () => {
    const m = buildMatrix(rows, M, { compareRows: [{ month: '2026-02', cls: 'INCOME', grp: 'Sales', category: 'Tablets', amount: 1000 }], compareMonths: ['2026-02', '2026-03'] });
    const row = m.sections.find((s) => s.cls === 'INCOME')!.rows[0];
    expect(row.prev).toBe(1000);
    expect(row.change).toBe(150);
    expect(m.sections.find((s) => s.cls === 'OPERATING_COST')!.rows[0].pct).toBeCloseTo(8.33, 1);
    expect(changePct(5, 0)).toBeNull();
  });
  it('reports how much has no category', () => {
    const m = buildMatrix(rows, M);
    expect(m.confidence.unclassifiedCount).toBe(1);
    expect(m.confidence.unclassifiedShare).toBeGreaterThan(0);
  });
});
