/**
 * Settings — Telegram notifications — NOTIF-1..4
 * Admin screen for the daily digest: per-store chats, send time, preview, access control.
 * Sending is deliberately not exercised here (it would reach a real Telegram chat); the send path
 * is covered by the unit spec + a mock-Telegram run documented in the feature commit.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const SITE_ADMIN = 'siteadmin@local.test';
const ADMIN = 'businesshead@local.test';
const CASHIER = 'cashier.harbourh70@qa.local';
const PAGE = '/secure/settings/notifications';

test.describe('Settings — Notifications @p1', () => {
  test('NOTIF-1 Business Head can open Settings > Notifications @happy', async ({ app, api }) => {
    const { page } = await app.open(ADMIN, PAGE);
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'Telegram Notifications' })).toBeVisible();
    await expect(page.getByTestId('nt-store-row').first()).toBeVisible();
    await expect(page.getByTestId('nav-settings-notifications')).toBeVisible();
    // the missing-token banner must follow the server's actual state
    const cfg = await api.request('GET', '/notifications/config', undefined, ADMIN);
    await expect(page.getByTestId('nt-bot-warning')).toHaveCount(cfg.body.botconfigured ? 0 : 1);
  });

  test('NOTIF-1b Site Admin has no Notifications screen or API access @permission', async ({ app, api }) => {
    const { page } = await app.open(SITE_ADMIN, PAGE);
    await expect(page).toHaveURL(/\/login/);
    expect((await api.request('GET', '/notifications/config', undefined, SITE_ADMIN)).status).toBe(403);
  });

  test('NOTIF-2 saved chat IDs, send time and toggles persist across a reload @happy', async ({ app, api }) => {
    const before = (await api.request('GET', '/notifications/config', undefined, ADMIN)).body;
    try {
      const { page } = await app.open(ADMIN, PAGE);
      const row = page.getByTestId('nt-store-row').filter({ hasText: 'Main Store' });
      await row.getByTestId('nt-store-chat').fill('-100424242');
      await row.getByTestId('nt-store-enabled').uncheck();
      // keep the scheduler from ever delivering to these fake chats if a real bot token is configured
      await page.getByTestId('nt-daily-enabled').uncheck();
      await page.getByTestId('nt-daily-time').fill('21:15');
      await page.getByTestId('nt-consolidated-chat').fill('-100515151');
      await page.getByTestId('nt-save').click();
      await expect(page.getByTestId('nt-saved')).toBeVisible();

      await page.reload();
      const again = page.getByTestId('nt-store-row').filter({ hasText: 'Main Store' });
      await expect(again.getByTestId('nt-store-chat')).toHaveValue('-100424242');
      await expect(again.getByTestId('nt-store-enabled')).not.toBeChecked();
      await expect(page.getByTestId('nt-daily-enabled')).not.toBeChecked();
      await expect(page.getByTestId('nt-daily-time')).toHaveValue('21:15');
      await expect(page.getByTestId('nt-consolidated-chat')).toHaveValue('-100515151');

      const server = (await api.request('GET', '/notifications/config', undefined, ADMIN)).body;
      expect(server.dailytime).toBe('21:15');
      expect(server.stores.find((s: any) => s.location === 'Main Store').telegramchatid).toBe('-100424242');
    } finally {
      await api.request('PUT', '/notifications/config', {
        dailytime: before.dailytime,
        dailyenabled: before.dailyenabled,
        consolidatedchatid: before.consolidatedchatid,
        stores: before.stores.map((s: any) => ({ id: s.id, telegramchatid: s.telegramchatid ?? '', telegramdigestenabled: s.telegramdigestenabled })),
      }, ADMIN);
    }
  });

  test('NOTIF-3 preview renders the digest for a store and never shows cash or margin @integration', async ({ app }) => {
    const { page } = await app.open(ADMIN, PAGE);
    await page.getByTestId('nt-date').fill('2026-10-04');
    await page.getByTestId('nt-preview-scope').selectOption({ label: 'Main Store' });
    await page.getByTestId('nt-preview').click();
    const text = page.getByTestId('nt-preview-text');
    await expect(text).toContainText('Main Store');
    await expect(text).toContainText('Sales:');
    await expect(text).not.toContainText(/cash|margin|balance|deposit|expense|variance/i);

    await page.getByTestId('nt-preview-scope').selectOption({ label: 'All stores' });
    await page.getByTestId('nt-preview').click();
    await expect(text).toContainText('All stores');
    await expect(text).toContainText('Purchases received');
  });

  test('NOTIF-4 roles without the permission cannot open the screen or call the API @edge', async ({ app, api }) => {
    const { page } = await app.open(CASHIER, PAGE);
    await expect(page).toHaveURL(/\/login/);

    const cfg = await api.request('GET', '/notifications/config', undefined, CASHIER);
    expect(cfg.status).toBe(403);
    const save = await api.request('PUT', '/notifications/config', { dailytime: '10:00' }, CASHIER);
    expect(save.status).toBe(403);
  });

  test('NOTIF-5 an invalid send time is rejected by the API and leaves the saved time alone @edge', async ({ api }) => {
    const before = (await api.request('GET', '/notifications/config', undefined, ADMIN)).body.dailytime;
    const bad = await api.request('PUT', '/notifications/config', { dailytime: '25:99' }, ADMIN);
    expect(bad.status).toBe(400);
    const after = (await api.request('GET', '/notifications/config', undefined, ADMIN)).body.dailytime;
    expect(after).toBe(before);
  });
});
