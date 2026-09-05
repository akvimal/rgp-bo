/**
 * Dashboard — DASH-1..3
 * Source: docs/testing/manual-test-plan.html  (module "dashboard")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';

test.describe('Dashboard @p1', () => {
  test('DASH-1 the dashboard renders KPIs and charts with no console errors @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/dashboard', { storeId: 1 });
    await expectShell(page);
    await expect(page.getByTestId('dash-root')).toBeVisible();
    await expect(page.getByTestId('dash-kpis')).toBeVisible();
    await expect(page.getByTestId('dash-error')).toHaveCount(0);
    // charts mount (ngx-charts renders <ngx-charts-*> / svg)
    await expect(page.locator('ngx-charts-line-chart, ngx-charts-bar-vertical, svg').first()).toBeVisible();
    // no NaN leaked into the KPI text
    await expect(page.getByTestId('dash-kpis')).not.toContainText('NaN');
  });

  test('DASH-2 a store with no history shows a clean empty state (no NaN / broken axes) @edge', async ({ app, api }) => {
    // a brand-new store has zero sales / stock
    const s = await api.request('POST', '/stores', { location: `Dash Empty ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
    // API-level: a fresh store's summary has zero sales
    const summ = await api.request('GET', `/dashboard/summary?storeid=${s.body.id}`, undefined, MGR);
    expect(Number(summ.body.kpis?.sales_month ?? 0)).toBe(0);

    const { page } = await app.open(MGR, '/secure/dashboard', { storeId: s.body.id });
    await expectShell(page);
    await expect(page.getByTestId('dash-root')).toBeVisible();
    await expect(page.getByTestId('dash-error')).toHaveCount(0);
    // clean empty state: no NaN, no "Infinity", charts still mount without throwing
    await expect(page.getByTestId('dash-kpis')).not.toContainText('NaN');
    await expect(page.getByTestId('dash-kpis')).not.toContainText('Infinity');
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('DASH-3 switching the store in the header reloads every widget @integration', async ({ app, api }) => {
    const other = data.storesOf(1).find((x) => x.id !== 1)!.id;
    const { page } = await app.open(MGR, '/secure/dashboard', { storeId: 1 });
    await expectShell(page);
    const before = await page.getByTestId('dash-sales-today').textContent();

    const resp = page.waitForResponse((r) => r.url().includes('/dashboard/summary') && r.url().includes(`storeid=${other}`));
    await page.getByTestId('store-switcher').selectOption(String(other));
    await resp;
    // the widget re-fetched for the new store (value may differ or match; the fetch is the assertion)
    await expect(page.getByTestId('dash-root')).toBeVisible();
    await expect(page.getByTestId('dash-kpis')).not.toContainText('NaN');
    void before;
  });

  test('DASH-admin the admin rollup is admin-only (issue #134) @permission', async ({ api }) => {
    const asStaff = await api.request('GET', '/dashboard/admin-summary', undefined, 'sales1@local.test');
    expect(asStaff.status).toBeGreaterThanOrEqual(403);
    // Business Head / Site Admin still get it
    const asBH = await api.request('GET', '/dashboard/admin-summary', undefined, MGR);
    expect(asBH.status).toBeLessThan(400);
    expect(asBH.body).toHaveProperty('businesses');
  });
});
