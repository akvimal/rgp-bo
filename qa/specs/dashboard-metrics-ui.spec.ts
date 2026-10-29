/**
 * Store health and charts on screen - HM-UI-1..2
 * The Owner view opens with the store health card (score, status, seven checks) and the charts; every chart can be shown as numbers; the Business Head
 * can save a sales target from the card. The Store Head sees health and charts, but not the target box or what is owed to vendors.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('HM-UI-1 the owner sees health and the charts, shows one as numbers, and saves a target', async ({ app, api }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await expect(page.getByTestId('health-card')).toBeVisible();
  await expect(page.getByTestId('health-score')).toBeVisible();
  await expect(page.getByTestId('health-status')).toBeVisible();
  for (const k of ['sales', 'stock', 'cash', 'purchasing', 'customers', 'compliance', 'service']) await expect(page.getByTestId(`health-check-${k}`)).toBeVisible();
  for (const id of ['chart-sales-months', 'chart-categories', 'chart-customers', 'chart-payables', 'chart-hours']) await expect(page.getByTestId(id)).toBeVisible();

  await page.getByTestId('chart-sales-months').getByRole('button', { name: 'Show numbers' }).click();
  await expect(page.getByTestId('chart-sales-months').locator('table')).toBeVisible();

  await page.getByTestId('target-input').fill('250000');
  await page.getByTestId('target-save').click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByTestId('health-check-sales')).not.toContainText('no data');
  await api.request('PUT', '/dashboard/targets', { month: new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7), value: null }, MGR);
});

test('HM-UI-2 the store head sees health and charts without the target box or the vendor payables', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/dashboard');
  await expect(page.getByTestId('health-card')).toBeVisible();
  await expect(page.getByTestId('chart-sales-months')).toBeVisible();
  await expect(page.getByTestId('target-input')).toHaveCount(0);
  await expect(page.getByTestId('chart-payables')).toHaveCount(0);
});
