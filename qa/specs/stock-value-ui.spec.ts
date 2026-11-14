/**
 * Stock value on the dashboard - SV-UI-1..2
 * The stock card shows the value at cost, the expiry ladder and the category table. The GST estimate is for the owner only.
 * (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2.2, phase F4)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('SV-UI-1 the owner sees stock at cost, the expiry ladder, categories and the GST estimate', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await expect(page.getByTestId('stock-value')).toBeVisible();
  await expect(page.getByTestId('stock-tiles')).toContainText('Stock at cost');
  await expect(page.getByTestId('stock-ladder')).toContainText('Already expired');
  await expect(page.getByTestId('stock-categories')).toBeVisible();
  await expect(page.getByTestId('gst-position')).toBeVisible();
});

test('SV-UI-2 the Store Head sees the stock but not the GST estimate', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/dashboard');
  await expect(page.getByTestId('stock-value')).toBeVisible();
  await expect(page.getByTestId('stock-ladder')).toBeVisible();
  await expect(page.getByTestId('gst-position')).toHaveCount(0);
});
