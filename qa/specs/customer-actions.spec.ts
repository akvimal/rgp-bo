/**
 * The sensitive customer actions are actions on the customers permission - RCA-1..4 (MENU_AND_PERMISSIONS step E, Customers).
 * delete, merge, creditlimit.set, credit.correct, households.manage, followup.wording, relationships.setup: a role holding one can do that and
 * nothing else; read, reveal and export open none of them; the owner roles hold them by name and the Store Head by migration.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only the Customers page with these actions, and a login with it */
async function loginWith(api: any, actions: string[]) {
  const block = { resource: 'customers', path: ['/secure/customers'], policies: actions.map((action) => ({ action })) };
  const role = await api.request('POST', '/roles', { name: `QA Cus ${stamp()}`, permissions: [block], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rca.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RCA', email, password: PASS, phone: '9000000015', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}

const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;
const NONE = 999999;       // a customer that does not exist: an allowed call answers 400 or 404, a refused one 403

/** every sensitive route, with a body that changes nothing, and the action that opens it */
const ROUTES: Array<{ action: string; method: string; path: string; body?: unknown }> = [
  { action: 'delete', method: 'DELETE', path: `/customers/${NONE}` },
  { action: 'merge', method: 'POST', path: '/customers/merge', body: {} },
  { action: 'merge', method: 'POST', path: '/customers/households/merge', body: {} },
  { action: 'creditlimit.set', method: 'PUT', path: `/customer-dues/${NONE}/limit`, body: {} },
  { action: 'credit.correct', method: 'POST', path: `/customer-dues/${NONE}/adjustment`, body: {} },
  { action: 'credit.correct', method: 'POST', path: `/customers/${NONE}/credit/adjustment`, body: {} },
  { action: 'households.manage', method: 'POST', path: '/customers/households/transfer', body: {} },
  { action: 'followup.wording', method: 'PUT', path: '/customer-relations/followup-templates', body: { templates: { dues: { en: 'x' } } } },
  { action: 'relationships.setup', method: 'PUT', path: '/customer-relations/settings', body: { activeDays: -5 } },
];

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Customer actions @p1', () => {
  test('RCA-1 read, reveal and export open none of the sensitive actions @negative', async ({ api }) => {
    const email = await loginWith(api, ['read', 'reveal', 'export']);
    for (const r of ROUTES) expect(await status(api, r.method, r.path, email, r.body), `${r.method} ${r.path}`).toBe(403);
  });

  test('RCA-2 a role holding one action reaches its routes and none of the others @permission', async ({ api }) => {
    for (const action of ['delete', 'merge', 'creditlimit.set', 'credit.correct', 'households.manage', 'followup.wording', 'relationships.setup']) {
      const email = await loginWith(api, ['read', action]);
      for (const r of ROUTES) {
        const code = await status(api, r.method, r.path, email, r.body);
        if (r.action === action) expect(code, `${action} -> ${r.method} ${r.path}`).not.toBe(403);
        else expect(code, `${action} must not open ${r.method} ${r.path}`).toBe(403);
      }
    }
  });

  test('RCA-3 the owner roles reach every sensitive route by name, and the Store Head the manager-level ones by migration @permission', async ({ api }) => {
    for (const r of ROUTES) expect(await status(api, r.method, r.path, MGR, r.body), `owner ${r.method} ${r.path}`).not.toBe(403);
    const manager = ['delete', 'creditlimit.set', 'households.manage', 'followup.wording'];
    const owner = ['merge', 'credit.correct', 'relationships.setup'];
    for (const r of ROUTES) {
      const code = await status(api, r.method, r.path, HEAD, r.body);
      if (manager.includes(r.action)) expect(code, `Store Head ${r.method} ${r.path}`).not.toBe(403);
      if (owner.includes(r.action)) expect(code, `Store Head ${r.method} ${r.path}`).toBe(403);
    }
  });

  test('RCA-4 a login with no customer grant at all is refused every one of them @negative', async ({ api }) => {
    for (const r of ROUTES) expect(await status(api, r.method, r.path, 'sales1@local.test', r.body), `${r.method} ${r.path}`).toBe(403);
  });
});
