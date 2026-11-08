/**
 * The Telegram help page (/secure/help/telegram) — THLP-1..2.
 * Everyone signed in can read it; the owner's settings links show only to a login that can open them; Settings > Alerts links to it.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

test.describe('Telegram help page @p2', () => {
  test('THLP-1 a counter login can read it, without the owner-only links', async ({ app }) => {
    const { page } = await app.open(COUNTER, '/secure/help/telegram');
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'Help: Telegram alerts' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('BotFather').first()).toBeVisible();
    await expect(page.getByTestId('th-problems')).toBeVisible();
    await expect(page.getByTestId('th-open-notifications')).toBeVisible();
    await expect(page.getByTestId('th-open-alerts')).toHaveCount(0);
  });

  test('THLP-2 the Business Head reaches it from Settings > Alerts and gets the settings link', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/settings/alerts');
    await expectShell(page);
    await page.getByTestId('al-tg-help').click();
    await expect(page).toHaveURL(/\/secure\/help\/telegram/);
    await expect(page.getByRole('heading', { name: 'Help: Telegram alerts' })).toBeVisible();
    await expect(page.getByTestId('th-open-alerts')).toBeVisible();
    await page.getByTestId('th-toc').getByText('If something does not work').click();
    await expect(page.getByTestId('th-problems')).toBeInViewport();
  });
});
