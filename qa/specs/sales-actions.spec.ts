/**
 * Till overrides that were decided by role name are actions on the sales permission - RSA-1..3 (MENU_AND_PERMISSIONS step E, Sales).
 * batchstop.override, creditlimit.override, deliveries.manage, returns.settings. The API-visible one is returns.settings (a refusal or not on the
 * return rules); the others change what a bill is allowed to do and are covered by the unit tests, with the migration checked here.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only the Sales page with these actions, and a login with it */
async function loginWith(api: any, actions: string[]) {
  const block = { resource: 'sales', path: ['/secure/sales/pos'], policies: actions.map((action) => ({ action })) };
  const role = await api.request('POST', '/roles', { name: `QA Sal ${stamp()}`, permissions: [block], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rsa.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RSA', email, password: PASS, phone: '9000000016', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}

const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Sales actions @p1', () => {
  test('RSA-1 returns.settings sets the return rules; billing, void, force void and the other overrides do not @permission', async ({ api }) => {
    const others = await loginWith(api, ['read', 'view', 'add', 'bill', 'void', 'forcevoid', 'batchstop.override', 'creditlimit.override', 'deliveries.manage']);
    expect(await status(api, 'PUT', '/sales/return-rules', others, {})).toBe(403);
    const setter = await loginWith(api, ['read', 'returns.settings']);
    expect(await status(api, 'PUT', '/sales/return-rules', setter, {})).toBe(400);                    // allowed; no category given
    expect(await status(api, 'PUT', '/sales/return-rules', MGR, {})).toBe(400);                       // the owner is unchanged
  });

  test('RSA-2 the Store Head cannot set return rules (owner level), and a login with no sales grant is refused @negative', async ({ api }) => {
    expect(await status(api, 'PUT', '/sales/return-rules', HEAD, {})).toBe(403);
    expect(await status(api, 'PUT', '/sales/return-rules', 'sales1@local.test', {})).toBe(403);
  });

  test('RSA-3 migration 216 gave the Store Head the manager-level overrides and the owner roles all four @permission', async ({ api }) => {
    const me = async (email: string) => ((await api.request('GET', '/auth/me', undefined, email)).body.permissions || []) as any[];
    const salesActions = (perms: any[]) => (perms.find((p) => p.resource === 'sales')?.policies || []).map((p: any) => p.action);
    const head = salesActions(await me(HEAD));
    ['batchstop.override', 'creditlimit.override', 'deliveries.manage'].forEach((a) => expect(head, `Store Head ${a}`).toContain(a));
    expect(head).not.toContain('returns.settings');
    const owner = salesActions(await me(MGR));
    ['batchstop.override', 'creditlimit.override', 'deliveries.manage', 'returns.settings'].forEach((a) => expect(owner, `owner ${a}`).toContain(a));
    const counter = salesActions(await me('sales1@local.test'));
    ['batchstop.override', 'creditlimit.override', 'deliveries.manage', 'returns.settings'].forEach((a) => expect(counter, `sales staff ${a}`).not.toContain(a));
  });
});
