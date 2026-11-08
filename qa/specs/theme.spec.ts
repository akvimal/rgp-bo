/**
 * The light / dark theme switch — THM-1..3.
 * The header button and the user-menu choice change the theme, the choice is remembered for the person, and the login page stays light.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const theme = (page: any) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const bodyBg = (page: any) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** open the user menu unless it is already open (choosing a theme leaves it open so the change can be seen) */
const menu = async (page: any) => { if (!(await page.getByTestId('theme-choice').isVisible())) await page.getByTestId('user-menu').click(); };

test.describe.configure({ mode: 'serial' });

test.describe('Theme switch @p2', () => {
  test('THM-1 the header button switches to dark and back, and PrimeNG follows', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/dashboard');
    await expectShell(page);
    await page.evaluate(() => { localStorage.removeItem('rgp_theme:last'); });
    await menu(page);
    await page.getByTestId('theme-light').click();
    expect(await theme(page)).toBe('light');
    const light = await bodyBg(page);
    await page.getByTestId('theme-toggle').click();
    await expect.poll(() => theme(page)).toBe('dark');
    await expect(page.locator('#prime-dark-theme')).toHaveCount(1);
    expect(await bodyBg(page)).not.toBe(light);
    await page.getByTestId('theme-toggle').click();
    await expect.poll(() => theme(page)).toBe('light');
    await expect(page.locator('#prime-dark-theme')).toHaveCount(0);
  });

  test('THM-2 the choice is remembered after a reload, and Auto follows the device', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/dashboard');
    await menu(page);
    await page.getByTestId('theme-dark').click();
    await page.reload();
    await expectShell(page);
    await expect.poll(() => theme(page)).toBe('dark');
    await menu(page);
    await page.getByTestId('theme-auto').click();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => theme(page)).toBe('light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => theme(page)).toBe('dark');
    await menu(page);
    await page.getByTestId('theme-light').click();                         // leave the person's setting as it was
    await expect.poll(() => theme(page)).toBe('light');
  });

  test('THM-3 the login page stays light even when the app was dark', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/dashboard');
    await menu(page);
    await page.getByTestId('theme-dark').click();
    await expect.poll(() => theme(page)).toBe('dark');
    await page.goto('/login');
    await expect(page.getByTestId('login-email')).toBeVisible();
    expect(await theme(page)).toBeNull();
    await page.evaluate(() => { localStorage.removeItem('rgp_theme:last'); Object.keys(localStorage).filter((k) => k.startsWith('rgp_theme:')).forEach((k) => localStorage.removeItem(k)); });
  });
});
