/**
 * Authentication & Session — AUTH-1..12
 * Source: docs/testing/manual-test-plan.html  (module "auth")
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell, expectOnLogin, sessionToken } from '../support/assert.js';

const USER = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

test.describe('Authentication & Session @p0', () => {
  test('AUTH-1 valid credentials land in the shell with a scoped nav @happy', async ({ app }) => {
    const page = await app.loginUI(USER, PASS);
    await expectShell(page);
    await expect(page).toHaveURL(/\/secure\//);
    expect(await sessionToken(page)).toBeTruthy();
    // nav is permission-scoped: Business Head sees Store + Settings, not nothing
    await expect(page.getByTestId('nav-store')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();
  });

  test('AUTH-2 wrong password is rejected generically @negative', async ({ app }) => {
    const page = await app.loginUI(USER, 'definitely-wrong');
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionToken(page)).toBeFalsy();
  });

  test('AUTH-3 unknown username gives the same generic error @negative', async ({ app }) => {
    const page = await app.loginUI('nobody-here@local.test', PASS);
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionToken(page)).toBeFalsy();
  });

  test('AUTH-4 direct secured URL while logged out redirects to /login @permission', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/secure/store/cash');
    await expectOnLogin(page);
    await ctx.close();
  });

  test('AUTH-5 an expired token drops the user back to login @edge', async ({ app }) => {
    const { page } = await app.open(USER, '/secure/dashboard');
    await expectShell(page);
    // a well-formed JWT whose exp is in the past -> auth-token.interceptor clears + redirects
    await page.evaluate(() => {
      const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
      const expired = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 1, email: 'x', roleid: 1, exp: 1600000000 })}.sig`;
      sessionStorage.setItem('token', expired);
    });
    await page.getByTestId('nav-store').click();
    await expectOnLogin(page);
  });

  test('AUTH-6 POST /auth/refresh renews the session token @integration', async ({ api }) => {
    const { status, body } = await api.request('POST', '/auth/refresh', {}, USER);
    expect([200, 201]).toContain(status);
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.')).toHaveLength(3);
  });

  test('AUTH-7 password change round-trips via /auth/changepwd @happy', async ({ api }) => {
    // UI note: /changepassword exists but nothing links to it (verified in AUTH-12b).
    const u = 'role.readonly@qa.local';
    const a = await api.request('POST', '/auth/changepwd', { email: u, password: PASS, newpassword: 'admin123X' });
    expect([200, 201]).toContain(a.status);
    await expect.poll(async () => (await api.request('POST', '/auth/login', { email: u, password: 'admin123X' })).status,
      { timeout: 5000 }).not.toBe(401);
    await expect.poll(async () => (await api.request('POST', '/auth/login', { email: u, password: PASS })).status,
      { timeout: 5000 }).toBe(401);
    // revert so the persona keeps working for other specs
    await api.request('POST', '/auth/changepwd', { email: u, password: 'admin123X', newpassword: PASS });
    await expect.poll(async () => (await api.request('POST', '/auth/login', { email: u, password: PASS })).status,
      { timeout: 5000 }).not.toBe(401);
  });

  test('AUTH-8 wrong current password is rejected by /auth/changepwd @negative', async ({ api }) => {
    const { status } = await api.request('POST', '/auth/changepwd', {
      email: USER, password: 'wrong-current', newpassword: 'whatever123',
    });
    expect(status).toBeGreaterThanOrEqual(400);
    // old password still works
    const still = await api.request('POST', '/auth/login', { email: USER, password: PASS });
    expect([200, 201]).toContain(still.status);
  });

  test('AUTH-9 POST /auth/register is gone (was a privilege-escalation hole) @permission', async ({ api }) => {
    const { status } = await api.request('POST', '/auth/register', {
      email: 'intruder@x.com', password: 'x', fullname: 'x',
    });
    expect(status).toBe(404);
  });

  test('AUTH-10 logout clears the session and Back does not reveal secured content @happy', async ({ app }) => {
    const page = await app.loginUI(USER, PASS);
    await expectShell(page);
    await page.getByTestId('user-menu').click();
    await page.getByTestId('user-menu-logout').click();
    await expectOnLogin(page);
    expect(await sessionToken(page)).toBeFalsy();
    await page.goBack();
    await expect(page.getByTestId('user-menu')).toBeHidden();
  });

  test('AUTH-11 Site Admin lands on the Dashboard, not Settings @permission', async ({ app }) => {
    const page = await app.loginUI('siteadmin@local.test', PASS);
    await expect(page).toHaveURL(/\/secure\/dashboard/);
  });

  test('AUTH-12 opening the Settings hub does not bounce to /login @permission', async ({ app }) => {
    const { page } = await app.open(USER, '/secure/dashboard');
    await expectShell(page);
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('nav-settings-users').click();
    await expect(page).toHaveURL(/\/secure\/settings\/users/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('AUTH-7/8b the change-password screen is reachable @edge', async ({ browser }) => {
    // issue #141: the route now resolves and the login page links to it.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/login');
    await expect(page.getByTestId('login-changepw-link')).toBeVisible();
    await page.goto('/changepassword');
    await expect(page.getByTestId('cp-submit')).toBeVisible();
    await expect(page.getByTestId('cp-email')).toBeVisible();
    await ctx.close();
  });
});
