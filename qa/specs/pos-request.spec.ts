/**
 * The billing screen — POS-REQ-1
 * No shift strip on the POS (the header pill and My shift page cover it), and a product we don't have is requested from a
 * popup below the items.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

test.describe('POS requests @p1', () => {
  test('POS-REQ-1 a popup under the product search captures a request for a product we do not have @happy', async ({ app, api }) => {
    const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body;
    test.skip(!rows.length, 'no products to request');
    const title: string = rows[0].title;

    const { page } = await app.open(COUNTER, '/secure/sales/pos/new');
    await expectShell(page);
    await expect(page.getByTestId('shift-card')).toHaveCount(0);                       // no shift strip on the POS
    await expect(page.getByTestId('shift-card-link')).toHaveCount(0);

    // the link sits right under the product search (in the new row of the grid), and opens a popup instead of leaving the bill
    const link = page.getByTestId('pos-request-product');
    await expect(link).toBeVisible();
    const search = await page.locator('[data-testid=sale-add-item] app-stock-select').boundingBox();
    const grid = await page.locator('app-sale-form-items table').first().boundingBox();
    const at = await link.boundingBox();
    expect(at!.y).toBeGreaterThanOrEqual(search!.y + search!.height - 2);
    expect(at!.y + at!.height).toBeLessThanOrEqual(grid!.y + grid!.height + 2);          // the last line of the grid, after the search
    const url = page.url();
    await link.click();
    const dlg = page.getByTestId('pos-request-dialog');
    await expect(dlg).toBeVisible();
    expect(page.url()).toBe(url);

    // saving needs a product and a quantity
    await page.getByTestId('pos-request-save').click();
    await expect(page.getByTestId('pos-request-error')).toContainText('product');
    await dlg.locator('app-product-select input').fill(title.slice(0, 4));
    await page.locator('.p-autocomplete-panel li').first().click();
    await expect(page.getByTestId('pos-request-product-name')).toBeVisible();
    await page.getByTestId('pos-request-qty').fill('0');
    await page.getByTestId('pos-request-save').click();
    await expect(page.getByTestId('pos-request-error')).toContainText('how many');

    await page.getByTestId('pos-request-qty').fill('3');
    await page.getByTestId('pos-request-cname').fill('QA Walk-in');
    await page.getByTestId('pos-request-cphone').fill('9876500077');
    await page.getByTestId('pos-request-notes').fill('QA: the 500 mg strip');
    await page.getByTestId('pos-request-save').click();
    await expect(page.getByTestId('pos-request-done')).toBeVisible();
    await expect(dlg).toHaveCount(0);

    // purchasing sees it as a customer request
    const mine = (await api.request('GET', '/purchaserequests', undefined, MGR)).body;
    const made = mine.find((r: any) => r.customername === 'QA Walk-in' && r.comments === 'QA: the 500 mg strip');
    expect(made).toMatchObject({ source: 'Customer', qty: 3, customerphone: '9876500077' });
  });
});
