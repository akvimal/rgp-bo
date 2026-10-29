/**
 * Store health and charts on screen - HM-UI-1..2
 * The Owner view opens with the store health card (score, status, seven checks) and the charts; every chart can be shown as numbers; the Business Head
 * can save a sales target from the card. The Store Head sees health and charts, but not the target box or what is owed to vendors.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

test('HM-UI-1 the owner sees health and the charts, shows one as numbers, and saves a target', async ({ app, api }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await expect(page.getByTestId('health-card')).toBeVisible();
  await expect(page.getByTestId('health-score')).toBeVisible();
  await expect(page.getByTestId('health-status')).toBeVisible();
  for (const k of ['sales', 'stock', 'cash', 'purchasing', 'customers', 'compliance', 'service']) await expect(page.getByTestId(`health-check-${k}`)).toBeVisible();
  for (const id of ['chart-sales-months', 'chart-categories', 'chart-customers', 'chart-payables', 'chart-hours']) await expect(page.getByTestId(id)).toBeVisible();

  await page.getByTestId('chart-sales-months').getByRole('button', { name: 'Show numbers' }).click();
  await expect(page.getByTestId('chart-sales-months').locator('table')).toBeVisible();

  await page.getByTestId('target-input').fill('250000');
  await page.getByTestId('target-save').click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await expect(page.getByTestId('health-check-sales')).not.toContainText('no data');
  await api.request('PUT', '/dashboard/targets', { month: new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7), value: null }, MGR);
});

test('HM-UI-3 the tiles show the month so far with a change, and the comparison can be switched', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await expect(page.getByTestId('tiles')).toBeVisible();
  for (const k of ['sales', 'bills', 'avgbill', 'discount', 'returns']) await expect(page.getByTestId(`tile-${k}`)).toBeVisible();
  const before = await page.getByTestId('tiles').locator('.small.text-muted').first().innerText();
  await page.getByTestId('compare-year').click();
  await expect(page.getByTestId('tiles').locator('.small.text-muted').first()).not.toHaveText(before);
  await expect(page.getByTestId('chart-deliveries')).toBeVisible();
  await expect(page.getByTestId('chart-expenses')).toBeVisible();
});

test('HM-UI-2 the store head sees health and charts without the target box or the vendor payables', async ({ app }) => {
  const { page } = await app.open(HEAD, '/secure/dashboard');
  await expect(page.getByTestId('health-card')).toBeVisible();
  await expect(page.getByTestId('chart-sales-months')).toBeVisible();
  await expect(page.getByTestId('target-input')).toHaveCount(0);
  await expect(page.getByTestId('chart-payables')).toHaveCount(0);
});

test('HM-UI-4 the team card is short until opened, and every chart stays inside its card', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await expect(page.getByTestId('chart-hours')).toBeVisible();
  const card = page.getByTestId('team-recognition');
  if (await card.count()) {
    const people = await card.locator('[data-testid^="tr-thank-"]').count();
    expect(people).toBeLessThanOrEqual(6);
    if (await page.getByTestId('tr-all').count()) {
      await page.getByTestId('tr-all').click();
      expect(await card.locator('[data-testid^="tr-thank-"]').count()).toBeGreaterThan(people);
    }
    await page.getByTestId('tr-toggle').click();
    await expect(card.locator('[data-testid^="tr-thank-"]')).toHaveCount(0);
  }
  await page.waitForTimeout(1200);   // the charts draw after their data arrives
  const overflow = await page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll('.chart-box').forEach((box) => {
      const b = box.getBoundingClientRect();
      const host = box.closest('.card')?.getBoundingClientRect();
      box.querySelectorAll('svg').forEach((svg) => {
        const r = svg.getBoundingClientRect();
        if (host && (r.right > host.right + 1 || r.bottom > b.bottom + 1)) bad.push(`${box.parentElement?.getAttribute('data-testid') || box.closest('section')?.getAttribute('data-testid')} svg ${Math.round(r.right - host.right)}px wide, ${Math.round(r.bottom - b.bottom)}px tall`);
      });
    });
    return { bad, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(overflow.bad).toEqual([]);
  expect(overflow.page).toBeLessThanOrEqual(0);
});
