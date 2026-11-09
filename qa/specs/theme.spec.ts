/**
 * The light / dark theme switch — THM-1..3.
 * The user-menu choice (Light / Dark / Auto) changes the theme, the choice is remembered for the person, and the login page stays light. There is no theme button in the header.
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
  test('THM-1 the user menu switches to dark and back, and PrimeNG follows, and the header has no theme button', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/dashboard');
    await expectShell(page);
    await page.evaluate(() => { localStorage.removeItem('rgp_theme:last'); });
    await menu(page);
    await page.getByTestId('theme-light').click();
    expect(await theme(page)).toBe('light');
    const light = await bodyBg(page);
    await expect(page.getByTestId('header-theme')).toHaveCount(0);
    await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
    await page.getByTestId('theme-dark').click();
    await expect.poll(() => theme(page)).toBe('dark');
    await expect(page.locator('#prime-dark-theme')).toHaveCount(1);
    expect(await bodyBg(page)).not.toBe(light);
    await page.getByTestId('theme-light').click();
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
  test('THM-4 in dark the POS boxes and the bottom bar are dark, and badges are bright with dark text', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/sales/pos');
    await menu(page);
    await page.getByTestId('theme-dark').click();
    await expect.poll(() => theme(page)).toBe('dark');
    const lum = (css: string) => { const m = css.match(/\d+/g)!.map(Number); return (m[0] + m[1] + m[2]) / 3; };
    const search = page.getByRole('searchbox', { name: 'Name / Composition' });
    await expect(search).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => lum(await search.evaluate((e: any) => getComputedStyle(e).backgroundColor)), { message: 'product box is dark' }).toBeLessThan(60);
    await expect.poll(async () => lum(await page.locator('.sale-actions').first().evaluate((e: any) => getComputedStyle(e).backgroundColor)), { message: 'bottom bar is dark' }).toBeLessThan(60);
    // a badge: build one in the page so the check does not depend on data
    const [fill, ink] = await page.evaluate(() => {
      const b = document.createElement('span'); b.className = 'badge bg-success'; b.textContent = 'x'; document.body.appendChild(b);
      const cs = getComputedStyle(b); const out = [cs.backgroundColor, cs.color]; b.remove(); return out;
    });
    expect(lum(fill)).toBeGreaterThan(120);
    expect(lum(ink)).toBeLessThan(80);
    await page.getByTestId('theme-light').click();
  });
});
