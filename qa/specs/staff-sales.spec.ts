/**
 * Staff & Quality — Staff sales — STAFF-1..3
 * Per-person sales for a period: bills, value, discount, returns, edits.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const SITE_ADMIN = 'siteadmin@local.test';
const OWNER = 'businesshead@local.test';
const CASHIER = data.m.users.find((u: any) => u.role === 'Sales Staff')!.email;   // whichever ids the seed handed out
const PAGE = '/secure/quality/staff-sales';

test.describe('Staff & Quality — Staff sales @p1', () => {
  test('STAFF-1 Business Head sees per-person sales that add up to the API totals @happy', async ({ app, api }) => {
    const { page } = await app.open(OWNER, PAGE);
    await expectShell(page);
    await expect(page.getByTestId('nav-quality')).toBeVisible();
    await page.getByTestId('ss-from').fill('2000-01-01');
    await page.getByTestId('ss-from').dispatchEvent('change');
    const today = new Date().toISOString().slice(0, 10);
    const res = await api.request('GET', `/quality/staff-sales?from=2000-01-01&to=${today}`, undefined, OWNER);
    expect(res.status).toBe(200);
    if (res.body.length) {
      await expect(page.getByTestId('ss-row')).toHaveCount(res.body.length);
      const bills = res.body.reduce((t: number, r: any) => t + r.bills, 0);
      await expect(page.getByTestId('ss-total-bills')).toHaveText(String(bills));
    } else {
      await expect(page.getByTestId('ss-empty')).toBeVisible();
    }
  });

  test('STAFF-2 invalid or reversed dates are rejected @edge', async ({ api }) => {
    expect((await api.request('GET', '/quality/staff-sales?from=nope&to=2026-01-01', undefined, OWNER)).status).toBe(400);
    expect((await api.request('GET', '/quality/staff-sales?from=2026-02-01&to=2026-01-01', undefined, OWNER)).status).toBe(400);
  });

  test('STAFF-3 only Business Head can open the page or call the API @permission', async ({ app, api }) => {
    for (const who of [CASHIER, SITE_ADMIN]) {
      const { page } = await app.open(who, PAGE);
      await expect(page).toHaveURL(/\/login/);
      expect((await api.request('GET', '/quality/staff-sales?from=2026-01-01&to=2026-01-31', undefined, who)).status).toBe(403);
    }
  });
});
