/**
 * The standard action cell and collapsible sections - RA-UI-1..2
 * Every row has view and edit as icons and the rest in a "more" menu with the destructive one last; collapsible sections open and close from their header
 * and show a count. (docs/planning/UI_PATTERNS.md section 3)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

test('RA-UI-1 a vendor row has view and edit icons and a more menu with the destructive action last', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/purchases/vendors/list');
  const rows = page.getByTestId('vendor-row');
  test.skip((await rows.count()) === 0, 'no vendors in this data set');
  const row = rows.first();
  await expect(row.getByTestId('vendor-view')).toBeVisible();
  await expect(row.getByTestId('vendor-edit')).toBeVisible();
  await row.getByTestId('vendor-more').click();
  const menu = row.getByTestId('vendor-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('a').last()).toHaveAttribute('data-testid', /vendor-(disable|enable)/);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('RA-UI-2 a section on the weekly review opens and closes from its header', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/review');
  const toggle = page.getByTestId('review-list-returns-toggle');
  test.skip((await toggle.count()) === 0, 'the review is not shown for this data set');
  const before = await toggle.getAttribute('aria-expanded');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
});
