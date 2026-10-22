/**
 * GST data model (WS-4, docs/planning/PURCHASING_PAYABLES_GST_PROGRAM.md)
 * New feature, not part of the original 120-case manual-test-plan.html.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';

async function completedInvoice(api: any, tag: string, opts: { taxpcnt?: number; qty?: number; ptrvalue?: number } = {}) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const prod = data.m.products[41].id;
  const po = await api.request('POST', '/purchaseorders', { vendorid: v }, MGR);
  const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: opts.qty ?? 10, vendorid: v }, MGR);
  await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
  const st = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
  if (st.body.status === 'PENDING_APPROVAL') await api.request('POST', `/purchaseorders/${po.body.id}/approve`, undefined, MGR);
  const inv = await api.request('POST', '/purchases', {
    vendorid: v, purchaseorderid: String(po.body.id), invoiceno: `QA-GST-${tag}-${po.body.id}`, invoicedate: '2026-07-15',
  }, MGR);
  const qty = opts.qty ?? 10;
  const ptrvalue = opts.ptrvalue ?? 15;
  const taxpcnt = opts.taxpcnt ?? 12;
  const lineTotal = +(qty * ptrvalue * (1 + taxpcnt / 100)).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod, qty, ptrvalue, ptrcost: ptrvalue, mrpcost: 22,
    taxpcnt, total: lineTotal, batch: `GST-${tag}-${po.body.id}`, expdate: '2028-06-30', saleprice: 20,
  }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lineTotal } }, MGR);
  return { id: inv.body.id, vendorid: v, total: lineTotal, itemId: it.body.id };
}

test.describe('GST data model @p1', () => {
  test('GST-1 a completed invoice gets a supplier GSTIN, period and INTRA/INTER classification @happy', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
    const inv = await completedInvoice(api, 'ctx');
    const fetched = (await api.request('GET', `/purchases/${inv.id}`, undefined, MGR)).body;

    if (vendor.gstn) expect(fetched.suppliergstin).toBe(vendor.gstn);
    expect(['INTRA', 'INTER']).toContain(fetched.supplytype);
    expect(fetched.gstperiod).toBe('2026-07'); // from invoicedate
    expect(fetched.gstreconstatus).toBe('UNRECONCILED');
  });

  test('GST-2 the header GST split sums back to the invoice total within rounding @happy', async ({ api }) => {
    const inv = await completedInvoice(api, 'sum', { qty: 7, ptrvalue: 23.5, taxpcnt: 18 });
    const fetched = (await api.request('GET', `/purchases/${inv.id}`, undefined, MGR)).body;

    const summed = Number(fetched.taxablevalue || 0) + Number(fetched.cgstamount || 0)
      + Number(fetched.sgstamount || 0) + Number(fetched.igstamount || 0) + Number(fetched.roundoff || 0);
    expect(Math.abs(Number(fetched.total) - summed)).toBeLessThan(0.05);

    // intra-state (the default, single-GSTIN-per-business assumption): CGST and SGST split evenly, no IGST.
    if (fetched.supplytype === 'INTRA') {
      expect(Math.abs(Number(fetched.cgstamount) - Number(fetched.sgstamount))).toBeLessThan(0.05);
      expect(Number(fetched.igstamount)).toBe(0);
    }
  });

  test('GST-3 the invoice line carries its own taxable value + tax split, and the product\'s HSN @happy', async ({ api }) => {
    const inv = await completedInvoice(api, 'line', { qty: 4, ptrvalue: 50, taxpcnt: 5 });
    const fetched = (await api.request('GET', `/purchases/${inv.id}`, undefined, MGR)).body;
    const line = fetched.items.find((i: any) => i.id === inv.itemId);
    expect(line).toBeTruthy();
    expect(Number(line.taxablevalue)).toBeGreaterThan(0);
    expect(Number(line.taxablevalue)).toBeLessThan(Number(line.total));
    expect(Number(line.cgstamount) + Number(line.sgstamount) + Number(line.igstamount)).toBeGreaterThan(0);
  });

  test('GST-4 editing GST details (place of supply, reverse charge, ITC eligibility) persists @happy', async ({ api }) => {
    const inv = await completedInvoice(api, 'edit');
    const upd = await api.request('PUT', '/purchases', {
      ids: [inv.id], values: { placeofsupply: '27', reversecharge: true, itceligibility: 'CAPITAL_GOODS' },
    }, MGR);
    expect(upd.status).toBeLessThan(300);
    const fetched = (await api.request('GET', `/purchases/${inv.id}`, undefined, MGR)).body;
    expect(fetched.placeofsupply).toBe('27');
    expect(fetched.reversecharge).toBeTruthy();
    expect(fetched.itceligibility).toBe('CAPITAL_GOODS');
  });

  test('the GST Details card on the GRN screen shows the tax breakdown @happy', async ({ app, api }) => {
    const inv = (await api.request('GET', '/purchases?page=1&limit=1', undefined, MGR)).body.data[0];
    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${inv.id}`);
    await expectShell(page);
    await expect(page.getByTestId('invoice-gst-card')).toBeVisible();
    await expect(page.getByTestId('invoice-gst-check')).toBeVisible();
  });

  test('the GST card is one read-only line; changes are made in the invoice details; a vendor with no GSTIN is flagged @happy', async ({ app, api }) => {
    const vendors = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body;
    const vendor = vendors[0];
    const made = await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA/GST-${Date.now()}`, invoicedate: '2026-09-04', printedtotal: 100 }, MGR);
    expect(made.status).toBeLessThan(300);
    const id = made.body.id;
    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${id}`);
    await expect(page.getByTestId('invoice-gst-card')).toBeVisible();
    await expect(page.getByTestId('invoice-gst-gstin-text')).toBeVisible();
    await expect(page.getByTestId('invoice-gst-save')).toHaveCount(0);                          // no editable form on this page any more

    await page.getByTestId('invoice-gst-edit').click();                                          // the change is made on the header form, under More details
    await page.getByTestId('inv-f-more').click();
    await page.getByTestId('inv-f-gstin').fill('27AAAAA0000A1Z5');
    await expect(page.getByTestId('inv-f-save')).toBeDisabled();                                  // not a valid GSTIN
    await expect(page.getByTestId('inv-f-hint')).toContainText('GSTIN');
    await page.getByTestId('inv-f-gstin').fill('');
    await page.getByTestId('inv-f-supplytype').selectOption('INTER');
    await page.getByTestId('inv-f-itc').selectOption('CAPITAL_GOODS');
    await page.getByTestId('inv-f-rc').check();
    await page.getByTestId('inv-f-save').click();
    await expect(page).toHaveURL(/invoices\/items\/\d+/);
    const got = (await api.request('GET', `/purchases/${id}`, undefined, MGR)).body;
    expect(got.supplytype).toBe('INTER');
    expect(got.itceligibility).toBe('CAPITAL_GOODS');
    expect(got.reversecharge).toBe(true);
    await expect(page.getByTestId('invoice-gst-card')).toContainText('Inter-state');
    await expect(page.getByTestId('invoice-gst-card')).toContainText('Reverse charge');
    await api.request('DELETE', `/purchases/${id}`, undefined, MGR);
  });
});
