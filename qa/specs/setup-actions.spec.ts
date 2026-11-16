/**
 * Setup actions that were the owner roles by name get their own actions - RSU-1..4 (MENU_AND_PERMISSIONS step E, Setup).
 * businessprofile: modules.manage, transfer.export, transfer.import; users: mfareset. The old business-details box opens none of them.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only these blocks, and a login with it */
async function loginWith(api: any, blocks: Array<{ resource: string; path: string; actions: string[] }>) {
  const permissions = blocks.map((b) => ({ resource: b.resource, path: [b.path], policies: b.actions.map((action) => ({ action })) }));
  const role = await api.request('POST', '/roles', { name: `QA Set ${stamp()}`, permissions, locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rsu.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RSU', email, password: PASS, phone: '9000000014', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return { email, id: user.body.id as number };
}
const profile = (...actions: string[]) => ({ resource: 'businessprofile', path: '/secure/settings/business-profile', actions });

const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Setup actions @p1', () => {
  test('RSU-1 the old business-details box opens neither the setup export or import nor the modules @negative', async ({ api }) => {
    const { email } = await loginWith(api, [profile('manage')]);
    expect(await status(api, 'GET', '/config-profile/export', email)).toBe(403);
    expect(await status(api, 'GET', '/config-profile/template.xlsx', email)).toBe(403);
    expect(await status(api, 'POST', '/config-profile/preview', email, {})).toBe(403);
    expect(await status(api, 'POST', '/config-profile/apply', email, {})).toBe(403);
    expect(await status(api, 'GET', '/businesses/mine/modules', email)).toBe(403);
    expect(await status(api, 'PUT', '/businesses/mine/modules', email, {})).toBe(403);
    expect(await status(api, 'GET', '/config-profile/export', MGR)).toBe(200);                        // the owner is unchanged
  });

  test('RSU-2 transfer.export exports and nothing else; transfer.import imports and nothing else @permission', async ({ api }) => {
    const exporter = (await loginWith(api, [profile('transfer.export')])).email;
    expect(await status(api, 'GET', '/config-profile/export', exporter)).toBe(200);
    expect(await status(api, 'GET', '/config-profile/template.xlsx', exporter)).toBe(200);
    expect(await status(api, 'POST', '/config-profile/preview', exporter, {})).toBe(403);
    expect(await status(api, 'POST', '/config-profile/apply', exporter, {})).toBe(403);
    const importer = (await loginWith(api, [profile('transfer.import')])).email;
    expect(await status(api, 'POST', '/config-profile/preview', importer, {})).not.toBe(403);          // allowed to try; an empty setup is a 400
    expect(await status(api, 'GET', '/config-profile/export', importer)).toBe(403);
  });

  test('RSU-3 modules.manage opens the modules and the setup presets, and nothing in the business details @permission', async ({ api }) => {
    const { email } = await loginWith(api, [profile('modules.manage')]);
    expect(await status(api, 'GET', '/businesses/mine/modules', email)).toBe(200);
    expect(await status(api, 'GET', '/businesses/mine/presets', email)).toBe(200);
    expect(await status(api, 'PUT', '/businesses/mine', email, {})).toBe(403);                         // the details stay the owner's
    expect(await status(api, 'GET', '/config-profile/export', email)).toBe(403);
  });

  test('RSU-4 users.mfareset is needed to reset an authenticator, on top of managing that person @permission', async ({ api }) => {
    const target = await loginWith(api, [profile('manage')]);
    // a role that can edit users but holds no mfareset is refused; the owner and the Store Head (given it by migration) are not
    const editor = (await loginWith(api, [{ resource: 'users', path: '/secure/settings/users', actions: ['read', 'edit'] }])).email;
    expect(await status(api, 'POST', `/auth/mfa/reset/${target.id}`, editor, {})).toBe(403);
    const resetter = (await loginWith(api, [{ resource: 'users', path: '/secure/settings/users', actions: ['read', 'edit', 'mfareset'] }])).email;
    expect(await status(api, 'POST', `/auth/mfa/reset/${target.id}`, resetter, {})).not.toBe(403);    // allowed to try; the person may not have one linked
    expect(await status(api, 'POST', `/auth/mfa/reset/${target.id}`, MGR, {})).not.toBe(403);
    expect(await status(api, 'POST', `/auth/mfa/reset/${target.id}`, HEAD, {})).not.toBe(403);
  });
});
