/**
 * Finance and GST filing carry actions - RAC-1..4 (MENU_AND_PERMISSIONS step E, Accounts).
 * finance: bank.import, reconcile, records; gstfiling: prepare, export, lock, unlock. A role holding the page only (view) can read and change nothing;
 * a role holding one action can do that and nothing else; the owner roles hold them all by name.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only this page with these actions, and a login with it */
async function loginWith(api: any, resource: 'finance' | 'gstfiling', actions: string[]) {
  const path = resource === 'finance' ? '/secure/finance' : '/secure/gst-filing';
  const block = { resource, path: [path], policies: actions.map((action) => ({ action })) };
  const role = await api.request('POST', '/roles', { name: `QA Acc ${stamp()}`, permissions: [block], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rac.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RAC', email, password: PASS, phone: '9000000013', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}

const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Accounts actions @p1', () => {
  test('RAC-1 finance: the page alone reads, and each change needs its own action @permission', async ({ api }) => {
    const viewer = await loginWith(api, 'finance', ['view']);
    expect(await status(api, 'GET', '/finance/accounts', viewer)).toBe(200);
    expect(await status(api, 'GET', '/finance/rules', viewer)).toBe(200);
    expect(await status(api, 'POST', '/finance/accounts', viewer, {})).toBe(403);                    // bank.import
    expect(await status(api, 'PUT', '/finance/lines/999999', viewer, {})).toBe(403);                 // reconcile
    expect(await status(api, 'POST', '/finance/reconcile/signoff', viewer, {})).toBe(403);
    expect(await status(api, 'POST', '/finance/reconcile/reopen', viewer, {})).toBe(403);
    expect(await status(api, 'GET', '/finance/records', viewer)).toBe(403);                          // records
    expect(await status(api, 'POST', '/finance/records/attest', viewer, {})).toBe(403);
  });

  test('RAC-2 finance: bank.import, reconcile and records are separate @permission', async ({ api }) => {
    const importer = await loginWith(api, 'finance', ['view', 'bank.import']);
    expect(await status(api, 'POST', '/finance/accounts', importer, {})).not.toBe(403);              // allowed to try; an empty account is a 400
    expect(await status(api, 'PUT', '/finance/lines/999999', importer, {})).toBe(403);
    const reconciler = await loginWith(api, 'finance', ['view', 'reconcile']);
    expect(await status(api, 'PUT', '/finance/lines/999999', reconciler, {})).not.toBe(403);
    expect(await status(api, 'POST', '/finance/accounts', reconciler, {})).toBe(403);
    const keeper = await loginWith(api, 'finance', ['view', 'records']);
    expect(await status(api, 'GET', '/finance/records', keeper)).toBe(200);
    expect(await status(api, 'PUT', '/finance/lines/999999', keeper, {})).toBe(403);
  });

  test('RAC-3 GST filing: viewing, preparing, exporting, closing and reopening a month are separate @permission', async ({ api }) => {
    const viewer = await loginWith(api, 'gstfiling', ['view']);
    expect(await status(api, 'GET', '/gst/rate-changes', viewer)).toBe(200);
    expect(await status(api, 'GET', '/gst/months', viewer)).toBe(200);
    expect(await status(api, 'POST', '/gst/rate-changes/preview', viewer, {})).toBe(403);            // prepare
    expect(await status(api, 'PUT', '/gst/supply-kinds', viewer, {})).toBe(403);
    expect(await status(api, 'PUT', '/gst/registration', viewer, {})).toBe(403);
    expect(await status(api, 'GET', '/gst/sales-register/xlsx?month=2026-09', viewer)).toBe(403);    // export
    expect(await status(api, 'GET', '/gst/pack?month=2026-09', viewer)).toBe(403);
    expect(await status(api, 'POST', '/gst/months/2099-12/close', viewer, {})).toBe(403);            // lock
    expect(await status(api, 'POST', '/gst/months/2099-12/reopen', viewer, {})).toBe(403);           // unlock
    const preparer = await loginWith(api, 'gstfiling', ['view', 'prepare']);
    expect(await status(api, 'POST', '/gst/rate-changes/preview', preparer, {})).not.toBe(403);
    expect(await status(api, 'GET', '/gst/pack?month=2026-09', preparer)).toBe(403);
    const exporter = await loginWith(api, 'gstfiling', ['view', 'export']);
    expect(await status(api, 'GET', '/gst/pack?month=2026-09', exporter)).not.toBe(403);
    const locker = await loginWith(api, 'gstfiling', ['view', 'lock']);
    expect(await status(api, 'POST', '/gst/months/2099-12/close', locker, {})).not.toBe(403);
    expect(await status(api, 'POST', '/gst/months/2099-12/reopen', locker, {})).toBe(403);           // locking is not unlocking
    const unlocker = await loginWith(api, 'gstfiling', ['view', 'unlock']);
    expect(await status(api, 'POST', '/gst/months/2099-12/reopen', unlocker, {})).not.toBe(403);
    expect(await status(api, 'POST', '/gst/months/2099-12/close', unlocker, {})).toBe(403);
  });

  test('RAC-4 the owner roles keep every action by name, and the Store Head holds neither page @permission', async ({ api }) => {
    expect(await status(api, 'GET', '/finance/accounts', MGR)).toBe(200);
    expect(await status(api, 'GET', '/finance/records', MGR)).toBe(200);
    expect(await status(api, 'GET', '/gst/months', MGR)).toBe(200);
    expect(await status(api, 'GET', '/finance/accounts', HEAD)).toBe(403);
    expect(await status(api, 'GET', '/gst/months', HEAD)).toBe(403);
  });
});
