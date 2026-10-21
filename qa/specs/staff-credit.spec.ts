/**
 * Staff credit — SC-1..4
 * Staff put a bill on their own credit; the Business Head caps it per month and records what is taken from salary.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const STAFF_EMAIL = 'sales2@local.test';

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
    itemid: x.item_id, productid: x.id, batch: x.batch,
    price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)),
    mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

function bill(over: Record<string, any>, total = 100) {
  const s = POOL[POOL.length - 1];   // the other end of the pool: stock-transfer specs use the first lines
  const now = new Date().toISOString();
  return {
    customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: 0, digiamt: 0,
    total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 1, total }],
    ...over,
  };
}

async function staffId(api: any) {
  const users = (await api.request('GET', '/users', undefined, MGR)).body;
  return users.find((u: any) => u.email === STAFF_EMAIL).id as number;
}
const period = () => new Date().toISOString().slice(0, 7);

test.describe('Staff credit @p1', () => {
  test('SC-1 only the Business Head sets limits and sees balances; the counter sees who can be billed @negative', async ({ api }) => {
    const id = await staffId(api);
    expect((await api.request('PUT', `/staff-credit/${id}/cap`, { cap: 500 }, COUNTER)).status).toBe(403);
    expect((await api.request('GET', `/staff-credit/summary?period=${period()}`, undefined, COUNTER)).status).toBe(403);
    expect((await api.request('PUT', `/staff-credit/${id}/cap`, { cap: -5 }, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/staff-credit/${id}/cap`, { cap: 500 }, MGR)).status).toBeLessThan(300);

    const opts = (await api.request('GET', '/staff-credit/options', undefined, COUNTER)).body;
    const mine = opts.find((o: any) => o.id === id);
    expect(mine.cap).toBe(500);
    expect(mine.remaining).toBeLessThanOrEqual(500);
    expect(Object.keys(mine).sort()).toEqual(['cap', 'id', 'name', 'remaining']);            // names and what is left, nothing about balances
    const sum = (await api.request('GET', `/staff-credit/summary?period=${period()}`, undefined, MGR)).body;
    expect(sum.find((r: any) => r.user_id === id).cap).toBe(500);
  });

  test('SC-2 a bill on staff credit is allowed inside the limit and refused beyond it @edge', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const id = await staffId(api);
    const before = (await api.request('GET', `/staff-credit/summary?period=${period()}`, undefined, MGR)).body.find((r: any) => r.user_id === id);
    await api.request('PUT', `/staff-credit/${id}/cap`, { cap: before.credit_month + 150 }, MGR);

    const post = (over: any, total = 100) => api.request('POST', '/sales', bill(over, total), COUNTER);
    expect((await post({ staffcreditamt: 100, staffcredituserid: id, cashamt: 50 })).status).toBe(400);              // no mixing with cash
    expect((await post({ staffcreditamt: 100 })).status).toBe(400);                                                  // whose credit?
    const first = await post({ staffcreditamt: 100, staffcredituserid: id });
    expect(first.status).toBeLessThan(300);
    expect(Number(first.body.staffcreditamt)).toBe(100);

    const second = await post({ staffcreditamt: 100, staffcredituserid: id });                                       // 100 + 100 > 150
    expect(second.status).toBe(400);
    expect(JSON.stringify(second.body)).toContain('monthly staff-credit limit');

    const entries = (await api.request('GET', `/staff-credit/${id}/entries`, undefined, MGR)).body.rows;
    expect(entries.some((e: any) => e.kind === 'CREDIT' && e.sale_id === first.body.id && Number(e.amount) === 100)).toBe(true);
    const after = (await api.request('GET', `/staff-credit/summary?period=${period()}`, undefined, MGR)).body.find((r: any) => r.user_id === id);
    expect(after.credit_month).toBeCloseTo(before.credit_month + 100, 1);
    expect(after.outstanding).toBeCloseTo(before.outstanding + 100, 1);

    // a person with no limit cannot be billed
    const other = (await api.request('GET', '/users', undefined, MGR)).body.find((u: any) => u.email === 'storehead@local.test').id;
    expect((await post({ staffcreditamt: 50, staffcredituserid: other }, 50)).status).toBe(400);
  });

  test('SC-3 recoveries and adjustments bring the balance down or correct it, with a reason, audited @happy', async ({ api }) => {
    const id = await staffId(api);
    const bal = async () => (await api.request('GET', `/staff-credit/summary?period=${period()}`, undefined, MGR)).body.find((r: any) => r.user_id === id).outstanding as number;
    // make sure there is something to recover
    await api.request('POST', `/staff-credit/${id}/adjustment`, { amount: 80, note: 'QA opening balance' }, MGR);
    const start = await bal();
    expect(start).toBeGreaterThanOrEqual(80);

    expect((await api.request('POST', `/staff-credit/${id}/recovery`, { amount: start + 1000, period: period() }, MGR)).status).toBe(400);   // more than owed
    expect((await api.request('POST', `/staff-credit/${id}/recovery`, { amount: 30, period: 'bad' }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/staff-credit/${id}/recovery`, { amount: 30, period: period() }, COUNTER)).status).toBe(403);
    expect((await api.request('POST', `/staff-credit/${id}/recovery`, { amount: 30, period: period(), note: 'QA salary' }, MGR)).status).toBeLessThan(300);
    expect(await bal()).toBeCloseTo(start - 30, 1);

    expect((await api.request('POST', `/staff-credit/${id}/adjustment`, { amount: -10, note: 'x' }, MGR)).status).toBe(400);              // a reason is needed
    expect((await api.request('POST', `/staff-credit/${id}/adjustment`, { amount: -10, note: 'QA returned item' }, MGR)).status).toBeLessThan(300);
    expect(await bal()).toBeCloseTo(start - 40, 1);

    const audit = await api.request('GET', '/audit?action=staffcredit.recovered&limit=3', undefined, MGR);
    expect(audit.body.rows.length).toBeGreaterThan(0);
  });

  test('SC-4 the Staff credit page shows the month, sets a limit and records a recovery @happy', async ({ app, api }) => {
    const id = await staffId(api);
    await api.request('POST', `/staff-credit/${id}/adjustment`, { amount: 60, note: 'QA page balance' }, MGR);
    const { page } = await app.open(MGR, '/secure/quality/staff-credit');
    await expectShell(page);
    await expect(page.locator('#main h1').first()).toHaveText('Staff & Quality');
    await expect(page.getByTestId('tab-staff-credit')).toBeVisible();
    const row = page.locator(`[data-testid=sc-row][data-user="${id}"]`);
    await expect(row).toBeVisible();
    await row.getByTestId('sc-cap').fill('700');
    await row.getByTestId('sc-cap-save').click();
    await expect(page.getByTestId('sc-message')).toContainText('limit saved');
    await row.getByTestId('sc-recover').click();
    await page.getByTestId('sc-amount').fill('20');
    await page.getByTestId('sc-save').click();
    await expect(page.getByTestId('sc-message')).toContainText('recovery recorded');
    await expect(page.getByTestId('sc-entry').first()).toContainText('Recovered from salary');

    // the counter has no such page
    const counter = await app.open(COUNTER, '/secure/quality/staff-credit');
    await expect(counter.page).toHaveURL(/\/login|\/secure\/quality\/refills|\/secure\/sales/);
  });
});
