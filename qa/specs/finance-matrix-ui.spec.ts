/**
 * Money by category on screen - FM-UI-1..2
 * The owner sees the category x month table with sales, running cost and a profit estimate; a Store Head sees sales and costs but no purchases or profit.
 * (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2, phase F3)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('FM-UI-1 the owner sees the table, the profit estimate and can change the period', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/financials');
  const card = page.getByTestId('finance-matrix');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('matrix-tiles')).toContainText('Estimated profit');
  await expect(page.getByTestId('matrix-section-INCOME')).toBeVisible();
  await expect(page.getByTestId('matrix-notes')).toContainText('before GST');
  await page.getByTestId('matrix-compare').selectOption('prev');
  await expect(card.locator('th', { hasText: 'Change' })).toBeVisible();
  await page.getByTestId('matrix-view').selectOption('products');
  await expect(page.getByTestId('matrix-section-COST_OF_GOODS')).toBeVisible();
});

test('FM-UI-2 the Store Head sees no purchases and no profit', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/financials');
  await expect(page.getByTestId('finance-matrix')).toBeVisible();
  await expect(page.getByTestId('matrix-tiles')).not.toContainText('Estimated profit');
  await expect(page.getByTestId('matrix-section-COST_OF_GOODS')).toHaveCount(0);
});
