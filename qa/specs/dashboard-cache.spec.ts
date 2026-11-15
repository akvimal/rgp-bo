/**
 * Kept dashboard figures - DC-1..4
 * Heavy figures are kept between opens (hourly, daily or weekly by how fast the data changes), shown with when they were worked out, and rebuilt on
 * Refresh. One person's figure is never handed to another whose view differs. (docs/planning/DASHBOARD_FINANCE_HEALTH.md, "Kept figures")
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('DC-1 a heavy figure says when it was worked out, and the same figure is kept between opens', async ({ api }) => {
  await api.request('GET', '/dashboard/finance/trend', undefined, MGR);   // warms it (it may be rebuilt behind if it was old)
  await wait(1500);
  const a = (await api.request('GET', '/dashboard/finance/trend', undefined, MGR)).body;
  const b = (await api.request('GET', '/dashboard/finance/trend', undefined, MGR)).body;
  expect(a.asOf).toBeTruthy();
  expect(b.asOf).toBe(a.asOf);
  expect(b.refreshing).toBeFalsy();
});

test('DC-2 asking again within half a minute changes nothing', async ({ api }) => {
  const a = (await api.request('GET', '/dashboard/stock/value?refresh=1', undefined, MGR)).body;
  const b = (await api.request('GET', '/dashboard/stock/value?refresh=1', undefined, MGR)).body;
  expect(a.asOf).toBeTruthy();
  expect(b.asOf).toBe(a.asOf);
});

test('DC-3 the Store Head gets a figure of their own, never the owner\'s', async ({ api }) => {
  const owner = (await api.request('GET', '/dashboard/finance/matrix', undefined, MGR)).body;
  const head = (await api.request('GET', '/dashboard/finance/matrix', undefined, HEAD)).body;
  expect(owner.owner).toBe(true);
  expect(head.owner).toBe(false);                                           // no purchases or profit for a manager, kept or not
  expect(owner.summary?.profit).toBeTruthy();
  expect(head.summary?.profit).toBeFalsy();
});

test('DC-4 the cards show when the figures were worked out and a Refresh link', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/financials');
  await expect(page.getByTestId('matrix-asof')).toContainText(/As of|Updating/);
  await expect(page.getByTestId('matrix-refresh')).toBeVisible();
  await expect(page.getByTestId('stock-value-asof')).toContainText(/As of|Updating/);
  await expect(page.getByTestId('stock-value-refresh')).toBeVisible();
  await page.getByTestId('stock-value-refresh').click();                    // inside the cooldown this keeps the figure: the card must still be there
  await expect(page.getByTestId('stock-value-asof')).toBeVisible();
});
