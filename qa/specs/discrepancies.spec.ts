/**
 * Staff & Quality — Cash & shifts — DISC-1..3
 * Shifts that did not balance, expenses without receipts, shifts never closed.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const SITE_ADMIN = 'siteadmin@local.test';
const OWNER = 'businesshead@local.test';
const CASHIER = 'cashier.harbourh70@qa.local';
const PAGE = '/secure/quality/discrepancies';

test.describe('Staff & Quality — Cash & shifts @p1', () => {
  test('DISC-1 Business Head sees the report and its totals match the lists @happy', async ({ app, api }) => {
    const { page } = await app.open(OWNER, PAGE);
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'Cash & shifts' })).toBeVisible();
    await page.getByTestId('dc-preset-90d').click();
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
    const res = await api.request('GET', `/quality/discrepancies?from=${from}&to=${to}`, undefined, OWNER);
    expect(res.status).toBe(200);
    expect(res.body.totals.shifts_off).toBe(res.body.shifts.length);
    expect(res.body.totals.no_receipt_count).toBe(res.body.noReceipt.length);
    await expect(page.getByTestId('dc-off')).toHaveText(String(res.body.shifts.length));
    await expect(page.getByTestId('dc-shift-row')).toHaveCount(res.body.shifts.length);
  });

  test('DISC-2 every listed shift really has a difference and a short shift is negative @integration', async ({ api }) => {
    const to = new Date().toISOString().slice(0, 10);
    const res = await api.request('GET', `/quality/discrepancies?from=2000-01-01&to=${to}`, undefined, OWNER);
    expect(res.status).toBe(200);
    for (const s of res.body.shifts) {
      expect(Number(s.variance)).not.toBe(0);
      expect(Math.round((Number(s.counted) - Number(s.expected)) * 100) / 100).toBe(Number(s.variance));
    }
    for (const p of res.body.people) expect(Math.round((Number(p.short) + Number(p.over)) * 100) / 100).toBe(Number(p.net));
    expect((await api.request('GET', '/quality/discrepancies?from=bad&to=2026-01-01', undefined, OWNER)).status).toBe(400);
  });

  test('DISC-3 only Business Head can open the page or call the API @permission', async ({ app, api }) => {
    for (const who of [CASHIER, SITE_ADMIN]) {
      const { page } = await app.open(who, PAGE);
      await expect(page).toHaveURL(/\/login/);
      expect((await api.request('GET', '/quality/discrepancies?from=2026-01-01&to=2026-01-31', undefined, who)).status).toBe(403);
    }
  });
});
