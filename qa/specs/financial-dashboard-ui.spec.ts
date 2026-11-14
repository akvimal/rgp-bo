/**
 * The financial dashboard page - FD-UI-1..2
 * One page with money by category, the bridge from sales to profit (owner), cost ratios, cash by place, stock and the GST estimate. A Store Head sees
 * the same page with no bridge, no purchases and no profit.
 * (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.2, phase F5)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('FD-UI-1 the owner opens the page from the Accounts menu and sees every block', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await page.getByTestId('nav-financials').click();
  await expect(page).toHaveURL(/\/secure\/financials/);
  await expect(page.getByTestId('fd-intro')).toBeVisible();
  await expect(page.getByTestId('finance-matrix')).toBeVisible();
  await expect(page.getByTestId('profit-bridge')).toBeVisible();
  await expect(page.getByTestId('bridge-sales')).toBeVisible();
  await expect(page.getByTestId('bridge-profit')).toBeVisible();
  await expect(page.getByTestId('cost-ratios')).toBeVisible();
  await expect(page.getByTestId('cash-position')).toBeVisible();
  await expect(page.getByTestId('cash-total')).toBeVisible();
  await expect(page.getByTestId('stock-value')).toBeVisible();
  await expect(page.getByTestId('gst-position')).toBeVisible();
  // the bridge is only for the whole-business view of costs and profit, not the product category view
  await page.getByTestId('matrix-view').selectOption('products');
  await expect(page.getByTestId('profit-bridge')).toHaveCount(0);
});

test('FD-UI-2 the Store Head sees the page without the bridge, purchases or profit', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/financials');
  await expect(page.getByTestId('finance-matrix')).toBeVisible();
  await expect(page.getByTestId('cost-ratios')).toBeVisible();
  await expect(page.getByTestId('profit-bridge')).toHaveCount(0);
  await expect(page.getByTestId('matrix-tiles')).not.toContainText('Estimated profit');
  await expect(page.getByTestId('matrix-section-COST_OF_GOODS')).toHaveCount(0);
  await expect(page.getByTestId('gst-position')).toHaveCount(0);
});

test('FD-UI-3 the owner can preview the weekly digest; the Store Head has no owner tools', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/financials');
  await expect(page.getByTestId('fd-owner-tools')).toBeVisible();
  await page.getByTestId('fd-digest-preview').click();
  await expect(page.getByTestId('fd-digest-text')).toContainText('Health:');
  const head = await app.open(HEAD, '/secure/financials');
  await expect(head.page.getByTestId('finance-matrix')).toBeVisible();
  await expect(head.page.getByTestId('fd-owner-tools')).toHaveCount(0);
});
