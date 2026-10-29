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
    expect((await api.request('GET', '/dashboard/health', undefined, MGR)).body.checks.find((c: any) => c.key === 'sales').score).toBeNull();
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
