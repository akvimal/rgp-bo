/**
 * Dashboard scope - DS-1..5
 * The server, not the screen, decides what a person sees: an owner sees the business's stores, anyone else the stores they are assigned to; a store that is
 * not theirs is refused; purchasing and customer names are not sent to people who do not work with them; an owner's admin counts are their own business's.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const ADMIN = 'siteadmin@local.test';
const SALES = 'sales1@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const STORE_HEAD = 3;
const run = Date.now().toString().slice(-7);

const store = async (api: any, tag: string) => {
  const s = await api.request('POST', '/stores', { location: `DS ${tag} ${run}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status, JSON.stringify(s.body)).toBeLessThan(300);
  return s.body.id as number;
};
const person = async (api: any, storeId: number, tag: string) => {
  const email = `qa.ds.${tag}.${run}@local.test`;
  const r = await api.request('POST', '/users', { fullname: 'QA Dash User', email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid: STORE_HEAD, storeids: [storeId] }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return email;
};
const summary = (api: any, as: string, storeid?: number) => api.request('GET', `/dashboard/summary${storeid ? `?storeid=${storeid}` : ''}`, undefined, as);

test.describe('Dashboard scope @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('DS-1 an owner sees the business and any of its stores, and is refused a store of another business @happy', async ({ api }) => {
    const mine = (await api.request('GET', '/stores', undefined, MGR)).body as any[];
    const all = (await api.request('GET', '/stores', undefined, ADMIN)).body as any[];
    const own = new Set(mine.map((s) => s.id));
    const foreign = all.find((s) => !own.has(s.id));
    expect((await summary(api, MGR)).status).toBe(200);
    expect((await summary(api, MGR, mine[0].id)).status).toBe(200);
    if (foreign) {
      const refused = await summary(api, MGR, foreign.id);
      expect(refused.status).toBe(403);
      expect(JSON.stringify(refused.body)).toMatch(/not one of yours/);
      expect((await api.request('GET', `/dashboard/trends?storeid=${foreign.id}`, undefined, MGR)).status).toBe(403);
    }
  });

  test('DS-2 a person assigned to one store sees that store and is refused another store of the same business @negative', async ({ api }) => {
    const s1 = await store(api, 'one'), s2 = await store(api, 'two');
    const head = await person(api, s1, 'head');
    expect((await summary(api, head, s1)).status).toBe(200);
    const refused = await summary(api, head, s2);
    expect(refused.status).toBe(403);
    expect((await api.request('GET', `/dashboard/trends?storeid=${s2}`, undefined, head)).status).toBe(403);
    const mine = await summary(api, head);                                           // no store asked for: only the stores assigned
    expect(mine.status).toBe(200);
    expect(mine.body.kpis.sales_month).toBe((await summary(api, head, s1)).body.kpis.sales_month);
  });

  test('DS-3 a counter person is not sent purchasing, and no customer names @negative', async ({ api }) => {
    const s = (await summary(api, SALES)).body;
    expect(s.pendingapprovals).toEqual([]);
    expect(s.lowstock).toEqual([]);
    expect(s.approvalbreakdown).toEqual([]);
    const t = (await api.request('GET', '/dashboard/trends', undefined, SALES)).body;
    expect(t.topCustomers).toEqual([]);
    expect(Array.isArray(t.topProductsByQty)).toBe(true);
  });

  test('DS-4 an owner is sent purchasing and may see customer names; the Business Head still gets the figures @happy', async ({ api }) => {
    const s = (await summary(api, MGR)).body;
    expect(Array.isArray(s.pendingapprovals)).toBe(true);
    expect(s.approvalbreakdown.length).toBeGreaterThan(0);
    expect(typeof s.kpis.sales_month).toBe('number');
    const t = (await api.request('GET', '/dashboard/trends', undefined, MGR)).body;
    expect(Array.isArray(t.topCustomers)).toBe(true);
  });

  test('DS-5 the admin counts of an owner are their own business; a platform user sees them all @edge', async ({ api }) => {
    const own = (await api.request('GET', '/dashboard/admin-summary', undefined, MGR)).body;
    expect(own.businesses).toBe(1);
    expect(own.storesByBusiness).toHaveLength(1);
    const all = (await api.request('GET', '/dashboard/admin-summary', undefined, ADMIN)).body;
    expect(all.businesses).toBeGreaterThan(1);
    expect((await api.request('GET', '/dashboard/admin-summary', undefined, SALES)).status).toBe(403);
  });
});
