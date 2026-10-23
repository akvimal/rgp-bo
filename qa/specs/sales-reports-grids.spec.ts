/**
 * Sales reports: Invoice Level, Product Level, Staff Report - RPTG-1..3
 * One look for the three grids: money with two decimals and no floating-point tail, the bill number opens the bill in both
 * lists, and sort and filter sit together at the right edge of each column header.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

async function sellToday(api: any, digi: number, cash: number) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
  const line = rows[0];
  const now = new Date().toISOString();
  const total = digi + cash;
  const r = await api.request('POST', '/sales', {
    billdate: now, orderdate: now, cashamt: cash, digiamt: digi, total, discamount: 0, expreturndays: 7, status: 'COMPLETE',
    ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: line.item_id, productid: line.id, batch: line.batch, price: total, mrpcost: line.mrp_cost, taxpcnt: line.tax_pcnt, qty: 1, total, status: 'Complete' }],
  }, COUNTER);
  return r;
}

test.describe('Sales report grids @p1', () => {
  test('RPTG-1 money shows two decimals and the totals carry no long tail @happy', async ({ api, app }) => {
    await sellToday(api, 33.33, 11.11);
    await sellToday(api, 0.1, 0.2);                                   // 0.1 + 0.2 is 0.30000000000000004 in floating point
    const { page } = await app.open(MGR, '/secure/sales/list');
    await expect(page.getByTestId('invoice-row').first()).toBeVisible();
    for (const id of ['total-digital', 'total-cash', 'total-net']) {
      await expect(page.getByTestId(id)).toHaveText(/^[\d,]+\.\d\d$/);
    }
    const cells = await page.getByTestId('invoice-row').first().locator('td.text-end').allInnerTexts();
    expect(cells).toHaveLength(3);
    for (const c of cells) expect(c.trim()).toMatch(/^[\d,]+\.\d\d$/);
  });

  test('RPTG-2 the bill number opens the bill, in the invoice list and in the product list @happy', async ({ api, app }) => {
    await sellToday(api, 0, 25);
    const { page } = await app.open(MGR, '/secure/sales/list');
    await expect(page.getByTestId('invoice-row').first()).toBeVisible();
    await page.getByTestId('invoice-row').first().getByTestId('bill-link').click();
    await expect(page).toHaveURL(/\/secure\/sales\/pos\/view\/\d+/);

    await page.goto(page.url().replace(/\/pos\/view\/\d+/, '/list'));
    await page.getByRole('tab', { name: 'Product Level' }).click();
    await expect(page.getByTestId('product-row').first()).toBeVisible();
    await page.getByTestId('product-row').first().getByTestId('bill-link').click();
    await expect(page).toHaveURL(/\/secure\/sales\/pos\/view\/\d+/);
  });

  test('RPTG-3 the staff report uses the same grid and number format, and the headers put sort and filter at the right edge @happy', async ({ api, app }) => {
    await sellToday(api, 5, 20);
    const { page } = await app.open(MGR, '/secure/sales/list');
    await expect(page.getByTestId('invoice-row').first()).toBeVisible();
    const bars = page.getByTestId('invoice-table').locator('th .th-bar');
    expect(await bars.count()).toBeGreaterThan(5);
    // in a column with a filter, the filter button sits to the right of the name
    const head = page.getByTestId('invoice-table').locator('th', { hasText: 'Customer' }).first();
    const label = (await head.locator('.th-label').boundingBox())!;
    const filter = (await head.locator('p-columnFilter').boundingBox())!;
    expect(filter.x).toBeGreaterThan(label.x);
    const th = (await head.boundingBox())!;
    expect(th.x + th.width - (filter.x + filter.width) - 40).toBeLessThan(60);          // within reach of the right edge, not hugging the name
    await page.getByRole('tab', { name: 'Staff Report' }).click();
    await expect(page.getByTestId('staff-row').first()).toBeVisible();
    const money = await page.getByTestId('staff-row').first().locator('td.text-end').allInnerTexts();
    for (const m of money.slice(1, 4)) expect(m.trim()).toMatch(/^[\d,]+\.\d\d$/);
  });
});
