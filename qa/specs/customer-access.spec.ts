/**
 * The day-to-day customer routes carry actions - RCD-1..4 (MENU_AND_PERMISSIONS step E, Customers, second pass).
 * dues.view, dues.collect, audiences.use, worklist.use, consent.manage: who owes, taking a payment, the contact list and log, consent. They were open to
 * any signed-in login. A role holding only the Customers page (read) reaches none of them; each action opens its own; the till's credit check still
 * works for a role that can add or bill a sale; the roles that held the page before keep all five (migration 217).
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];
const NONE = 999999;       // a customer that does not exist: an allowed call answers 400 or 404, a refused one 403

/** a login holding only these blocks */
async function loginWith(api: any, blocks: Array<{ resource: string; path: string; actions: string[] }>) {
  const permissions = blocks.map((b) => ({ resource: b.resource, path: [b.path], policies: b.actions.map((action) => ({ action })) }));
  const role = await api.request('POST', '/roles', { name: `QA Cud ${stamp()}`, permissions, locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rcd.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RCD', email, password: PASS, phone: '9000000018', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}
const customers = (...actions: string[]) => ({ resource: 'customers', path: '/secure/customers', actions });
const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;

/** every route this pass guards, the action that opens it, and a body that changes nothing */
const ROUTES: Array<{ action: string; method: string; path: string; body?: unknown }> = [
  { action: 'dues.view', method: 'GET', path: '/customer-dues/owing/all' },
  { action: 'dues.view', method: 'GET', path: `/customer-dues/${NONE}` },
  { action: 'dues.collect', method: 'POST', path: `/customer-dues/${NONE}/payment`, body: {} },
  { action: 'worklist.use', method: 'GET', path: '/customer-relations/worklist' },
  { action: 'worklist.use', method: 'GET', path: '/customer-relations/summary' },
  { action: 'worklist.use', method: 'GET', path: `/customer-relations/${NONE}/contacts` },
  { action: 'worklist.use', method: 'POST', path: `/customer-relations/${NONE}/snooze`, body: {} },
  { action: 'consent.manage', method: 'PUT', path: `/customer-relations/${NONE}/consent`, body: {} },
];

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Customer day-to-day actions @p1', () => {
  test('RCD-1 a role holding only the Customers page (read) reaches none of them @negative', async ({ api }) => {
    const email = await loginWith(api, [customers('read')]);
    for (const r of ROUTES) expect(await status(api, r.method, r.path, email, r.body), `${r.method} ${r.path}`).toBe(403);
    expect(await status(api, 'GET', '/customer-relations/audiences', email)).toBe(403);
    expect(await status(api, 'POST', '/customer-relations/audience', email, {})).toBe(403);
  });

  test('RCD-2 each action opens its own routes and none of the others @permission', async ({ api }) => {
    for (const action of ['dues.view', 'dues.collect', 'worklist.use', 'consent.manage']) {
      const email = await loginWith(api, [customers('read', action)]);
      for (const r of ROUTES) {
        const code = await status(api, r.method, r.path, email, r.body);
        if (r.action === action) expect(code, `${action} -> ${r.method} ${r.path}`).not.toBe(403);
        else expect(code, `${action} must not open ${r.method} ${r.path}`).toBe(403);
      }
    }
    // audiences.use alone opens the audiences; the numbers in them are masked unless the role may read them all
    const aud = await loginWith(api, [customers('read', 'audiences.use')]);
    const list = await api.request('GET', '/customer-relations/audiences', undefined, aud);
    expect(list.status).toBe(200);
    expect(await status(api, 'GET', '/customer-relations/worklist', aud)).toBe(403);                // another action
    expect(await status(api, 'POST', '/customer-relations/audience/export', aud, {})).toBe(403);    // the download needs the reveal and export grants
    const key = list.body.audiences[0].key;
    const masked = await api.request('POST', '/customer-relations/audience', { audience: key }, aud);
    expect(masked.status).toBeLessThan(300);
    (masked.body.members as any[]).filter((m) => m.mobile).forEach((m) => expect(m.masked, `member ${m.id} is masked`).toBe(true));
    const both = await loginWith(api, [customers('read', 'audiences.use', 'reveal')]);
    const full = await api.request('POST', '/customer-relations/audience', { audience: key }, both);
    expect(full.status).toBeLessThan(300);
    (full.body.members as any[]).forEach((m) => expect(m.masked, `member ${m.id} is not masked`).toBeFalsy());
  });

  test('RCD-3 the till still reads a customer\'s limit and balance; a role with no sales and no dues access does not @permission', async ({ api }) => {
    const till = await loginWith(api, [{ resource: 'sales', path: '/secure/sales/pos', actions: ['read', 'add'] }]);
    expect(await status(api, 'GET', `/customer-dues/${NONE}/brief`, till)).not.toBe(403);          // billing needs it
    expect(await status(api, 'GET', '/customer-dues/owing/all', till)).toBe(403);                  // the whole list of who owes does not come with it
    const nobody = await loginWith(api, [{ resource: 'products', path: '/secure/products', actions: ['read'] }]);
    expect(await status(api, 'GET', `/customer-dues/${NONE}/brief`, nobody)).toBe(403);
    expect(await status(api, 'GET', '/customer-dues/owing/all', nobody)).toBe(403);
  });

  test('RCD-4 the owner roles and the roles that held the Customers page keep all of them @permission', async ({ api }) => {
    for (const r of ROUTES) expect(await status(api, r.method, r.path, MGR, r.body), `owner ${r.method} ${r.path}`).not.toBe(403);
    for (const r of ROUTES) expect(await status(api, r.method, r.path, COUNTER, r.body), `counter ${r.method} ${r.path}`).not.toBe(403);
    expect(await status(api, 'GET', '/customer-dues/owing/all', COUNTER)).toBe(200);
  });

  test('RCD-5 audiences.use alone shows the Audiences link and the page, with numbers hidden behind Show number @happy', async ({ app, api }) => {
    const only = await loginWith(api, [customers('read')]);
    const a = await app.open(only, '/secure/customers/cust/list');
    await expect(a.page.getByTestId('cust-audiences-link')).toHaveCount(0);                          // no audiences action, no link
    const email = await loginWith(api, [customers('read', 'audiences.use')]);
    const { page } = await app.open(email, '/secure/customers/cust/list');
    await expect(page.getByTestId('cust-audiences-link')).toBeVisible();
    await page.getByTestId('cust-audiences-link').click();
    await page.waitForURL(/customers\/cust\/audiences/);
    // an audience with someone who can be contacted: their number is masked, with Show number instead of the WhatsApp and Call links
    const open = ((await api.request('GET', '/customer-relations/audiences', undefined, email)).body.audiences as any[]).find((a) => a.reachable > 0);
    test.skip(!open, 'no audience has a customer who can be contacted in this database');
    await page.getByTestId(`aud-${open.key}`).click();
    await expect(page.getByTestId('aud-table')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('aud-reveal').first()).toBeVisible();
    await expect(page.getByTestId('aud-wa')).toHaveCount(0);
  });
});
