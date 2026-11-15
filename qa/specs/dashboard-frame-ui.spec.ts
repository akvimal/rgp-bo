/**
 * The dashboard frame and shared filter - WF-UI-1..3
 * Cards sit in one frame (a "what is this" sentence, a link to where the figures come from). One period and comparison bar drives the money by category
 * card and is kept in the page address. The server's view list decides which cards a role holds.
 * (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 1, phase F0)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('WF-UI-1 a card explains itself and links to its source', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/financials');
  await expect(page.getByTestId('stock-value')).toBeVisible();
  await page.getByTestId('stock-value-info').click();
  await expect(page.getByTestId('stock-value-definition')).toContainText('purchase rate');
  await expect(page.getByTestId('stock-value-open')).toHaveAttribute('href', /\/secure\/store\/stock/);
});

test('WF-UI-2 the period bar changes the money card and is kept in the address', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/financials');
  await expect(page.getByTestId('finance-matrix')).toBeVisible();
  await page.getByTestId('matrix-period').selectOption('6m');
  await expect(page).toHaveURL(/period=6m/);
  await page.getByTestId('matrix-compare').selectOption('prev');
  await expect(page).toHaveURL(/compare=prev/);
  await expect(page.getByTestId('finance-matrix').locator('th', { hasText: 'Change' })).toBeVisible();
  // the same link, opened again, shows the same choice
  await page.reload();
  await expect(page.getByTestId('matrix-period')).toHaveValue('6m');
});

test('WF-UI-3 the Store Head dashboard holds health and a link to the financial page, not the heavy money cards', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/dashboard');
  await expect(page.getByTestId('findings-card')).toBeVisible();
  await expect(page.getByTestId('dash-financials-link')).toBeVisible();
  await expect(page.getByTestId('finance-matrix')).toHaveCount(0);
  await expect(page.getByTestId('gst-position')).toHaveCount(0);
  await page.getByTestId('dash-financials-link').click();
  await expect(page).toHaveURL(/\/secure\/financials/);
  await expect(page.getByTestId('finance-matrix')).toBeVisible();
  await expect(page.getByTestId('gst-position')).toHaveCount(0);
});
