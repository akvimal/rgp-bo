/**
 * Scope on the grant - RSG-1..4. A policy may carry a scope (store or business) that widens what a screen shows: Expenses, Inquiries, Vendor issues
 * and Digital payments read it on their view action. With no scope written a role sees what the screen always showed it; the owner roles see the business.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const today = () => new Date().toISOString().slice(0, 10);
const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a login assigned to the first store of the business, holding only this view action with the scope written on it (none = as the screen shows) */
async function loginWith(api: any, resource: string, scope?: string) {
  const block = { resource, path: [`/secure/${resource}`], policies: [{ action: 'view', ...(scope ? { scope } : {}) }] };
  const role = await api.request('POST', '/roles', { name: `QA Scp ${stamp()}`, permissions: [block], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rsg.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RSG', email, password: PASS, phone: '9000000017', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return { email, role: role.body };
}

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('Scope on the grant @p1', () => {
  test('RSG-1 expenses: a view grant sees only what the person raised; a store scope adds their stores; a business scope everything @permission', async ({ api }) => {
    const cats = (await api.request('GET', '/expenses/categories', undefined, MGR)).body as any[];
    const cat = cats.find((c: any) => c.name === 'Electricity').id;            // a category either level may use
    const mine = data.storesOf(1)[0].id;
    const elsewhere = data.storesOf(1).find((s) => s.id !== mine)!.id;
    const tag = stamp();
    const raise = async (store: number | null, what: string) => {
      const r = await api.request('POST', '/expenses', { expense_date: today(), store_id: store, category_id: cat, amount: 111, gst_amount: 0, pay_mode: 'BANK', payee: 'QA Scope', description: `${tag} ${what}` }, MGR);
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    };
    await raise(mine, 'at my store'); await raise(elsewhere, 'at another store'); await raise(null, 'business level');
    const seen = async (email: string) => ((await api.request('GET', '/expenses', undefined, email)).body.rows as any[]).filter((r) => String(r.description).startsWith(tag)).map((r) => r.description.slice(tag.length + 1)).sort();

    expect(await seen((await loginWith(api, 'expenses')).email)).toEqual([]);                                                   // as the screen always did: what they raised
    expect(await seen((await loginWith(api, 'expenses', 'store')).email)).toEqual(['at my store']);                              // their stores
    expect(await seen((await loginWith(api, 'expenses', 'business')).email)).toEqual(['at another store', 'at my store', 'business level']);
    expect(await seen(MGR)).toEqual(['at another store', 'at my store', 'business level']);                                     // the owner is unchanged
  });

  test('RSG-2 the scope is stored on the grant and read back; a value that is not a scope is not honoured @permission', async ({ api }) => {
    const { role } = await loginWith(api, 'expenses', 'business');
    const stored = (await api.request('GET', `/roles/${role.id}`, undefined, MGR)).body;
    const policy = (typeof stored.permissions === 'string' ? JSON.parse(stored.permissions) : stored.permissions).find((p: any) => p.resource === 'expenses').policies[0];
    expect(policy.scope).toBe('business');
    // a scope that is not store or business widens nothing
    const odd = await loginWith(api, 'expenses', 'everything');
    const cat = ((await api.request('GET', '/expenses/categories', undefined, MGR)).body as any[]).find((c: any) => c.name === 'Electricity').id;
    const tag = stamp();
    expect((await api.request('POST', '/expenses', { expense_date: today(), store_id: null, category_id: cat, amount: 5, gst_amount: 0, pay_mode: 'BANK', payee: 'QA', description: `${tag} x` }, MGR)).status).toBeLessThan(300);
    const rows = (await api.request('GET', '/expenses', undefined, odd.email)).body.rows as any[];
    expect(rows.filter((r) => String(r.description).startsWith(tag))).toEqual([]);
  });

  test('RSG-3 inquiries: the same scope widens what the list shows @permission', async ({ api }) => {
    const mine = data.storesOf(1)[0].id;
    const elsewhere = data.storesOf(1).find((s) => s.id !== mine)!.id;
    const tag = stamp();
    const raise = async (store: number, what: string) => {
      const r = await api.request('POST', '/inquiries', { store_id: store, details: `${tag} ${what}`, due_on: days(3) }, MGR);
      expect(r.status).toBeLessThan(300);
    };
    await raise(mine, 'at my store'); await raise(elsewhere, 'at another store');
    const seen = async (email: string) => ((await api.request('GET', '/inquiries', undefined, email)).body as any[]).filter((r) => String(r.details).startsWith(tag)).map((r) => r.details.slice(tag.length + 1)).sort();
    expect(await seen((await loginWith(api, 'inquiries')).email)).toEqual([]);
    expect(await seen((await loginWith(api, 'inquiries', 'store')).email)).toEqual(['at my store']);
    expect(await seen((await loginWith(api, 'inquiries', 'business')).email)).toEqual(['at another store', 'at my store']);
  });

  test('RSG-4 the Store Head still sees only their stores, and a role that carries no scope is unchanged @permission', async ({ api }) => {
    const cat = ((await api.request('GET', '/expenses/categories', undefined, MGR)).body as any[]).find((c: any) => c.name === 'Electricity').id;
    const headStores = (await api.request('GET', '/expenses/policy', undefined, HEAD)).body.stores.map((s: any) => s.id) as number[];
    const outside = data.storesOf(1).find((s) => !headStores.includes(s.id));
    const tag = stamp();
    const raise = async (store: number, what: string) => expect((await api.request('POST', '/expenses', { expense_date: today(), store_id: store, category_id: cat, amount: 7, gst_amount: 0, pay_mode: 'BANK', payee: 'QA', description: `${tag} ${what}` }, MGR)).status).toBeLessThan(300);
    await raise(headStores[0], 'inside');
    if (outside) await raise(outside.id, 'outside');
    const seen = ((await api.request('GET', '/expenses', undefined, HEAD)).body.rows as any[]).filter((r) => String(r.description).startsWith(tag)).map((r) => r.description.slice(tag.length + 1));
    expect(seen).toContain('inside');
    expect(seen).not.toContain('outside');
    expect((await api.request('GET', '/payment-recon', undefined, HEAD)).status).toBe(200);
  });
  test('RSG-5 the role editor offers a scope on the view of the four screens, and saves it on the grant @happy', async ({ app, api }) => {
    const name = `QA Scp UI ${stamp()}`;
    const { page } = await app.open(MGR, '/secure/settings/roles/new');
    await page.getByTestId('role-f-name').fill(name);
    await page.getByTestId('role-f-res-expenses').check();
    await page.getByTestId('role-f-act-expenses-view').check();
    // the scope choice appears on the view action of Expenses, and not on an action that is not scoped
    await expect(page.getByTestId('role-f-scope-expenses-view')).toBeVisible();
    await expect(page.getByTestId('role-f-scope-expenses-add')).toHaveCount(0);
    await page.getByTestId('role-f-scope-expenses-view').selectOption('business');
    await page.getByTestId('role-f-submit').click();
    await page.waitForURL(/settings\/roles\/list/);
    const saved = ((await api.request('GET', '/roles', undefined, MGR)).body as any[]).find((r) => r.name === name);
    expect(saved, 'the role was saved').toBeTruthy();
    madeRoles.push(saved.id);
    const perms = typeof saved.permissions === 'string' ? JSON.parse(saved.permissions) : saved.permissions;
    expect(perms.find((p: any) => p.resource === 'expenses').policies.find((p: any) => p.action === 'view').scope).toBe('business');
  });
});
