/**
 * The Reports permission carries actions - RPA-1..6 (MENU_AND_PERMISSIONS step D, Reports).
 * A role holding only one action can do that and nothing else: sales, purchases, stock, margin, ask, export.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;

const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only the Reports page with these actions (none = the bare entry the page used to carry), and a login with it */
async function loginWith(api: any, actions: string[]) {
  const reports = { resource: 'reports', path: ['/secure/reports'], ...(actions.length ? { policies: actions.map((action) => ({ action })) } : {}) };
  const role = await api.request('POST', '/roles', { name: `QA Rpt ${stamp()}`, permissions: [reports], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rpa.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RPA', email, password: PASS, phone: '9000000009', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}

async function saleReport(api: any, email: string, action: 'search' | 'export') {
  const res = await fetch(`${API}/reports/sale`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await api.token(email)}` },
    body: JSON.stringify({ action, criteria: { report: 'sale', begin: '2026-08-01', end: '2026-09-30' } }),
  });
  return res.status === 201 ? 200 : res.status;      // the report is a POST, so Nest answers 201 for a run
}

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Reports actions @p1', () => {
  test('RPA-1 the sales action runs the sale report and nothing else; export is its own action @permission', async ({ api }) => {
    const email = await loginWith(api, ['sales']);
    expect(await saleReport(api, email, 'search')).toBe(200);
    expect(await saleReport(api, email, 'export')).toBe(403);
    expect((await api.request('GET', '/insights/ask/reports', undefined, email)).status).toBe(403);     // no Ask the shop tab
    expect((await api.request('GET', '/insights/weekly', undefined, email)).status).toBe(403);          // no weekly summary
    const exporter = await loginWith(api, ['sales', 'export']);
    expect(await saleReport(api, exporter, 'export')).toBe(200);
  });

  test('RPA-2 a bare Reports entry with no actions opens nothing @negative', async ({ api }) => {
    const email = await loginWith(api, []);
    expect(await saleReport(api, email, 'search')).toBe(403);
    expect((await api.request('GET', '/insights/ask/reports', undefined, email)).status).toBe(403);
  });

  test('RPA-3 Ask the shop lists only the reports of the families granted, and refuses the rest @permission', async ({ api }) => {
    const email = await loginWith(api, ['ask', 'sales']);
    const keys = (await api.request('GET', '/insights/ask/reports', undefined, email)).body.reports.map((r: any) => r.key);
    expect(keys).toContain('sales_summary');
    ['purchases_by_vendor', 'dead_stock', 'margin_by_product', 'customer_dues'].forEach((k) => expect(keys, k).not.toContain(k));
    expect((await api.request('POST', '/insights/ask/run', { report: 'sales_summary' }, email)).status).toBe(200);
    expect((await api.request('POST', '/insights/ask/run', { report: 'purchases_by_vendor' }, email)).status).toBe(403);
    expect((await api.request('POST', '/insights/ask/run', { report: 'margin_by_product' }, email)).status).toBe(403);
    // a family without the Ask tab opens no report in it
    const noAsk = await loginWith(api, ['sales']);
    expect((await api.request('POST', '/insights/ask/run', { report: 'sales_summary' }, noAsk)).status).toBe(403);
  });

  test('RPA-4 purchases and stock open their own reports, and margin opens profit, dues and the weekly summary @permission', async ({ api }) => {
    const buyer = await loginWith(api, ['ask', 'purchases', 'stock']);
    expect((await api.request('POST', '/insights/ask/run', { report: 'purchases_by_vendor' }, buyer)).status).toBe(200);
    expect((await api.request('POST', '/insights/ask/run', { report: 'dead_stock' }, buyer)).status).toBe(200);
    expect((await api.request('POST', '/insights/ask/run', { report: 'sales_summary' }, buyer)).status).toBe(403);
    expect((await api.request('POST', '/insights/ask/run', { report: 'margin_by_product' }, buyer)).status).toBe(403);
    const reader = await loginWith(api, ['ask', 'margin']);
    expect((await api.request('POST', '/insights/ask/run', { report: 'margin_by_product' }, reader)).status).toBe(200);
    expect((await api.request('POST', '/insights/ask/run', { report: 'customer_dues' }, reader)).status).toBe(200);
    expect((await api.request('GET', '/insights/weekly', undefined, reader)).status).toBe(200);
  });

  test('RPA-5 the Store Head keeps Ask the shop, the owner keeps everything, and migration 209 left the old roles their reports @permission', async ({ api }) => {
    const head = (await api.request('GET', '/insights/ask/reports', undefined, HEAD)).body.reports.map((r: any) => r.key);
    expect(head).toContain('sales_summary');
    expect(head).not.toContain('margin_by_product');
    expect((await api.request('GET', '/insights/weekly', undefined, HEAD)).status).toBe(403);
    expect((await api.request('GET', '/insights/weekly', undefined, MGR)).status).toBe(200);
    expect(await saleReport(api, HEAD, 'search')).toBe(200);
  });

  test('RPA-6 the Reports screen shows only the tabs and cards the role holds, and a page it may not open sends it to the first it may @happy', async ({ app, api }) => {
    const email = await loginWith(api, ['ask', 'sales']);
    const asker = await loginWith(api, ['ask', 'purchases']);
    const a = await app.open(email, '/secure/reports');
    await expectShell(a.page);
    await expect(a.page.getByTestId('rp-tab-all')).toBeVisible();
    await expect(a.page.getByTestId('rh-ask')).toBeVisible();
    await expect(a.page.getByTestId('rh-weekly')).toHaveCount(0);        // a card follows the action, as the tab does
    await expect(a.page.getByTestId('rp-tab-ask')).toBeVisible();
    await expect(a.page.getByTestId('rp-tab-weekly')).toHaveCount(0);
    // a role without the Ask the shop action still opens the hub, but not that page
    const b = await app.open(asker, '/secure/reports/weekly');
    await b.page.waitForURL(/\/secure\/reports\/ask/);
    await expect(b.page.getByTestId('rp-tab-ask')).toBeVisible();
  });
});
