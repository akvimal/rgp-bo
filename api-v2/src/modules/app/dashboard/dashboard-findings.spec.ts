import { HFinding, ageSeverity, areaScore, findingsFromChecks, fixFirst, fromAlert, legalFloor, live, overallScore, penalty, rollup, statusOf, varianceFinding } from './dashboard-findings';

const f = (over: Partial<HFinding> = {}): HFinding => ({
  key: 'k' + Math.random(), code: 'c', area: 'stock', severity: 'minor', storeid: null, title: 't', detail: 'd', link: '/x', owner: 'Store Head', legal: false, ...over,
});

describe('status', () => {
  it('comes from the worst severity, not the average', () => {
    expect(statusOf([])).toBe('healthy');
    expect(statusOf([f({ severity: 'info' })])).toBe('healthy');
    expect(statusOf([f({ severity: 'minor' })])).toBe('notes');
    expect(statusOf([f({ severity: 'minor' }), f({ severity: 'major' })])).toBe('watch');
    expect(statusOf([f({ severity: 'major' }), f({ severity: 'critical' })])).toBe('act');
  });
});

describe('score', () => {
  it('is 100 with nothing wrong', () => expect(overallScore([])).toBe(100));
  it('takes points by severity from an area', () => {
    expect(areaScore([f({ severity: 'major' })])).toBe(85);
    expect(areaScore([f({ severity: 'critical' })])).toBe(60);
  });
  it('counts the second finding of one kind at half, so many minor items do not zero an area', () => {
    const many = Array.from({ length: 20 }, () => f({ code: 'same', severity: 'minor' }));
    expect(penalty(many)).toBeCloseTo(3 + 19 * 1.5);
    expect(areaScore(many)).toBeGreaterThan(0);
  });
  it('never reads better than the status', () => {
    // one Critical in one area of eight would average to 95; the cap holds it below Watch
    expect(overallScore([f({ severity: 'critical' })])).toBeLessThanOrEqual(59);
    expect(overallScore([f({ severity: 'major' })])).toBeLessThanOrEqual(79);
    expect(overallScore([f({ severity: 'minor' })])).toBeGreaterThan(79);
  });
});

describe('ageing and snoozing', () => {
  it('a minor finding open two weeks counts as major; others do not climb', () => {
    expect(ageSeverity('minor', 13)).toEqual({ severity: 'minor', aged: false });
    expect(ageSeverity('minor', 14)).toEqual({ severity: 'major', aged: true });
    expect(ageSeverity('major', 100)).toEqual({ severity: 'major', aged: false });
    expect(ageSeverity('info', 100).severity).toBe('info');
  });
  it('live() drops snoozed findings, applies age, and never snoozes a legal one', () => {
    const today = '2026-11-14';
    const out = live([
      f({ key: 'a', snoozedUntil: '2026-11-20' }),
      f({ key: 'b', snoozedUntil: '2026-11-10' }),
      f({ key: 'c', legal: true, severity: 'critical', snoozedUntil: '2026-12-31' }),
      f({ key: 'd', firstSeen: '2026-10-01' }),
    ], today);
    expect(out.map((x) => x.key)).toEqual(['b', 'c', 'd']);
    expect(out.find((x) => x.key === 'd')!.severity).toBe('major');
    expect(out.find((x) => x.key === 'd')!.aged).toBe(true);
  });
  it('a legal finding is never below Major', () => {
    expect(legalFloor(f({ legal: true, severity: 'minor' })).severity).toBe('major');
    expect(legalFloor(f({ legal: false, severity: 'minor' })).severity).toBe('minor');
  });
});

describe('fix first', () => {
  it('ranks severity, then money, then age, and says how many points fixing each recovers', () => {
    const list = [
      f({ key: 'min', severity: 'minor', code: 'a' }),
      f({ key: 'maj-small', severity: 'major', amount: 100, code: 'b' }),
      f({ key: 'maj-big', severity: 'major', amount: 5000, code: 'c' }),
      f({ key: 'crit', severity: 'critical', code: 'd', area: 'compliance' }),
      f({ key: 'inf', severity: 'info', code: 'e' }),
    ];
    const top = fixFirst(list, 4);
    expect(top.map((x) => x.key)).toEqual(['crit', 'maj-big', 'maj-small', 'min']);
    expect(top.every((x) => x.recovers >= 0)).toBe(true);
    expect(top[0].recovers).toBeGreaterThan(0);
  });
  it('rollup has area rows, counts and the same status', () => {
    const r = rollup([f({ severity: 'critical', area: 'compliance' }), f({ severity: 'minor' })]);
    expect(r.status).toBe('act');
    expect(r.counts).toEqual({ critical: 1, major: 0, minor: 1, info: 0 });
    expect(r.areas.find((a) => a.key === 'compliance')!.worst).toBe('critical');
    expect(r.areas).toHaveLength(8);
  });
});

