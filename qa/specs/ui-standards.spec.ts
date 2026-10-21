/**
 * UI standard — UI-1..3
 * One brand colour, one font, one tab style, one page title style, one date format. These guard the look
 * (frontend/src/theme.css) so a later change cannot quietly bring back a second blue or a second font.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const BRAND = 'rgb(65, 84, 241)';

const style = (page: any, selector: string, prop: string) =>
  page.locator(selector).first().evaluate((el: Element, p: string) => getComputedStyle(el).getPropertyValue(p), prop);

test.describe('UI standard @p2', () => {
  test('UI-1 the brand colour, font and page title are the same on every kind of page @happy', async ({ app }) => {
    for (const path of ['/secure/customers/cust/list', '/secure/customers/cust/new', '/secure/products/master/list', '/secure/purchases/invoices/list', '/secure/settings/users']) {
      const { page } = await app.open(MGR, path);
      await expectShell(page);
      await expect(page.locator('#main h1').first()).toBeVisible();
      expect(await style(page, '#main h1', 'font-size'), `${path} title size`).toBe('24px');
      expect((await style(page, '#main h1', 'font-family')).toLowerCase(), `${path} title font`).toContain('nunito');
      expect((await style(page, 'body', 'font-family')).toLowerCase(), `${path} body font`).toContain('nunito');
      expect(await style(page, '.btn-primary', 'background-color'), `${path} primary button`).toBe(BRAND);
    }
  });

  test('UI-2 every tab bar is the underlined style, and the page says where you are @happy', async ({ app }) => {
    for (const [path, active] of [['/secure/purchases/invoices/list', 'Invoices'], ['/secure/products/master/list', 'Master'], ['/secure/sales/pos/new', 'POS'], ['/secure/store/cash', 'Cash']] as const) {
      const { page } = await app.open(MGR, path);
      await expectShell(page);
      const tab = page.locator('.navbar .nav-link.is-active, .navbar .nav-item.is-active > .nav-link').filter({ hasText: active }).first();
      await expect(tab, `${path} active tab`).toBeVisible();
      expect(await tab.evaluate((el: Element) => getComputedStyle(el).borderBottomColor), `${path} tab underline`).toBe(BRAND);
      expect(await tab.evaluate((el: Element) => getComputedStyle(el).backgroundColor), `${path} tab fill`).toBe('rgba(0, 0, 0, 0)');
      expect(await page.locator('nav.navbar').first().evaluate((el: Element) => getComputedStyle(el).backgroundColor), `${path} bar fill`).toBe('rgba(0, 0, 0, 0)');
    }
    const users = await app.open(MGR, '/secure/settings/users');
    await expect(users.page.locator('#main h1').first()).toHaveText('Settings · Users');
    const roles = await app.open(MGR, '/secure/settings/roles');
    await expect(roles.page.locator('#main h1').first()).toHaveText('Settings · Roles');
  });

  test('UI-3 dates read the same everywhere and the page loads one Bootstrap @edge', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/customers/cust/list');
    await expectShell(page);
    await expect(page.getByTestId('cust-search')).toBeVisible();
    const lastVisit = await page.locator('tbody tr td').filter({ hasText: /\d{2} [A-Z][a-z]{2} \d{4}/ }).first().innerText();
    expect(lastVisit).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);                       // 21 Oct 2026, never 21/10/26
    expect(await page.locator('link[rel=stylesheet][href*="vendor/bootstrap/css"]').count()).toBe(0);
  });

  test('UI-4 the primary Add button is on the right of every list, and Vendors keeps the Purchase tabs @happy', async ({ app }) => {
    const lists: Array<[string, string]> = [
      ['/secure/customers/cust/list', 'cust-add'],
      ['/secure/products/master/list', 'prod-add'],
      ['/secure/purchases/vendors/list', 'vendor-add'],
      ['/secure/purchases/invoices/list', 'inv-add'],
      ['/secure/settings/users', 'user-add'],
      ['/secure/settings/roles', 'role-add'],
      ['/secure/settings/delivery-partners/list', 'partner-add'],
    ];
    for (const [path, testid] of lists) {
      const { page } = await app.open(MGR, path);
      await expectShell(page);
      const add = page.getByTestId(testid);
      await expect(add, `${path} add button`).toBeVisible();
      const box = await add.boundingBox();
      const main = await page.locator('#main').boundingBox();
      expect(box!.x + box!.width, `${path}: right edge of Add`).toBeGreaterThan(main!.x + main!.width - 60);   // flush to the right margin
      expect(box!.y, `${path}: Add sits near the top`).toBeLessThan(260);
    }
    const vendors = await app.open(MGR, '/secure/purchases/vendors/list');
    await expect(vendors.page.getByTestId('nav-vendors')).toBeVisible();
    await expect(vendors.page.locator('.navbar .nav-link.is-active', { hasText: 'Vendors' })).toBeVisible();
    await expect(vendors.page.getByRole('link', { name: 'Invoices', exact: true })).toBeVisible();      // the other tabs are still there
    const vform = await app.open(MGR, '/secure/purchases/vendors/new');
    await expect(vform.page.locator('.navbar .nav-link.is-active', { hasText: 'Vendors' })).toBeVisible();
  });
});
