/**
 * Staff & Quality — Audit log — AUDIT-1..3
 * Append-only record of sign-ins, failed sign-ins, bill edits and every write request.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const SITE_ADMIN = 'siteadmin@local.test';
const OWNER = 'businesshead@local.test';
const CASHIER = 'cashier.harbourh70@qa.local';
const PAGE = '/secure/quality/audit';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');

test.describe('Staff & Quality — Audit log @p1', () => {
  test('AUDIT-1 Business Head sees the audit log with their own sign-in @happy', async ({ app }) => {
    const { page } = await app.open(OWNER, PAGE);
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await expect(page.getByTestId('nav-quality')).toBeVisible();
    await page.getByTestId('aud-action').selectOption({ label: 'Sign-ins' });
    await expect(page.getByTestId('aud-row').first()).toBeVisible();
  });

  test('AUDIT-2 a failed sign-in is recorded with the email tried @integration', async ({ api }) => {
    const email = 'nobody.audit-test@local.test';
    const bad = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password' }),
    });
    expect(bad.status).toBe(401);
    const log = await api.request('GET', '/audit?action=auth.login_failed&limit=20', undefined, OWNER);
    expect(log.status).toBe(200);
    expect(log.body.rows.some((r: any) => r.details?.email === email)).toBe(true);
  });

  test('AUDIT-3 only Business Head can open the log or call the API @permission', async ({ app, api }) => {
    for (const who of [CASHIER, SITE_ADMIN]) {
      const { page } = await app.open(who, PAGE);
      await expect(page).toHaveURL(/\/login/);
      expect((await api.request('GET', '/audit', undefined, who)).status).toBe(403);
    }
  });
});
