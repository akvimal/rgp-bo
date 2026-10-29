/**
 * Settings > Dashboards and compliance on screen - DSU-UI-1..3
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('DSU-UI-1 the Business Head changes a setting from a date, sees it in the history, and resets it', async ({ app, api }) => {
  await api.request('DELETE', '/config/compliance/escalate_days', undefined, MGR);
  const { page } = await app.open(MGR, '/secure/settings/dashboards');
  await expect(page.getByTestId('dsetup')).toBeVisible();
  await page.getByTestId('dsetup-tab-compliance').click();
  const input = page.getByTestId('dsetup-input-escalate_days');
  await expect(input).toBeVisible();
  await expect(page.getByTestId('dsetup-save')).toBeDisabled();
  await input.fill('6');
  await page.getByTestId('dsetup-save').click();
  await expect(page.getByTestId('dsetup-message')).toContainText('Saved: 1 setting');
  await expect(page.getByTestId('dsetup-history')).toContainText('escalate_days: 3 to 6');
  await expect(page.getByTestId('dsetup-pending-escalate_days')).toContainText('Changes to 6 days from');
  await page.getByTestId('dsetup-reset-escalate_days').click();
  await expect(page.getByTestId('dsetup-message')).toContainText('back to its default');
  await expect(page.getByTestId('dsetup-reset-escalate_days')).toHaveCount(0);
});

test('DSU-UI-2 the required items are shown as locked, and the health weights must add up to 100', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/settings/dashboards');
  await page.getByTestId('dsetup-tab-compliance').click();
  await expect(page.getByTestId('dsetup-row-drug_register')).toContainText('Required');
  await expect(page.getByTestId('dsetup-input-drug_register')).toBeDisabled();
  await page.getByTestId('dsetup-tab-health').click();
  await expect(page.getByTestId('dsetup-weights')).toHaveCount(0);
  await page.getByTestId('dsetup-input-w_sales').fill('30');
  await expect(page.getByTestId('dsetup-weights')).toContainText('add up to 105');
  await expect(page.getByTestId('dsetup-targets')).toBeVisible();
  await page.getByTestId('dsetup-tab-views').click();
  await page.getByTestId('dsetup-preview-role').selectOption({ label: 'Counter' });
  await page.getByTestId('dsetup-preview-go').click();
  await expect(page.getByTestId('dsetup-preview-result')).toContainText('counter');
});

test('DSU-UI-3 the Store Head reads the settings with no controls to change them', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/settings/dashboards');
  await expect(page.getByTestId('dsetup-readonly')).toBeVisible();
  await page.getByTestId('dsetup-tab-compliance').click();
  await expect(page.getByTestId('dsetup-input-escalate_days')).toBeDisabled();
  await expect(page.getByTestId('dsetup-save')).toHaveCount(0);
  await expect(page.getByTestId('dsetup-preview')).toHaveCount(0);
});
