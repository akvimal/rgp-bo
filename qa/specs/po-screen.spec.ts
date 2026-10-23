/**
 * The purchase order list and its detail - POUI-1..3
 * Plain status names, filters above the list, one grid look, an order that can be edited while it is a draft (details, quantities,
 * delete) and is locked once submitted, with rate and value per line.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function draftWithItem(api: any, qty = 5) {
  const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
  const prod = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body[0];
  const po = await api.request('POST', '/purchaseorders', { vendorid: vendor.id, comments: 'QA draft' }, MGR);
  expect(po.status).toBeLessThan(300);
  const rq = await api.request('POST', '/purchaserequests', { productid: prod.id, qty, vendorid: vendor.id, status: 'Open' }, MGR);
  expect(rq.status).toBeLessThan(300);
  expect((await api.request('PUT', `/purchaserequests/${rq.body.id}`, { orderid: po.body.id }, MGR)).status).toBeLessThan(300);
  return { po: po.body.id as number, req: rq.body.id as number, vendor: vendor.name as string, title: prod.title as string };
}

test.describe('Purchase order screens @p1', () => {
  test('POUI-1 the list uses plain status names, the toolbar sits above the list, and a row opens its order @happy', async ({ api, app }) => {
    const d = await draftWithItem(api);
    const { page } = await app.open(MGR, '/secure/purchases/orders');
    await page.getByRole('tab', { name: 'Orders' }).click();
    const row = page.locator(`[data-po-id="${d.po}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('po-status')).toHaveText('Draft');                            // not PENDING
    await expect(row).toHaveAttribute('data-po-status', 'PENDING');                            // the stored word is unchanged
    const heads = (await page.locator('[data-testid=po-row]').first().locator('xpath=ancestor::p-table').locator('thead th').allInnerTexts()).map((t) => t.trim());
    expect(heads).toEqual(['PO No.', 'Vendor', 'Date', 'Expected', 'Lines', 'Value', 'Status']);
    const opts = (await page.getByTestId('po-status-filter').locator('option').allInnerTexts()).map((t) => t.trim());
    expect(opts).toEqual(['All status', 'Draft', 'Awaiting approval', 'Submitted', 'Rejected']);
    await expect(page.getByTestId('po-search')).toBeVisible();
    const bar = (await page.getByTestId('po-create').boundingBox())!;
    const table = (await page.locator('[data-testid=po-row]').first().locator('xpath=ancestor::p-table').boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(table.y + 2);                              // above the list it controls
    expect(Math.abs(bar.x - table.x)).toBeLessThan(40);                                         // and in line with it
    await page.getByTestId('po-status-filter').selectOption('PENDING_APPROVAL');
    await expect(row).toHaveCount(0);
    await page.getByTestId('po-status-filter').selectOption('PENDING');
    await expect(row).toBeVisible();
    await row.locator('td').nth(1).click();                                                    // anywhere on the row, not only the number
    await expect(page).toHaveURL(new RegExp(`/secure/purchases/orders/${d.po}$`));
    await expect(page.getByTestId('po-detail-status')).toHaveText('Draft');
    await page.getByTestId('po-close').click();
    await expect(page).toHaveURL(/\/secure\/purchases\/orders$/);
    await expect(page.getByTestId('po-detail')).toHaveCount(0);
    await expect(row).toBeVisible();                                                           // still on the Orders tab, not thrown back to Requests
  });

  test('POUI-2 a draft shows rate and value per line, its quantity can be changed, its details edited, and it can be deleted @happy', async ({ api, app }) => {
    const d = await draftWithItem(api, 5);
    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    const detail = page.getByTestId('po-detail');
    await expect(detail).toContainText(`PO No. ${d.po}`);
    await expect(detail).toContainText(d.vendor);
    await expect(page.getByTestId('po-add-request')).toHaveText(/Add items/);
    await expect(page.getByTestId('po-proceed')).toHaveText(/Submit/);
    await expect(page.getByTestId('po-download')).toContainText('Download PDF');
    const heads = (await page.getByTestId('po-fulfilment').locator('thead th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(heads).toEqual(['Product', 'Pack', 'Rate', 'Ordered', 'Value', 'Invoiced', 'Received']);
    await expect(page.getByTestId('po-totals')).toBeVisible();

    const qty = page.getByTestId('po-qty').first();
    await expect(qty).toHaveValue('5');
    await qty.fill('8');
    await qty.blur();
    await expect.poll(async () => ((await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.requests[0].orderedqty)).toBe(8);
    await expect(page.getByTestId('po-totals')).toContainText('8');
    await qty.fill('0');
    await qty.blur();
    await expect(page.getByTestId('po-error')).toContainText('at least 1');
    await expect(qty).toHaveValue('8');

    await page.getByTestId('po-edit').click();
    await page.getByTestId('po-e-date').fill('2030-01-15');
    await page.getByTestId('po-e-comments').fill('QA changed note');
    await page.getByTestId('po-e-save').click();
    await expect(page.getByTestId('po-facts')).toContainText('15 Jan 2030');
    await expect(page.getByTestId('po-facts')).toContainText('QA changed note');
    const after = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body;
    expect(String(after.expecteddate)).toContain('2030-01-15');
    await page.getByTestId('po-close').click();
    await expect(page.locator(`[data-po-id="${d.po}"]`)).toContainText('15 Jan 2030');           // the list caught up with the change
    await page.locator(`[data-po-id="${d.po}"]`).locator('td').nth(1).click();
    await expect(page.getByTestId('po-detail')).toBeVisible();

    await page.getByTestId('po-delete').click();
    await page.getByRole('button', { name: /^(Delete|Yes)/ }).last().click();
    await expect(page).toHaveURL(/\/secure\/purchases\/orders$/);
    await expect(page.locator(`[data-po-id="${d.po}"]`)).toHaveCount(0);
  });

  test('POUI-3 once submitted, the order shows as Submitted and its quantities and details are locked @edge', async ({ api, app }) => {
    const d = await draftWithItem(api, 3);
    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.po}`);
    await page.getByTestId('po-proceed').click();
    await expect(page.getByTestId('po-detail-status')).not.toHaveText('Draft');
    const st = (await api.request('GET', `/purchaseorders/${d.po}`, undefined, MGR)).body.status;
    await expect(page.locator(`[data-po-id="${d.po}"]`)).toHaveAttribute('data-po-status', st);   // the list was refreshed, not left showing a draft
    if (st === 'SUBMITTED') await expect(page.locator(`[data-po-id="${d.po}"]`).getByTestId('po-status')).toHaveText('Submitted');
    await expect(page.getByTestId('po-qty')).toHaveCount(0);
    await expect(page.getByTestId('po-edit')).toHaveCount(0);
    await expect(page.getByTestId('po-delete')).toHaveCount(0);
    await expect(page.getByTestId('po-add-request')).toHaveCount(0);
    const locked = await api.request('PUT', `/purchaserequests/${d.req}`, { orderedqty: 9 }, MGR);
    expect(locked.status).toBe(400);                                                           // and the server holds it too
    expect(JSON.stringify(locked.body)).toContain('cannot be changed');
    expect((await api.request('DELETE', `/purchaseorders/${d.po}`, undefined, MGR)).status).toBe(400);
  });
});
