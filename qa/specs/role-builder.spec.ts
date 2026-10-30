/**
 * Owner-built roles and managers who manage their own stores' staff - RB-1..5
 * An owner creates ready-made roles (Purchase Staff, Accountant) and gives them to staff; nobody can build or hand out a role that
 * allows more than they can do themselves; a Store Head adds and edits the staff of their own stores and nobody else.
 */
import { test, expect, data } from '../fixtures/index.js';
import { apiLogin } from '../fixtures/auth.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const SALES = 'sales1@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const made: number[] = [];

const roles = async (api: any) => (await api.request('GET', '/roles', undefined, MGR)).body as any[];
const roleId = async (api: any, name: string) => (await roles(api)).find((r) => r.name === name)?.id as number;
const resources = (role: any) => (role.permissions || []).map((p: any) => p.resource);
async function newUser(api: any, as: string, roleid: number, storeids: number[], email = `qa.rb.${stamp()}@local.test`) {
  const res = await api.request('POST', '/users', { fullname: 'QA RB', email, password: PASS, phone: '9000000008', location: 'x', roleid, storeids }, as);
  if (res.status < 300) made.push(res.body.id);
  return { res, email };
}

test.afterEach(async ({ api }) => {
  for (const id of made.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
});
test.afterAll(async ({ api }) => {
  for (const name of ['Purchase Staff', 'Accountant']) {
    const id = await roleId(api, name);
    if (id) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
  }
});

test('RB-1 the owner creates the suggested roles in one click, and they hold no sales or the other side rights', async ({ api }) => {
  const offered = (await api.request('GET', '/roles/templates', undefined, MGR)).body as any[];
  expect(offered.map((t) => t.name).every((n) => ['Purchase Staff', 'Accountant'].includes(n))).toBe(true);
  expect((await api.request('POST', '/roles/templates', { names: ['Purchase Staff', 'Accountant'] }, MGR)).status).toBeLessThan(300);
  const all = await roles(api);
  const purchase = all.find((r) => r.name === 'Purchase Staff');
  const accounts = all.find((r) => r.name === 'Accountant');
  expect(resources(purchase)).toContain('purchases');
  expect(resources(purchase)).not.toContain('sales');
  expect(resources(purchase)).not.toContain('finance');
  expect(resources(accounts)).toContain('finance');
  expect(resources(accounts)).not.toContain('sales');
  expect(resources(accounts)).not.toContain('purchases');
  // created once: offered again no more, and asking twice makes no second one
  expect(((await api.request('GET', '/roles/templates', undefined, MGR)).body as any[]).length).toBe(0);
  expect((await api.request('POST', '/roles/templates', { names: ['Purchase Staff'] }, MGR)).body.created).toEqual([]);
  expect((await api.request('POST', '/roles/templates', { names: ['Nope'] }, MGR)).status).toBe(400);
});

test('RB-2 a login can be given an owner-built role, and then holds exactly that role', async ({ api }) => {
  await api.request('POST', '/roles/templates', { names: ['Purchase Staff'] }, MGR);
  const rid = await roleId(api, 'Purchase Staff');
  const { res, email } = await newUser(api, MGR, rid, [data.storesOf(1)[0].id]);
  expect(res.status).toBeLessThan(300);
  const { me } = await apiLogin(email, PASS);
  const mine = (me.permissions || []).map((p: any) => p.resource);
  expect(mine).toContain('purchases');
  expect(mine).not.toContain('sales');
  expect(mine).not.toContain('finance');
  // the owner roles stay with the platform admin
  const head = await roleId(api, 'Business Head');
  expect((await newUser(api, MGR, head, [])).res.status).toBe(403);
});

test('RB-3 nobody builds a role that allows more than they can do, and only those who may change roles can', async ({ api }) => {
  const finance = [{ resource: 'finance', path: '/secure/finance', policies: [{ action: 'view', properties: [] }] }];
  const name = `QA Over ${stamp()}`;
  expect((await api.request('POST', '/roles', { name, permissions: finance, locked: false }, SALES)).status).toBe(403);   // no right on roles at all
  expect((await api.request('POST', '/roles', { name, permissions: finance, locked: false }, HEAD)).status).toBe(403);    // the store head lacks finance
  const platform = [{ resource: 'businesses', policies: [{ action: 'manage' }] }];
  expect((await api.request('POST', '/roles', { name, permissions: platform, locked: false }, MGR)).status).toBe(403);   // only the platform holds it
  const ok = await api.request('POST', '/roles', { name, permissions: finance, locked: false }, MGR);
  expect(ok.status).toBeLessThan(300);
  expect((await api.request('DELETE', `/roles/${ok.body.id}`, undefined, SALES)).status).toBe(403);
  expect((await api.request('PUT', `/roles/${await roleId(api, 'Business Head')}`, { name: 'Business Head', permissions: finance }, MGR)).status).toBe(403);
  expect((await api.request('DELETE', `/roles/${ok.body.id}`, undefined, MGR)).status).toBeLessThan(300);
});

test('RB-4 a store head adds and edits staff of their own stores, never a manager or owner, and only gives roles they may', async ({ api }) => {
  const mine = ((await api.request('GET', '/users/my-stores', undefined, HEAD)).body as any[]).map((s) => s.id);
  expect(mine.length).toBeGreaterThan(0);
  const sales = await roleId(api, 'Sales Staff');
  const created = await newUser(api, HEAD, sales, [mine[0]]);
  expect(created.res.status).toBeLessThan(300);
  const id = created.res.body.id;

  // no manager or owner role, and not without a store
  expect((await newUser(api, HEAD, await roleId(api, 'Store Head'), [mine[0]])).res.status).toBe(403);
  expect((await newUser(api, HEAD, await roleId(api, 'Business Head'), [mine[0]])).res.status).toBe(403);
  expect((await newUser(api, HEAD, sales, [])).res.status).toBe(400);
  // a store they do not work in
  const other = (data.storesOf(1) as any[]).map((s) => s.id).find((s) => !mine.includes(s));
  if (other) expect((await newUser(api, HEAD, sales, [other])).res.status).toBe(403);

  // edit the new person: name, but not up to a manager role
  expect((await api.request('PUT', `/users/${id}`, { fullname: 'QA RB Edited' }, HEAD)).status).toBeLessThan(300);
  expect((await api.request('PUT', `/users/${id}`, { roleid: await roleId(api, 'Store Head') }, HEAD)).status).toBe(403);
  // not the owner, or themselves
  const me = (await api.request('GET', '/auth/me', undefined, HEAD)).body;
  const owner = (await api.request('GET', '/auth/me', undefined, MGR)).body;
  expect((await api.request('PUT', `/users/${owner.id}`, { fullname: 'x' }, HEAD)).status).toBe(403);
  expect((await api.request('PUT', `/users/${me.id}`, { fullname: 'x' }, HEAD)).status).toBe(403);
  expect((await api.request('DELETE', `/users/${owner.id}`, undefined, HEAD)).status).toBe(403);
  // removing a staff member of their store works
  expect((await api.request('DELETE', `/users/${id}`, undefined, HEAD)).status).toBeLessThan(300);
});

test('RB-5 a store head cannot reach staff of a store they do not work in, and others cannot manage staff at all', async ({ api }) => {
  const mine = ((await api.request('GET', '/users/my-stores', undefined, HEAD)).body as any[]).map((s) => s.id);
  const other = (data.storesOf(1) as any[]).map((s) => s.id).find((s) => !mine.includes(s));
  const sales = await roleId(api, 'Sales Staff');
  if (other) {
    const far = await newUser(api, MGR, sales, [other]);
    expect(far.res.status).toBeLessThan(300);
    expect((await api.request('PUT', `/users/${far.res.body.id}`, { fullname: 'x' }, HEAD)).status).toBe(403);
    expect((await api.request('DELETE', `/users/${far.res.body.id}`, undefined, HEAD)).status).toBe(403);
    expect((await api.request('PUT', `/users/${far.res.body.id}/stores`, { storeids: [mine[0]] }, HEAD)).status).toBe(403);
  }
  // sales staff hold no right on users
  expect((await newUser(api, SALES, sales, [mine[0]])).res.status).toBe(403);
});

test('RB-6 the Users screen opens for a store head with only their stores and the lower roles, and the Roles screen offers the suggested roles to the owner', async ({ app, api }) => {
  const mine = ((await api.request('GET', '/users/my-stores', undefined, HEAD)).body as any[]);
  const { page } = await app.open(HEAD, '/secure/settings/users/new');
  await expect(page.getByTestId('user-f-manager-note')).toBeVisible();
  const options = await page.getByTestId('user-f-role').locator('option').allTextContents();
  expect(options.join('|')).not.toMatch(/Store Head|Business Head|Owner-operator|Site Admin/);
  expect(options.join('|')).toContain('Sales Staff');
  await expect(page.locator('[data-testid^="user-f-store-"]')).toHaveCount(mine.length);

  await api.request('DELETE', `/roles/${await roleId(api, 'Accountant')}`, undefined, MGR);
  const owner = await app.open(MGR, '/secure/settings/roles/list');
  await expect(owner.page.getByTestId('role-templates')).toBeVisible();
  await expect(owner.page.getByTestId('role-template-add-Accountant')).toBeVisible();
});
