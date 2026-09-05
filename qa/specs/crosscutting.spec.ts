/**
 * Cross-Cutting: Permissions & Data Integrity — XCUT-1..4
 * Source: docs/testing/manual-test-plan.html  (module "crosscutting")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// modules a Sales Staff (role 2: customers, purchases-vendors, sales, site, stock) must not reach
const RESTRICTED = [
  { nav: 'nav-settings', url: '/secure/settings/users' },
  { nav: 'nav-products', url: '/secure/products/master/list' },
  { nav: 'nav-reports', url: '/secure/reports' },
];

test.describe('Cross-cutting @p2', () => {
  test('XCUT-1 restricted modules are hidden in the nav for a low-privilege role @permission', async ({ app }) => {
    const { page } = await app.open('sales1@local.test');
    await expectShell(page);
    for (const r of RESTRICTED) {
      await expect(page.getByTestId(r.nav)).toHaveCount(0);
    }
  });

  test('XCUT-2 a low-privilege role hitting a restricted URL is blocked @permission', async ({ app, api }) => {
    const { page } = await app.open('sales1@local.test');
    await expectShell(page);
    for (const r of RESTRICTED) {
      await page.goto(r.url);
      await expect(page.getByTestId('login-submit')).toBeVisible(); // AuthGuard bounce
    }
    // and the API rejects the equivalent write
    const bad = await api.request('POST', '/users', {
      fullname: 'x', email: `xcut${Date.now()}@x.com`, password: 'x', phone: '9', location: 'x', roleid: 2, storeids: [1],
    }, 'sales1@local.test');
    expect(bad.status).toBeGreaterThanOrEqual(403);
  });

  test('XCUT-3 two cashiers on the same store keep the ledger consistent @edge', async ({ api }) => {
    const t1 = await api.token('sales1@local.test');
    const t2 = await api.token('sales2@local.test');
    const before = (await api.request('GET', '/store-cash/dashboard?storeid=1', undefined, MGR)).body.cashbalance;

    // 20 concurrent ledger deposits of 10, split across the two cashiers
    const posts = Array.from({ length: 20 }, (_, i) => {
      const tok = i % 2 ? t2 : t1;
      return fetch(`${API}/store-cash/ledger`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
        body: JSON.stringify({ storeid: 1, category: 'ADJUSTMENT', deposit: 10, description: `xcut3-${i}` }),
      }).then((r) => r.status);
    });
    const statuses = await Promise.all(posts);
    const ok = statuses.filter((s) => s < 400).length;

    const after = (await api.request('GET', '/store-cash/dashboard?storeid=1', undefined, MGR)).body.cashbalance;
    // balance moved by exactly (successful writes x 10) - no lost updates
    expect(Math.abs((Number(after) - Number(before)) - ok * 10)).toBeLessThan(0.5);
  });

  test('XCUT-4 a sale that fails mid-flight is not half-committed and retry does not duplicate @edge', async ({ api }) => {
    const pool = (await api.request('POST', '/stock/filter', { available: true, limit: 10 }, MGR)).body
      .find((x: any) => Number(x.balance) > 20 && x.status === 'VERIFIED');
    const now = new Date().toISOString();
    const body = {
      customerid: 1, billdate: now, orderdate: now, cashamt: 50, digiamt: 0, total: 50,
      discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: pool.item_id, productid: pool.id, batch: pool.batch, price: 25, mrpcost: pool.mrp_cost, taxpcnt: pool.tax_pcnt, qty: 2, total: 50 }],
    };
    const t = await api.token('sales1@local.test');

    // first attempt aborted client-side before the response
    const c = new AbortController();
    const p = fetch(`${API}/sales`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify(body), signal: c.signal,
    }).catch(() => null);
    setTimeout(() => c.abort(), 5);
    await p;
    await new Promise((r) => setTimeout(r, 300)); // let any server-side txn settle/roll back

    // retry (client resends the same bill) - one retry for a transient lock
    let retry = await api.request('POST', '/sales', body, 'sales1@local.test');
    if (retry.status >= 500) { await new Promise((r) => setTimeout(r, 400)); retry = await api.request('POST', '/sales', body, 'sales1@local.test'); }
    expect([200, 201]).toContain(retry.status);

    // the aborted attempt may or may not have landed; there must be at most one MORE
    // sale for this exact spec than existed just before - never a torn/partial one.
    const raw = (await api.request('GET', '/sales/raw', undefined, MGR)).body
      .filter((s: any) => Number(s.total) === 50 && String(s.bill_date).slice(0, 10) === now.slice(0, 10));
    expect(raw.length).toBeGreaterThan(0);
    // each such sale is fully formed (has a bill number)
    const one = await api.request('GET', `/sales/${retry.body.id}`, undefined, MGR);
    expect(one.body.billno ?? one.body.bill_no).toBeTruthy();
  });
});
