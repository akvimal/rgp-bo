import { checkCeiling, cleanBands, cleanKpis, cleanRole, simulateBands, summarise, toHundred } from './hr-ai-draft';

describe('a drafted role', () => {
  it('keeps clear responsibilities once each, with a known measure or manual', () => {
    const r = cleanRole({ purpose: '  Serve   customers ', responsibilities: [
      { text: 'Bill sales accurately', measure: 'DISCARDED_BILLS' }, { text: 'bill sales accurately', measure: 'SALES_VALUE' },
      { text: 'Keep the counter tidy', measure: 'NOT_A_MEASURE' }, { text: 'ok', measure: 'MANUAL' }, 'Greet each customer warmly'] });
    expect(r.purpose).toBe('Serve customers');
    expect(r.responsibilities.map((x) => x.text)).toEqual(['Bill sales accurately', 'Keep the counter tidy', 'Greet each customer warmly']);
    expect(r.responsibilities.map((x) => x.measure)).toEqual(['DISCARDED_BILLS', 'MANUAL', 'MANUAL']);
  });
  it('is empty for nonsense', () => { expect(cleanRole(null).responsibilities).toEqual([]); });
});

describe('spread of figures', () => {
  it('is anonymous: nothing is given for fewer than 3 figures', () => {
    expect(summarise([5, 9])).toBeNull();
    expect(summarise([1, 2, 3, 4, 100])).toEqual({ n: 5, min: 1, p25: 2, median: 3, p75: 4, max: 100 });
  });
});

describe('weights', () => {
  it('add up to 100 keeping proportions', () => {
    expect(toHundred([1, 1, 1])).toEqual([34, 33, 33]);
    expect(toHundred([50, 30, 20])).toEqual([50, 30, 20]);
    expect(toHundred([3, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(toHundred([0, 0])).toEqual([100, 0]);
  });
});

describe('drafted KPIs', () => {
  const sales = { name: 'Sales', source: 'SYSTEM', system_key: 'SALES_VALUE', rule: { kind: 'linear', target: 300000, floor: 100000 }, weight: 40 };
  it('keeps a measure the engine can measure, with a valid rule', () => {
    const { kpis, dropped } = cleanKpis({ kpis: [sales, { name: 'Courtesy', source: 'MANUAL', description: 'Rate how politely they treat customers', weight: 60 }] });
    expect(dropped).toEqual([]);
    expect(kpis.map((k) => [k.source, k.max_points])).toEqual([['SYSTEM', 40], ['MANUAL', 60]]);
  });
  it('turns a measure the engine cannot do, or a bad rule, into a manager-rated one with a guide', () => {
    const { kpis, dropped } = cleanKpis({ kpis: [
      { name: 'Footfall', source: 'SYSTEM', system_key: 'FOOTFALL', rule: { kind: 'linear', target: 5, floor: 1 }, description: 'Rate how well they draw customers in', weight: 50 },
      { name: 'Short cash', source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: { kind: 'linear', target: 0, floor: 500 }, weight: 50, description: 'Rate cash care by the cash book' }] });
    expect(kpis[0].source).toBe('MANUAL');
    expect(kpis[1].source).toBe('SYSTEM');
    expect(dropped).toHaveLength(1);
  });
  it('uses a system measure once per role, and counts ones the role already has', () => {
    const { kpis } = cleanKpis({ kpis: [sales, { ...sales, name: 'Sales again', description: 'Rate their selling effort overall', weight: 10 }] }, []);
    expect(kpis.filter((k) => k.system_key === 'SALES_VALUE')).toHaveLength(1);
    expect(cleanKpis({ kpis: [sales] }, ['SALES_VALUE']).kpis[0]?.source ?? 'none').toBe('none');
  });
  it('leaves out a manager-rated measure with no rating guide', () => {
    expect(cleanKpis({ kpis: [{ name: 'Attitude', source: 'MANUAL', weight: 10 }] }).kpis).toEqual([]);
  });
});

describe('drafted bands', () => {
  it('are ordered, labelled and never pay less for a higher score', () => {
    const b = cleanBands({ bands: [
      { min_percent: 90, label: 'Excellent', incentive_amount: 2000 }, { min_percent: 0, label: 'Below', incentive_amount: 0 },
      { min_percent: 70, label: 'Good', incentive_amount: 2500 }, { min_percent: 70, label: 'Dup', incentive_amount: 1 }, { min_percent: 50, label: '', incentive_amount: 100 }] });
    expect(b.map((x) => x.min_percent)).toEqual([0, 70, 90]);
    expect(b.map((x) => x.incentive_amount)).toEqual([0, 2500, 2500]);
  });
});

describe('replaying bands over past scores', () => {
  const bands = [{ min_percent: 0, incentive_amount: 0 }, { min_percent: 60, incentive_amount: 500 }, { min_percent: 85, incentive_amount: 1500 }];
  it('pays the highest band reached', () => {
    const s = simulateBands([40, 60, 84.9, 85, 100, 90], bands, 3);
    expect(s.total_paid).toBe(0 + 500 + 500 + 1500 + 1500 + 1500);
    expect(s.monthly_cost).toBeCloseTo(5500 / 3, 1);
    expect(s.by_band.map((x) => x.count)).toEqual([1, 2, 3]);
    expect(s.top_amount).toBe(1500);
  });
  it('handles no history', () => { expect(simulateBands([], bands, 3).total_paid).toBe(0); });
});

describe('ceiling', () => {
  it('compares the worst month with a share of the role payroll', () => {
    expect(checkCeiling(4, 1500, 100000, 5)).toEqual({ worst_case: 6000, ceiling: 5000, over: true });
    expect(checkCeiling(3, 1500, 100000, 5).over).toBe(false);
  });
  it('has no ceiling when none is set or there is no payroll to compare', () => {
    expect(checkCeiling(4, 1500, 100000, null).over).toBe(false);
    expect(checkCeiling(4, 1500, 0, 5).ceiling).toBeNull();
  });
});
