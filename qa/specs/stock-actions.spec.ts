/**
 * The old all-in-one stock gate is split into actions on the store permission - RST-1..5 (MENU_AND_PERMISSIONS step D, Stock).
 * qty.adjust, audit.approve, count.perform, transfer.request, transfer.receive: a role holding one can do that and nothing else; the old
 * store adjust box opens none of them; the owner roles hold them by name and the Store Head by migration.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only the Stock & Cash page with these actions, and a login with it */
async function loginWith(api: any, actions: string[]) {
  const store = { resource: 'store', path: ['/secure/store/stock'], policies: actions.map((action) => ({ action })) };
  const role = await api.request('POST', '/roles', { name: `QA Stk ${stamp()}`, permissions: [store], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rst.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RST', email, password: PASS, phone: '9000000012', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}

const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;
const store = () => data.storesOf(1)[0].id;

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Stock actions @p1', () => {
  test('RST-1 the old store adjust, read and shift boxes open none of the stock actions @negative', async ({ api }) => {
    const email = await loginWith(api, ['read', 'adjust', 'shift.open', 'shift.close']);
    for (const path of ['/stock/adjust/qty', '/stock/audit', '/stock/counts', '/store-stock-transfers']) {
      expect(await status(api, 'GET', path, email), path).toBe(403);
    }
    expect(await status(api, 'POST', '/stock/adjust/qty', email, [])).toBe(403);
    expect(await status(api, 'PUT', '/stock/audit/1/approve', email, {})).toBe(403);
    expect(await status(api, 'POST', '/store-stock-transfers', email, {})).toBe(403);
  });

  test('RST-2 qty.adjust changes quantities and nothing else @permission', async ({ api }) => {
    const email = await loginWith(api, ['qty.adjust']);
    expect(await status(api, 'GET', '/stock/adjust/qty', email)).toBe(200);
    expect(await status(api, 'POST', '/stock/adjust/qty', email, [])).not.toBe(403);                  // allowed to try; an empty list changes nothing
    expect(await status(api, 'GET', '/stock/audit', email)).toBe(403);                                // approving is its own action
    expect(await status(api, 'PUT', '/stock/audit/999999/approve', email, {})).toBe(403);
    expect(await status(api, 'GET', '/stock/counts', email)).toBe(403);
    expect(await status(api, 'GET', '/store-stock-transfers', email)).toBe(403);
  });

  test('RST-3 audit.approve and count.perform are separate @permission', async ({ api }) => {
    const approver = await loginWith(api, ['audit.approve']);
    expect(await status(api, 'GET', '/stock/audit', approver)).toBe(200);
    expect(await status(api, 'PUT', '/stock/audit/999999/reject', approver, {})).not.toBe(403);
    expect(await status(api, 'GET', '/stock/adjust/qty', approver)).toBe(403);
    expect(await status(api, 'GET', '/stock/counts', approver)).toBe(403);
    const counter = await loginWith(api, ['count.perform']);
    expect(await status(api, 'GET', '/stock/counts', counter)).toBe(200);
    expect(await status(api, 'GET', `/stock/counts/open-items?storeid=${store()}`, counter)).toBe(200);
    expect(await status(api, 'GET', '/stock/audit', counter)).toBe(403);
  });

  test('RST-4 transfers: dispatching and receiving are separate, so a different person receives @permission', async ({ api }) => {
    const sender = await loginWith(api, ['transfer.request']);
    expect(await status(api, 'GET', '/store-stock-transfers', sender)).toBe(200);
    expect(await status(api, 'PUT', '/store-stock-transfers/999999/receive', sender, {})).toBe(403);
    const receiver = await loginWith(api, ['transfer.receive']);
    expect(await status(api, 'PUT', '/store-stock-transfers/999999/receive', receiver, {})).not.toBe(403);
    expect(await status(api, 'GET', '/store-stock-transfers', receiver)).toBe(403);
    expect(await status(api, 'POST', '/store-stock-transfers', receiver, {})).toBe(403);
  });

  test('RST-5 the owner roles keep every stock action by name, and the Store Head by migration @permission', async ({ api }) => {
    for (const who of [MGR, HEAD]) {
      expect(await status(api, 'GET', '/stock/adjust/qty', who), who).toBe(200);
      expect(await status(api, 'GET', '/stock/audit', who), who).toBe(200);
      expect(await status(api, 'GET', '/stock/counts', who), who).toBe(200);
      expect(await status(api, 'GET', '/store-stock-transfers', who), who).toBe(200);
    }
    // a login with no stock grant at all is still refused
    expect(await status(api, 'GET', '/stock/counts', 'sales1@local.test')).toBe(403);
  });
});
