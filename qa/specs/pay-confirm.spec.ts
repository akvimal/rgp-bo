/**
 * Confirming a digital payment before the bill can be printed — PAYCONF-1..2
 * After a bill paid by UPI or card is completed at the till, the print page asks for the payment to be confirmed; until it is, printing is held.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const OPERATOR = { operatorId: 3, operatorName: 'Sale Staff One' };

async function ringUp(app: any, api: any, pay: 'cash' | 'digital') {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, MGR)).body;
  const line = rows.find((x: any) => x.status === 'VERIFIED' && Number(x.sale_price) > 0 && (x.more_props?.schedule ?? '') === '' && !x.more_props?.chronic && Number(x.balance) > 5);
  test.skip(!line, 'no plain stocked line');
  const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
  await expectShell(page);
  await page.locator('[data-testid=sale-add-item] input').first().fill(String(line.title));
  await page.locator('.p-autocomplete-panel li').filter({ hasText: line.title }).first().click();
  await expect(page.getByTestId('sale-line').first()).toBeVisible();
  if (pay === 'cash') await page.getByTestId('pos-pay-cash').click();
  else {
    await page.getByTestId('pos-pay-digital').click();
    // the whole bill by UPI: the digital amount is filled by the screen; no reference is needed
  }
  await page.getByTestId('sale-complete').click();
  await page.waitForURL(/\/secure\/sales\/(pos\/)?view\/\d+/);
  return page;
}

test.describe('Payment confirmation before printing @p1', () => {
  test('PAYCONF-1 a digital bill asks to confirm the payment; Print is held until it is @happy', async ({ app, api }) => {
    const page = await ringUp(app, api, 'digital');
    const dialog = page.getByTestId('pay-confirm-yes');   // the dialog's own button: the outer element has no box of its own
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('pay-confirm-amount')).toContainText('₹');
    await expect(page.getByTestId('bill-print')).toHaveClass(/disabled/);
    await page.screenshot({ path: 'report/payconf-dialog.png' });
    await page.getByTestId('pay-confirm-yes').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('bill-print')).not.toHaveClass(/disabled/);
    await page.screenshot({ path: 'report/payconf-confirmed.png' });
  });

  test('PAYCONF-2 a cash bill is not asked and prints at once @happy', async ({ app, api }) => {
    const page = await ringUp(app, api, 'cash');
    await expect(page.getByTestId('pay-confirm-yes')).toHaveCount(0);
    await expect(page.getByTestId('bill-print')).not.toHaveClass(/disabled/);
  });
});
