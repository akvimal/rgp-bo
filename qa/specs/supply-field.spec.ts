/**
 * Long supplies on the billing screen — SUPPLY-1
 * There is no months field. For a regular medicine the units are months of medicine, and the screen warns, at Complete, only
 * when the batch and the quantity do not leave 3 months after the supply.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

const addMonths = (d: Date, n: number) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCMonth(x.getUTCMonth() + n); return x; };

test.describe('Long supply warning on the bill @p1', () => {
  test('SUPPLY-1 no months field; a warning only when the batch cannot cover the quantity with 3 months to spare @happy', async ({ app, api }) => {
    const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, MGR)).body;
    const threeMonths = addMonths(new Date(), 3).getTime();
    const days = (x: any) => Math.floor((new Date(x.exp_date).getTime() - threeMonths) / 86400000);
    const line = rows.find((x: any) => x.status === 'VERIFIED' && Number(x.sale_price) > 0 && (x.more_props?.schedule ?? '') !== 'H1' && x.exp_date && days(x) >= 35 && Number(x.balance) >= days(x) + 10);
    test.skip(!line, 'no well-stocked line with a batch of the right age');
    const props = line.more_props ?? {};
    await api.request('PUT', `/products/${line.id}`, { props: { ...props, chronic: true } }, MGR);

    try {
      const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
      await expectShell(page);
      await page.locator('[data-testid=sale-add-item] input').first().fill(String(line.title));
      await page.locator('.p-autocomplete-panel li').filter({ hasText: line.title }).first().click();
      const units = page.getByTestId('sale-line').first().locator('input[aria-label="Units"]');
      await expect(units).toBeVisible();

      // nothing to fill in about the supply: no column, no required field
      await expect(page.getByRole('columnheader', { name: /Supply/ })).toHaveCount(0);
      await expect(page.getByTestId('sale-supply-row')).toHaveCount(0);

      // a regular medicine needs the customer's number; then a quantity the batch cannot cover warns at Complete
      await page.locator('app-customer-select input').first().pressSequentially('9876500088');
      await page.getByTestId('sale-cust-name').fill('QA Supply Customer');
      await units.fill(String(days(line) + 5));
      await expect(page.getByTestId('sale-supply-row')).toHaveCount(0);
      await page.getByTestId('sale-complete').click();
      const warn = page.getByTestId('sale-batch-warnings');
      await expect(warn).toBeVisible();
      await expect(warn.locator('[data-warning=SHORT_DATED_FOR_SUPPLY]')).toContainText('months');
      await expect(page.getByTestId('sale-batch-sell')).toBeVisible();                       // the cashier may go ahead
      await page.getByTestId('sale-batch-change').click();
      await expect(warn).toHaveCount(0);
    } finally {
      await api.request('PUT', `/products/${line.id}`, { props }, MGR);
    }
  });
});
