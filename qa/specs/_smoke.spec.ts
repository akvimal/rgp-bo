import { test, expect, data } from '../fixtures/index.js';
import { expectShell, expectOnLogin, sessionToken } from '../support/assert.js';

test.describe('@smoke', () => {
  test('seed manifest present', async () => {
    expect(data.m.businesses.length).toBeGreaterThanOrEqual(2);
    expect(data.m.stores.length).toBeGreaterThanOrEqual(3);
    expect(data.m.sales.length).toBeGreaterThan(50);
  });

  test('UI login works and lands in the shell', async ({ app }) => {
    const page = await app.loginUI('businesshead@local.test');
    await expectShell(page);
    expect(await sessionToken(page)).toBeTruthy();
  });

  test('auth injection opens a secured page directly', async ({ app }) => {
    const { page } = await app.open('businesshead@local.test', '/secure/store/cash');
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'Cash', exact: true })).toBeVisible();
  });

  test('logged-out visit to a secured URL bounces to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/secure/dashboard');
    await expectOnLogin(page);
    await ctx.close();
  });
});
