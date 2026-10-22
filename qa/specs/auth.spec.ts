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

  test('AUTH-13 platform admins and business users have separate sign-in pages @permission', async ({ api, app, browser }) => {
    const login = (email: string, scope?: string) => api.request('POST', '/auth/login', { email, password: PASS, ...(scope ? { scope } : {}) });
    // the API: each kind of user is accepted on its own page only, and refused alike on the other
    expect((await login('siteadmin@local.test', 'platform')).status).toBeLessThan(300);
    expect((await login('siteadmin@local.test', 'business')).status).toBe(401);
    expect((await login('siteadmin@local.test')).status).toBe(401);
    expect((await login(USER, 'business')).status).toBeLessThan(300);
    expect((await login(USER)).status).toBeLessThan(300);
    expect((await login(USER, 'platform')).status).toBe(401);
    expect((await login('siteadmin@local.test', 'nonsense')).status).toBe(401);   // anything but platform counts as the business page

    // the platform page looks different and says what it is
    const ctx = await browser.newContext();
    const plat = await ctx.newPage();
    await plat.goto('/platform/login');
    await expect(plat.getByTestId('login-platform-banner')).toBeVisible();
    await plat.getByTestId('login-email').fill(USER);
    await plat.getByTestId('login-password').fill(PASS);
    await plat.getByTestId('login-submit').click();
    await expect(plat.getByTestId('login-error')).toBeVisible();   // a business user is turned away here
    await expect(plat).toHaveURL(/\/platform\/login/);

    const biz = await ctx.newPage();
    await biz.goto('/login');
    await expect(biz.getByTestId('login-platform-banner')).toHaveCount(0);
    await biz.getByTestId('login-email').fill('siteadmin@local.test');
    await biz.getByTestId('login-password').fill(PASS);
    await biz.getByTestId('login-submit').click();
    await expect(biz.getByTestId('login-error')).toBeVisible();     // and the platform admin here
    await ctx.close();

    // signed in on the platform page: badge shown, and signing out returns to the platform page
    const page = await app.loginUI('siteadmin@local.test', PASS);
    await expect(page).toHaveURL(/\/secure\/dashboard/);
    await expect(page.getByTestId('platform-badge')).toBeVisible();
    await page.getByTestId('user-menu').click();
    await page.getByTestId('user-menu-logout').click();
    await expect(page).toHaveURL(/\/platform\/login/);
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

  test('AUTH-14 sign in and change password are the same frame, fields and look, for business and platform @happy', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
    const card = async () => (await page.locator('.auth-card').boundingBox())!;

    await page.goto('/login');
    await expect(page.getByTestId('auth-brand')).toContainText('Ramesh Generic Pharmacy');
    await expect(page.getByTestId('auth-title')).toHaveText('Sign in');
    const loginCard = await card();
    const loginBtn = await box('login-submit');
    const loginField = await box('login-email');
    const loginPwd = await box('login-password');
    // a password can be shown while typing
    await page.getByTestId('login-password').fill('secret');
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
    await page.getByTestId('login-password-toggle').click();
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'text');

    await page.goto('/changepassword');
    await expect(page.getByTestId('auth-brand')).toContainText('Ramesh Generic Pharmacy');
    await expect(page.getByTestId('auth-title')).toHaveText('Change your password');
    expect((await card()).width).toBeCloseTo(loginCard.width, 0);                    // the same card
    expect((await box('cp-submit')).width).toBeCloseTo(loginBtn.width, 0);           // the same button
    expect((await box('cp-email')).width).toBeCloseTo(loginField.width, 0);          // the same field
    expect((await box('cp-current')).height).toBeCloseTo(loginPwd.height, 0);
    for (const id of ['cp-current', 'cp-new', 'cp-confirm']) await expect(page.getByTestId(`${id}-toggle`)).toBeVisible();
    await expect(page.getByText('BootstrapMade')).toHaveCount(0);                      // no template credits
    await expect(page.getByTestId('cp-back')).toHaveAttribute('href', '/login');

    // the platform pages share the dark look, and the change-password link keeps it
    await page.goto('/platform/login');
    await expect(page.getByTestId('login-platform-banner')).toBeVisible();
    await expect(page.getByTestId('auth-title')).toContainText('platform');
    await expect(page.locator('main[data-login-scope=platform]')).toHaveCount(1);
    expect(await page.getByTestId('login-changepw-link').getAttribute('href')).toContain('scope=platform');
    await page.getByTestId('login-changepw-link').click();
    await expect(page.getByTestId('login-platform-banner')).toBeVisible();
    await expect(page.locator('main[data-login-scope=platform]')).toHaveCount(1);
    await expect(page.getByTestId('cp-back')).toHaveAttribute('href', '/platform/login');
    await ctx.close();
  });

  test('AUTH-15 changing a password: clear messages, the rules, and a success that leads back to sign in @happy', async ({ api, browser }) => {
    // the rules, through the API
    const email = `qa.cp.${Date.now()}@local.test`;
    const made = await api.request('POST', '/users', { fullname: 'QA Pwd', email, password: PASS, phone: '9000007777', location: 'x', roleid: 2, storeids: [1] }, 'businesshead@local.test');
    expect(made.status).toBeLessThan(300);
    const change = (b: any) => api.request('POST', '/auth/changepwd', { email, password: PASS, newpassword: 'newpass123', ...b });
    expect((await change({ password: 'not-my-password' })).status).toBe(401);
    expect((await change({ email: 'nobody@local.test' })).status).toBe(401);                 // the same answer for an unknown user
    expect((await change({ newpassword: 'short' })).status).toBe(400);
    expect((await change({ newpassword: PASS })).status).toBe(400);                          // not the same as the current one

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/changepassword');
    await page.getByTestId('cp-email').fill(email);
    await page.getByTestId('cp-current').fill(PASS);
    await page.getByTestId('cp-new').fill('short');
    await expect(page.getByTestId('cp-new-hint')).toHaveClass(/text-danger/);
    await expect(page.getByTestId('cp-submit')).toBeDisabled();
    await page.getByTestId('cp-new').fill('newpass123');
    await page.getByTestId('cp-confirm').fill('different123');
    await expect(page.getByTestId('cp-mismatch')).toBeVisible();
    await expect(page.getByTestId('cp-submit')).toBeDisabled();

    // a wrong current password says so, in the page
    await page.getByTestId('cp-confirm').fill('newpass123');
    await page.getByTestId('cp-current').fill('wrong-current');
    await expect(page.getByTestId('cp-submit')).toBeEnabled();
    await page.getByTestId('cp-submit').click();
    await expect(page.getByTestId('cp-error')).toContainText('not correct');

    // and the real one succeeds, then leads back to sign in; the new password works, the old one does not
    await page.getByTestId('cp-current').fill(PASS);
    await page.getByTestId('cp-submit').click();
    await expect(page.getByTestId('cp-success')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/, { timeout: 8000 });
    await expect.poll(async () => (await api.request('POST', '/auth/login', { email, password: 'newpass123' })).status, { timeout: 5000 }).not.toBe(401);
    expect((await api.request('POST', '/auth/login', { email, password: PASS })).status).toBe(401);
    await ctx.close();
  });
});
