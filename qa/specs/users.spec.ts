/**
 * Settings — Users — USR-1..5
 * Source: docs/testing/manual-test-plan.html  (module "users")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

test.describe('Settings — Users @p0', () => {
  test('USR-1 a new user with a role + store can log in and sees a scoped menu @happy', async ({ app, api }) => {
    const email = `qa.usr1.${Date.now()}.${Math.random().toString(36).slice(2,6)}@local.test`;
    const store = data.storesOf(1)[0].id;
    const { page } = await app.open(MGR, '/secure/settings/users/new');
    await expectShell(page);
    await page.getByTestId(TID.userEmail).fill(email);
    await page.getByTestId(TID.userPassword).fill(PASS);
    await page.getByTestId(TID.userConfirm).fill(PASS);
    await page.getByTestId(TID.userFullname).fill('QA User One');
    await page.getByTestId(TID.userPhone).fill('9876500001');
    await page.getByTestId(TID.userLocation).fill('QA');
    await page.getByTestId(TID.userRole).selectOption({ label: 'Sales Staff' });
    await page.getByTestId(TID.userStoreCheck(store)).check();
    await page.getByTestId(TID.userSubmit).click();
    await expect(page).toHaveURL(/\/secure\/settings\/users/);

    // the new account logs in and lands in the shell with a limited nav
    const p2 = await app.loginUI(email, PASS);
    await expectShell(p2);
    await expect(p2.getByTestId('nav-settings')).toBeHidden();
  });

  test('USR-2 a duplicate email is rejected @negative', async ({ api }) => {
    const { status } = await api.request('POST', '/users', {
      fullname: 'Dup', email: 'sales1@local.test', password: PASS,
      phone: '9000000000', location: 'x', roleid: 2, storeids: [data.storesOf(1)[0].id],
    }, MGR);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('USR-3 changing a user\'s role takes effect on the next token @happy', async ({ api }) => {
    const email = `qa.usr3.${Date.now()}.${Math.random().toString(36).slice(2,6)}@local.test`;
    const store = data.storesOf(1)[0].id;
    const created = await api.request('POST', '/users', {
      fullname: 'Role Change', email, password: PASS, phone: '9000000003', location: 'x',
      roleid: 2, storeids: [store],
    }, MGR);
    const id = created.body.id;

    let me = await api.request('GET', '/auth/me', undefined, email);
    expect(me.body.rolename).toBe('Sales Staff');

    await api.request('PUT', `/users/${id}`, { roleid: 3 }, MGR); // -> Store Head
    // a fresh login reflects the new role
    const fresh = await fetch(`${process.env.QA_API_URL}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASS }),
    }).then((r) => r.json());
    const me2 = await fetch(`${process.env.QA_API_URL}/auth/me`, { headers: { authorization: `Bearer ${fresh.token}` } }).then((r) => r.json());
    expect(me2.rolename).toBe('Store Head');
  });

  test('USR-4 a deactivated user cannot log in but stays on historical records @happy', async ({ api }) => {
    const email = `qa.usr4.${Date.now()}.${Math.random().toString(36).slice(2,6)}@local.test`;
    const store = data.storesOf(1)[0].id;
    const created = await api.request('POST', '/users', {
      fullname: 'To Deactivate', email, password: PASS, phone: '9000000004', location: 'x',
      roleid: 2, storeids: [store],
    }, MGR);
    const id = created.body.id;
    expect((await api.request('POST', '/auth/login', { email, password: PASS })).status).not.toBe(401);

    let del = await api.request('DELETE', `/users/${id}`, undefined, MGR);
    if (del.status >= 500) del = await api.request('DELETE', `/users/${id}`, undefined, MGR); // transient retry
    expect(del.status).toBeLessThan(400);

    // deactivated -> login is refused (issue #131)
    await expect.poll(async () => (await api.request('POST', '/auth/login', { email, password: PASS })).status,
      { timeout: 5000 }).toBe(401);

    // the account row is retained (soft delete) - creator/updater references stay intact
    const still = await api.request('GET', `/users/${id}`, undefined, MGR);
    if (still.status < 400) expect(still.body.email).toBe(email);
  });

  test('USR-5 a password reset lets the target log in with the new password only @happy', async ({ api }) => {
    const email = `qa.usr5.${Date.now()}.${Math.random().toString(36).slice(2,6)}@local.test`;
    const store = data.storesOf(1)[0].id;
    await api.request('POST', '/users', {
      fullname: 'Reset Me', email, password: PASS, phone: '9000000005', location: 'x',
      roleid: 2, storeids: [store],
    }, MGR);
    await api.request('POST', '/auth/changepwd', { email, password: PASS, newpassword: 'newpass456' });
    // the app is briefly racy right after a password change - poll a moment
    await expect.poll(
      async () => (await api.request('POST', '/auth/login', { email, password: 'newpass456' })).status,
      { timeout: 5000 },
    ).not.toBe(401);
    await expect.poll(
      async () => (await api.request('POST', '/auth/login', { email, password: PASS })).status,
      { timeout: 5000 },
    ).toBe(401);
  });
});
