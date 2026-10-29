/**
 * Returns on or off, for a business and for a store - RS-1..4
 * A business that takes no returns has none (module "returns"); a store can turn them off for itself but cannot turn them on
 * for a business that has them off; returns already recorded can still be settled; only the Business Head chooses.
 * Every test restores what it changed.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

let POOL: any[] = [];
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
  const rows = await (await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
    body: JSON.stringify({ available: true, limit: 200 }),
  })).json();
  POOL = rows.filter((x: any) => Number(x.balance) > 30 && x.status === 'VERIFIED').map((x: any) => ({
    itemid: x.item_id, productid: x.id, batch: x.batch, category: x.category,
    mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

const mobile = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

function bill(s: any, qty = 2) {
  const now = new Date().toISOString();
  return {
    billdate: now, orderdate: now, cashamt: 100 * qty, digiamt: 0, total: 100 * qty, discamount: 0, expreturndays: 7,
    status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'QA Returns Switch', mobile: mobile() },
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: 100, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty, total: 100 * qty }],
  };
}

async function sell(api: any, s: any) {
  const sale = await api.request('POST', '/sales', bill(s), COUNTER);
  expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);
  const storeid = (await api.request('GET', `/sales/${sale.body.id}`, undefined, MGR)).body.storeid;
  return { line: sale.body.items[0], storeid };
}
const raise = (api: any, line: any) => api.request('POST', '/sales/returns', [{ saleitemid: line.id, qty: 1, status: 'NEW', reason: 'Defective' }], COUNTER);
const storeReturns = (api: any, storeid: number, allowed: boolean) => api.request('PUT', `/stores/${storeid}/profile`, { returnsallowed: allowed }, MGR);
const businessReturns = (api: any, v: boolean | null) => api.request('PUT', '/businesses/mine/modules', { returns: v }, MGR);

test.describe('Returns switch @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('RS-1 returns are on by default, for the business and for a store @happy', async ({ api }) => {
    await businessReturns(api, null);
    const mods = (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
    expect(mods.returns).toBe(true);
    const { line, storeid } = await sell(api, POOL[0]);
    expect((await api.request('GET', `/store-cash/profile?storeid=${storeid}`, undefined, MGR)).body.returnsallowed).toBe(true);
    const r = await raise(api, line);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  });

  test('RS-2 a store that takes no returns refuses them, and a return already recorded can still be settled @negative', async ({ api }) => {
    const { line, storeid } = await sell(api, POOL[1]);
    const first = await raise(api, line);                                                       // raised while the store took returns
    expect(first.status, JSON.stringify(first.body)).toBeLessThan(300);
    expect((await storeReturns(api, storeid, false)).status).toBeLessThan(300);
    try {
      expect((await api.request('GET', `/store-cash/profile?storeid=${storeid}`, undefined, MGR)).body.returnsallowed).toBe(false);
      const refused = await raise(api, line);
      expect(refused.status).toBe(403);
      expect(JSON.stringify(refused.body)).toMatch(/does not take returns/);
      const settle = await api.request('PUT', '/sales/returns', { id: first.body[0].id, status: 'ADJUSTED', refundmode: 'CREDIT' }, COUNTER);
      expect(settle.status, JSON.stringify(settle.body)).toBeLessThan(300);                       // what is already recorded is not locked out
    } finally {
      await storeReturns(api, storeid, true);
    }
    expect((await raise(api, line)).status).toBeLessThan(300);                                   // on again: the store takes returns
  });

  test('RS-3 a business that takes no returns has none: the API, the menu and the module list say so, and a store cannot turn it back on @negative', async ({ api }) => {
    const { line, storeid } = await sell(api, POOL[2]);
    expect((await businessReturns(api, false)).status).toBeLessThan(300);
    try {
      const mods = (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
      expect(mods.returns).toBe(false);
      const refused = await raise(api, line);
      expect(refused.status).toBe(403);
      expect(JSON.stringify(refused.body)).toMatch(/Sale returns/);
      expect((await api.request('GET', '/salereturns', undefined, MGR)).status).toBe(403);
      expect((await storeReturns(api, storeid, true)).status).toBeLessThan(300);                // the store's own switch cannot widen the business's
      expect((await raise(api, line)).status).toBe(403);
      const perms = (await api.request('GET', '/users/basic-details', undefined, MGR)).body;
      if (perms && Array.isArray(perms.permissions)) expect(perms.permissions.map((p: any) => p.resource)).not.toContain('returns');
    } finally {
      await businessReturns(api, null);
    }
    expect((await raise(api, line)).status).toBeLessThan(300);
  });

  test('RS-4 only the Business Head chooses, and only true or false is accepted @negative', async ({ api }) => {
    const { storeid } = await sell(api, POOL[3]);
    const staff = await api.request('PUT', `/stores/${storeid}/profile`, { returnsallowed: false }, COUNTER);
    expect([401, 403]).toContain(staff.status);
    const staffBiz = await api.request('PUT', '/businesses/mine/modules', { returns: false }, COUNTER);
    expect([401, 403]).toContain(staffBiz.status);
    const bad = await api.request('PUT', `/stores/${storeid}/profile`, { returnsallowed: 'no' }, MGR);
    expect(bad.status).toBe(400);
    const badBiz = await api.request('PUT', '/businesses/mine/modules', { returns: 'no' }, MGR);
    expect(badBiz.status).toBe(400);
    expect((await api.request('GET', `/store-cash/profile?storeid=${storeid}`, undefined, MGR)).body.returnsallowed).toBe(true);
  });
});
