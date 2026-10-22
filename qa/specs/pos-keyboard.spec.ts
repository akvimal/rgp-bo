/**
 * Billing keyboard flow — POSKEY-1
 * The product search is the new row at the foot of the bill; choosing a product puts the cursor in that line's units, and Tab
 * from the units goes back to the product search, ready for the next product.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

test.describe('Billing keyboard flow @p1', () => {
  test('POSKEY-1 the search is the new row; choosing a product focuses its units; Tab returns to the search @happy', async ({ app, api }) => {
    const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, MGR)).body;
    const line = rows.find((x: any) => x.status === 'VERIFIED' && Number(x.sale_price) > 0 && Number(x.balance) >= 5 && x.exp_date);
    test.skip(!line, 'no sellable stock');
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await expectShell(page);

    const search = page.locator('[data-testid=sale-add-item] input').first();
    const rowsInGrid = page.locator('app-sale-form-items tbody tr');
    await expect(rowsInGrid.last()).toHaveAttribute('data-testid', 'sale-add-item-links-row');                        // the request link closes the grid
    await expect(rowsInGrid.nth((await rowsInGrid.count()) - 2)).toHaveAttribute('data-testid', 'sale-add-item');    // the search is the row before it
    await search.fill(String(line.title));
    await page.locator('.p-autocomplete-panel li').filter({ hasText: line.title }).first().click();

    const units = page.getByTestId('sale-line').first().locator('input[aria-label="Units"]');
    await expect(units).toBeFocused();                                                    // no click needed to type the units
    await page.keyboard.type('2');
    await expect(units).toHaveValue('2');
    await page.keyboard.press('Tab');
    await expect(search).toBeFocused();                                                   // Tab goes to the next product
  });
});