describe('ratio checks become findings only when they cross a threshold', () => {
  const t = { healthyMin: 80, holdBelow: 60 };
  const checks = [
    { key: 'sales', label: 'Sales', score: 95, on: true },
    { key: 'stock', label: 'Stock', score: 70, on: true, fact: '3 of 10 below minimum' },
    { key: 'cash', label: 'Cash and shifts', score: 50, on: true },
    { key: 'repeat', label: 'Repeat customers', score: null, on: true },
    { key: 'returns', label: 'Returns', score: 10, on: false },
  ];
  it('Minor under healthy, Major under hold-below, nothing for good, empty or switched-off checks', () => {
    const out = findingsFromChecks(checks, t);
    expect(out.map((x) => [x.code, x.severity])).toEqual([['measure_stock', 'minor'], ['measure_cash', 'major']]);
    expect(out[0].detail).toBe('3 of 10 below minimum');
  });
});

describe('alerts become findings', () => {
  it('maps a licence that has ended to a Critical legal finding that cannot be snoozed', () => {
    const x = fromAlert({ key: 'licence:1:DL', code: 'licence_expired', storeid: 1, params: { store: 'Main ', days: 3 }, link: '/secure/settings/store', severity: 'critical' }, { title: 'DL licence ended', body: 'Renew it' })!;
    expect(x.severity).toBe('critical');
    expect(x.legal).toBe(true);
    expect(x.area).toBe('compliance');
    expect(x.store).toBe('Main ');
    expect(x.key).toBe('alert:licence:1:DL');
  });
  it('a shift open a day or more is Critical; fewer hours Major', () => {
    const base = { key: 'shift:1', code: 'shift_open_long', storeid: 1, link: '/x' };
    expect(fromAlert({ ...base, params: { hours: 30 } }, { title: '', body: '' })!.severity).toBe('critical');
    expect(fromAlert({ ...base, params: { hours: 15 } }, { title: '', body: '' })!.severity).toBe('major');
  });
  it('takes a money figure from the alert when it has one and ignores unknown codes', () => {
    const x = fromAlert({ key: 'expired_stock', code: 'expired_stock', storeid: null, params: { batches: 4, value: 2500 }, link: '/x' }, { title: 't', body: 'b' })!;
    expect(x.amount).toBe(2500);
    expect(fromAlert({ key: 'z', code: 'nothing_known', storeid: null, params: {}, link: '' }, { title: '', body: '' })).toBeNull();
  });
});

describe('drawer differences', () => {
  it('is Minor for a few shifts and Major when it keeps happening; says how many had no reason', () => {
    const row = { store_id: 2, location: 'Annex ', shifts: 1, total: 120, unexplained: 1 };
    expect(varianceFinding(row).severity).toBe('minor');
    expect(varianceFinding({ ...row, shifts: 4 }).severity).toBe('major');
    expect(varianceFinding(row).detail).toMatch(/1 with no reason given/);
    expect(varianceFinding(row).store).toBe('Annex');
  });
});

import { snoozeProblem, storeMatrix } from './dashboard-findings';

describe('store matrix', () => {
  it('shows the worst severity per area for each store and leaves business-wide findings out of the rows', () => {
    const rows = storeMatrix([
      f({ storeid: 1, area: 'cash', severity: 'major' }),
      f({ storeid: 1, area: 'cash', severity: 'critical' }),
      f({ storeid: 2, area: 'stock', severity: 'minor' }),
      f({ storeid: null, area: 'compliance', severity: 'critical' }),
    ], [{ id: 1, name: 'Main' }, { id: 2, name: 'Annex' }]);
    expect(rows[0].cells.cash).toBe('critical');
    expect(rows[0].cells.stock).toBeNull();
    expect(rows[1].cells.stock).toBe('minor');
    expect(rows[1].score).toBeGreaterThan(rows[0].score);
    expect(rows[0].cells.compliance).toBeNull();
  });
});

describe('snooze', () => {
  const today = '2026-11-14';
  it('needs a future date within 90 days and a reason', () => {
    expect(snoozeProblem('', 'x', today)).toMatch(/date/);
    expect(snoozeProblem('2026-11-14', 'because', today)).toMatch(/after today/);
    expect(snoozeProblem('2027-06-01', 'because', today)).toMatch(/90 days/);
    expect(snoozeProblem('2026-11-20', ' ', today)).toMatch(/why/);
    expect(snoozeProblem('2026-11-20', 'Waiting for the vendor', today)).toBeNull();
  });
});
