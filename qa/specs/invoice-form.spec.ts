/**
 * The purchase invoice header form — PINVF-1..3
 * Vendor, invoice number, date and the total printed on the invoice; a double entry is caught; the lines are checked against
 * the printed total on the next page; a received invoice keeps what was received.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function vendorId(api: any) {
  return (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0].id;
}

test.describe('Purchase invoice header form @p1', () => {
  test('PINVF-1 the printed total and invoice copy are kept; a double entry is refused with the GRN @edge', async ({ api }) => {
    const vendor = await vendorId(api);
    const no = `QA/F-${Date.now()}`;
    const made = await api.request('POST', '/purchases', { vendorid: vendor, invoiceno: no, invoicedate: '2026-09-04', printedtotal: 1180.5, documentpath: '/app/upload/x.pdf' }, MGR);
    expect(made.status).toBeLessThan(300);
    const got = (await api.request('GET', `/purchases/${made.body.id}`, undefined, MGR)).body;
    expect(got.printedtotal).toBe(1180.5);
    expect(got.documentpath).toBe('/app/upload/x.pdf');
    expect(got.invoiceno).toBe(no);                                                                    // a slash is a normal part of an invoice number

    const again = await api.request('POST', '/purchases', { vendorid: vendor, invoiceno: no.toLowerCase(), invoicedate: '2026-09-04' }, MGR);
    expect(again.status).toBe(400);
    expect(JSON.stringify(again.body)).toContain('already entered');

    const other = await api.request('POST', '/purchases', { vendorid: vendor, invoiceno: `${no}-B`, invoicedate: '2026-09-04' }, MGR);
    expect(other.status).toBeLessThan(300);
    const clash = await api.request('POST', '/purchases', { id: other.body.id, invoiceno: no, vendorid: vendor }, MGR);   // renaming onto an existing one
    expect(clash.status).toBe(400);
    expect((await api.request('POST', '/purchases', { id: other.body.id, invoiceno: `${no}-C`, vendorid: vendor }, MGR)).status).toBeLessThan(300);

    for (const id of [made.body.id, other.body.id]) await api.request('DELETE', `/purchases/${id}`, undefined, MGR);
  });

  test('PINVF-2 the form: required fields are named, a double entry is flagged, saving opens the lines page that checks the total @happy', async ({ app, api }) => {
    const vendor = await vendorId(api);
    const taken = `QA/DUP-${Date.now()}`;
    const first = await api.request('POST', '/purchases', { vendorid: vendor, invoiceno: taken, invoicedate: '2026-09-04', printedtotal: 100 }, MGR);

    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    await expect(page.getByTestId('inv-f-hint')).toContainText('vendor');
    await expect(page.getByTestId('inv-f-save')).toBeDisabled();

    await page.getByTestId('inv-f-vendor').selectOption(String(vendor));
    await page.getByTestId('inv-f-no').fill(taken);
    await page.getByTestId('inv-f-no').blur();
    await expect(page.getByTestId('inv-f-dup')).toBeVisible();                                         // already entered
    await page.getByTestId('inv-f-no').fill(`QA/NEW-${Date.now()}`);
    await page.getByTestId('inv-f-no').blur();
    await expect(page.getByTestId('inv-f-dup')).toHaveCount(0);
    await expect(page.getByTestId('inv-f-hint')).toContainText('invoice total');
    await page.getByTestId('inv-f-total').fill('1000');
    await expect(page.getByTestId('inv-f-save')).toBeEnabled();
    await expect(page.getByTestId('inv-f-due-text')).toContainText('terms');

    await page.getByTestId('inv-f-file').setInputFiles({ name: 'inv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
    await expect(page.getByTestId('inv-f-file-ok')).toBeVisible();
    await page.getByTestId('inv-f-save').click();
    await expect(page).toHaveURL(/invoices\/items\/\d+/);

    // no lines yet: the page says the lines are short of the printed total
    await expect(page.getByTestId('invoice-check-diff')).toContainText('1,000.00');
    await expect(page.getByTestId('invoice-copy')).toBeVisible();
    await expect(page.getByTestId('invoice-no-items')).toContainText('delete this draft');
    const id = Number(page.url().split('/').pop());
    const item = await api.request('POST', '/purchaseitems', {
      invoiceid: id, productid: (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body[0]?.id, qty: 10, ptrvalue: 100, ptrcost: 100, mrpcost: 150,
      taxpcnt: 0, total: 1000, batch: `F${Date.now()}`.slice(0, 12), expdate: '2028-06-30',
    }, MGR);
    if (item.status < 300) {
      await page.reload();
      await expect(page.getByTestId('invoice-check-ok')).toBeVisible();
    }
    await api.request('DELETE', `/purchases/${id}`, undefined, MGR);
    await api.request('DELETE', `/purchases/${first.body.id}`, undefined, MGR);
  });

  test('PINVF-3 a received invoice shows its lines and locks the header @edge', async ({ app, api }) => {
    const vendor = await vendorId(api);
    const inv = await api.request('POST', '/purchases', { vendorid: vendor, invoiceno: `QA/R-${Date.now()}`, invoicedate: '2026-09-04', printedtotal: 112 }, MGR);
    const stock = (await api.request('POST', '/stock/filter', { available: true, limit: 5 }, MGR)).body;
    const productid = stock[0]?.id;
    test.skip(!productid, 'no product to receive');
    const it = await api.request('POST', '/purchaseitems', {
      invoiceid: inv.body.id, productid, qty: 5, ptrvalue: 20, ptrcost: 20, mrpcost: 30, taxpcnt: 12, total: 112,
      batch: `R${Date.now()}`.slice(0, 12), expdate: '2028-06-30', saleprice: 25,
    }, MGR);
    expect(it.status).toBeLessThan(300);
    await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
    await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);

    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${inv.body.id}`);
    await expect(page.getByTestId('invoice-no-items')).toHaveCount(0);                                  // the received lines are shown, not hidden
    await expect(page.locator('p-table tbody tr')).toHaveCount(1);
    await page.getByTestId('invoice-edit').click();
    await expect(page.getByTestId('inv-f-locked')).toBeVisible();
    await expect(page.getByTestId('inv-f-no')).toBeDisabled();
    await expect(page.getByTestId('inv-f-vendor')).toBeDisabled();
    await expect(page.getByTestId('inv-f-notes')).toHaveCount(0);                                       // under "More"
    await page.getByTestId('inv-f-more').click();
    await expect(page.getByTestId('inv-f-notes')).toBeEnabled();
    await api.request('DELETE', `/purchases/${inv.body.id}`, undefined, MGR);                         // reverses the stock it added
  });
});
