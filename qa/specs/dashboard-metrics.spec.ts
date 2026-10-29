/**
 * Store health, targets and charts - HM-1..6
 * Health is seven weighted checks with a safeguard; the Business Head sets monthly sales targets (audited); the chart data is scoped to the person's stores
 * and is for the people who run the business or a store. A requested store that is not theirs is refused, and nothing here names a customer.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const SALES = 'sales1@local.test';
const month = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);

test.describe('Dashboard metrics @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('HM-1 health gives seven checks, a score and a status, each with the fact behind it @happy', async ({ api }) => {
    const r = await api.request('GET', '/dashboard/health', undefined, MGR);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.checks.map((c: any) => c.key)).toEqual(['sales', 'stock', 'cash', 'purchasing', 'customers', 'compliance', 'service']);
    for (const c of r.body.checks) expect(typeof c.fact).toBe('string');
    expect(['healthy', 'watch', 'act', null]).toContain(r.body.status);
    if (r.body.score !== null) expect(r.body.score).toBeGreaterThanOrEqual(0);
  });

  test('HM-2 only the Business Head sets a target, it is read back, and clearing it removes it @happy', async ({ api }) => {
    const denied = await api.request('PUT', '/dashboard/targets', { month, value: 123456 }, HEAD);
    expect(denied.status).toBe(403);
    const set = await api.request('PUT', '/dashboard/targets', { month, value: 123456 }, MGR);
    expect(set.status, JSON.stringify(set.body)).toBeLessThan(300);
    const read = await api.request('GET', `/dashboard/targets?month=${month}`, undefined, MGR);
    expect(read.body.business).toBe(123456);
    const health = await api.request('GET', '/dashboard/health', undefined, MGR);
    expect(health.body.target).toBe(123456);
    expect(health.body.checks.find((c: any) => c.key === 'sales').score).not.toBeNull();
    const cleared = await api.request('PUT', '/dashboard/targets', { month, value: null }, MGR);
    expect(cleared.status).toBeLessThan(300);
    expect((await api.request('GET', `/dashboard/targets?month=${month}`, undefined, MGR)).body.business).toBeNull();
    // with no target the sales check falls back to the recent months, or has nothing to measure against when there is no history
    const after = (await api.request('GET', '/dashboard/health', undefined, MGR)).body;
    expect(after.target).toBeNull();
    expect([after.salesBasis.used, after.checks.find((c: any) => c.key === 'sales').score === null ? null : 'recent average']).toEqual(after.salesBasis.used ? ['recent average', 'recent average'] : [null, null]);
  });

  test('HM-3 a bad month or value is refused @negative', async ({ api }) => {
    expect((await api.request('PUT', '/dashboard/targets', { month: '2026-13', value: 5 }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/dashboard/targets', { month, value: -5 }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/dashboard/targets', { month, value: 'lots' }, MGR)).status).toBe(400);
  });

  test('HM-4 the charts return their shape: twelve months with two earlier years, categories adding to 100, a week of hours @happy', async ({ api }) => {
    const sales = await api.request('GET', '/dashboard/metrics/sales-by-month', undefined, MGR);
    expect(sales.status, JSON.stringify(sales.body)).toBe(200);
    expect(sales.body.months).toHaveLength(12);
    expect(Object.keys(sales.body.months[0])).toEqual(expect.arrayContaining(['month', 'sales', 'lastYear', 'twoYearsAgo']));
    const cats = await api.request('GET', '/dashboard/metrics/categories', undefined, MGR);
    expect(cats.status).toBe(200);
    if (cats.body.categories.length) {
      const share = cats.body.categories.reduce((a: number, c: any) => a + c.share, 0);
      expect(Math.abs(share - 100)).toBeLessThan(1);
    }
    const cust = await api.request('GET', '/dashboard/metrics/customers', undefined, MGR);
    expect(cust.status).toBe(200);
    expect(JSON.stringify(cust.body)).not.toMatch(/mobile|name/i);
    const hours = await api.request('GET', '/dashboard/metrics/busy-hours', undefined, MGR);
    expect(hours.status).toBe(200);
    for (const c of hours.body.cells) { expect(c.dow).toBeGreaterThanOrEqual(1); expect(c.dow).toBeLessThanOrEqual(7); }
    const pay = await api.request('GET', '/dashboard/metrics/payables', undefined, MGR);
    expect(pay.status).toBe(200);
    expect(pay.body.buckets.map((b: any) => b.key)).toEqual(['notdue', 'd0_30', 'd31_60', 'd61_90', 'd90_plus']);
  });

  test('HM-7 tiles carry a value, a change and whether it is good, with a spark line on sales @happy', async ({ api }) => {
    const r = await api.request('GET', '/dashboard/tiles', undefined, MGR);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.compare).toBe('prev');
    const keys = r.body.tiles.map((t: any) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['sales', 'bills', 'avgbill', 'discount', 'returns']));
    const sales = r.body.tiles.find((t: any) => t.key === 'sales');
    expect(sales.spark).toHaveLength(14);
    for (const t of r.body.tiles) expect(['good', 'bad', 'flat', null]).toContain(t.tone);
    // up is good for sales and down is good for discounts
    const d = r.body.tiles.find((t: any) => t.key === 'discount');
    if (d.dir === 'up') expect(d.tone).toBe('bad');
    if (d.dir === 'down') expect(d.tone).toBe('good');
    const year = await api.request('GET', '/dashboard/tiles?compare=lastyear', undefined, MGR);
    expect(year.body.compare).toBe('lastyear');
    expect(year.body.against).not.toBe(r.body.against);
  });

  test('HM-8 margin is for the owner only and always says how much of the sales it covers @negative', async ({ api }) => {
    const owner = await api.request('GET', '/dashboard/tiles', undefined, MGR);
    const margin = owner.body.tiles.find((t: any) => t.key === 'margin');
    if (margin) {
      expect(typeof margin.coverage).toBe('number');
      if (margin.withheld) expect(margin.coverage).toBeLessThan(80);
    }
    const head = await api.request('GET', '/dashboard/tiles', undefined, HEAD);
    expect(head.status).toBe(200);
    expect(head.body.tiles.map((t: any) => t.key)).not.toContain('margin');
    expect(JSON.stringify(head.body)).not.toMatch(/cogs|cost/i);
  });

  test('HM-9 deliveries and expenses charts return their shape and are not for the counter @happy', async ({ api }) => {
    const del = await api.request('GET', '/dashboard/metrics/deliveries', undefined, MGR);
    expect(del.status, JSON.stringify(del.body)).toBe(200);
    for (const w of del.body.weeks) expect(Object.keys(w)).toEqual(expect.arrayContaining(['week', 'delivered', 'failed', 'pending']));
    const exp = await api.request('GET', '/dashboard/metrics/expenses', undefined, MGR);
    expect(exp.status).toBe(200);
    expect(typeof exp.body.total).toBe('number');
    for (const p of ['tiles', 'metrics/deliveries', 'metrics/expenses']) expect((await api.request('GET', `/dashboard/${p}`, undefined, SALES)).status, p).toBe(403);
    expect((await api.request('GET', '/dashboard/tiles?storeid=999999', undefined, MGR)).status).toBe(403);
  });

  test('HM-10 the sales basis can be chosen: target only has nothing without a target, off measures nothing, last month measures against last month @happy', async ({ api }) => {
    const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    const choose = (v: string) => api.request('PUT', '/config/health', { values: { sales_basis: v }, effectiveFrom: today }, MGR);
    const sales = async () => { const h = (await api.request('GET', '/dashboard/health', undefined, MGR)).body; return { check: h.checks.find((c: any) => c.key === 'sales'), basis: h.salesBasis }; };
    try {
      await api.request('PUT', '/dashboard/targets', { month, value: null }, MGR);
      expect((await choose('target')).status).toBe(200);
      let r = await sales();
      expect(r.check.score).toBeNull();
      expect(r.check.fact).toMatch(/set a target|another basis/i);
      expect((await choose('off')).status).toBe(200);
      r = await sales();
      expect(r.check.score).toBeNull();
      expect(r.check.fact).toMatch(/switched off/i);
      expect((await choose('last month')).status).toBe(200);
      r = await sales();
      expect(r.basis.chosen).toBe('last month');
      if (r.check.score !== null) expect(r.basis.used).toBe('last month');
      // a target set now wins under the default
      expect((await api.request('DELETE', '/config/health/sales_basis', undefined, MGR)).status).toBe(200);
      await api.request('PUT', '/dashboard/targets', { month, value: 500000 }, MGR);
      r = await sales();
      expect(r.basis.used).toBe('target');
    } finally {
      await api.request('DELETE', '/config/health/sales_basis', undefined, MGR);
      await api.request('PUT', '/dashboard/targets', { month, value: null }, MGR);
    }
  });

  test('HM-11 a target can be suggested from history, for the Business Head only, and nothing is saved @happy', async ({ api }) => {
    const r = await api.request('GET', '/dashboard/targets/suggest?growth=10', undefined, MGR);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.growth).toBe(10);
    expect(['same month last year', 'recent average', null]).toContain(r.body.business.basis);
    if (r.body.business.value !== null) expect(r.body.business.value % 100).toBe(0);
    expect(Array.isArray(r.body.stores)).toBe(true);
    expect((await api.request('GET', `/dashboard/targets?month=${month}`, undefined, MGR)).body.business).toBeNull();
    expect((await api.request('GET', '/dashboard/targets/suggest', undefined, HEAD)).status).toBe(403);
    expect((await api.request('GET', '/dashboard/targets/suggest', undefined, SALES)).status).toBe(403);
  });

  test('HM-5 the figures are for the people who run the business or a store, not the counter @negative', async ({ api }) => {
    for (const path of ['health', 'targets', 'metrics/sales-by-month', 'metrics/categories', 'metrics/customers', 'metrics/busy-hours', 'metrics/payables']) {
      const r = await api.request('GET', `/dashboard/${path}`, undefined, SALES);
      expect(r.status, path).toBe(403);
    }
    expect((await api.request('GET', '/dashboard/health', undefined, HEAD)).status).toBe(200);
  });

  test('HM-6 a store that is not theirs is refused @negative', async ({ api }) => {
    const other = await api.request('POST', '/stores', { location: `HM other ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
    expect(other.status).toBeLessThan(300);
    // the Business Head owns every store of the business; a made-up store id is outside it
    expect((await api.request('GET', '/dashboard/health?storeid=999999', undefined, MGR)).status).toBe(403);
    expect((await api.request('GET', '/dashboard/metrics/sales-by-month?storeid=999999', undefined, MGR)).status).toBe(403);
    expect((await api.request('GET', `/dashboard/health?storeid=${other.body.id}`, undefined, MGR)).status).toBe(200);
  });
});
