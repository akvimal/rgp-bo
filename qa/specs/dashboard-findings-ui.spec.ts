/**
 * Health findings and sales patterns on screen - HF-UI-1..3
 * The health card reports findings by severity with the status taken from the worst one, lists the areas and the five to fix first, and can show every
 * finding. The Store Head sees the same card but cannot set a finding aside. The sales patterns card has four tabs and can show its numbers.
 * (docs/planning/DASHBOARD_FINANCE_HEALTH.md sections 3 and 4)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('HF-UI-1 the owner sees the status, the counts, eight areas and the fix-first list', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  const card = page.getByTestId('findings-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('findings-score')).toBeVisible();
  await expect(page.getByTestId('findings-status')).toHaveText(/Healthy|Watch|Act now/);
  await expect(page.getByTestId('findings-counts')).toContainText('critical');
  await expect(page.getByTestId('findings-counts')).toContainText('major');
  await expect(page.getByTestId('findings-areas').locator('.progress')).toHaveCount(8);
  await expect(page.getByTestId('findings-fix-first')).toBeVisible();

  // the full list opens and can be filtered
  await page.getByTestId('findings-toggle').click();
  await expect(page.getByTestId('findings-sev')).toBeVisible();
  await page.getByTestId('findings-sev').selectOption('critical');

  // the older ratio checks are still there, under their own name
  await expect(page.getByTestId('health-card')).toBeVisible();
  await expect(page.getByTestId('health-check-sales')).toBeVisible();
});

test('HF-UI-2 the Store Head sees the findings of their store but cannot set one aside', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/dashboard');
  await expect(page.getByTestId('findings-card')).toBeVisible();
  await expect(page.getByTestId('findings-status')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set aside' })).toHaveCount(0);
  await expect(page.getByTestId('findings-matrix')).toHaveCount(0);
});

test('HF-UI-3 the sales patterns card has four tabs and shows its numbers', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  const card = page.getByTestId('sales-patterns');
  await expect(card).toBeVisible();
  for (const t of ['hour', 'weekday', 'dom', 'month']) {
    await page.getByTestId(`patterns-tab-${t}`).click();
    await expect(page.getByTestId(`patterns-tab-${t}`)).toHaveClass(/active/);
  }
  await page.getByTestId('patterns-tab-weekday').click();
  await card.getByRole('button', { name: 'Show numbers' }).click();
  await expect(card.locator('table')).toBeVisible();
  await expect(card.locator('tbody tr')).toHaveCount(7);
  await expect(page.getByTestId('patterns-notes')).toBeVisible();
});
