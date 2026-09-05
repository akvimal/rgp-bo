/**
 * Purchase Invoices & GRN — INV-6..8   (INV-1..5 are in regression.spec.ts)
 * Source: docs/testing/manual-test-plan.html  (module "invoices")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';

async function confirmedInvoice(api: any) {
  // build a fresh approved-PO -> invoice -> GRN so INV-7 can delete it safely
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const prod = data.m.products[20].id;
  const po = await api.request('POST', '/purchaseorders', { vendorid: v }, MGR);
  const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 15, vendorid: v }, MGR);
  await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
  // approve if the current threshold routed it to approval (MGR holds the policy)
  const st = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
  if (st.body.status === 'PENDING_APPROVAL') await api.request('POST', `/purchaseorders/${po.body.id}/approve`, undefined, MGR);
  const inv = await api.request('POST', '/purchases', {
    vendorid: v, purchaseorderid: String(po.body.id), invoiceno: `QA-INV6-${po.body.id}`, invoicedate: '2026-09-04',
  }, MGR);
  const lineTotal = +(15 * 12 * 1.12).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod, qty: 15, ptrvalue: 12, ptrcost: 12, mrpcost: 20,
    taxpcnt: 12, total: lineTotal, batch: `INV6-${po.body.id}`, expdate: '2028-06-30', saleprice: 16,
  }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lineTotal } }, MGR);
  return { id: inv.body.id, vendorId: v, batch: `INV6-${po.body.id}`, productId: prod, total: lineTotal };
}

test.describe('Purchase Invoices & GRN @p1', () => {
  test('INV-6 outstanding-by-vendor totals the unpaid balances for that vendor @happy', async ({ app, api }) => {
    let all = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body;
    if (!all.length) {
      // ensure at least one outstanding invoice exists
      const inv = await confirmedInvoice(api);
      all = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body;
      void inv;
    }
    expect(all.length).toBeGreaterThan(0);
    const vendorId = all[0].vendor_id;
    const scoped = (await api.request('GET', `/purchases/outstanding?vendorid=${vendorId}`, undefined, MGR)).body;
    const sum = scoped.reduce((a: number, i: any) => a + Number(i.balance_amount), 0);
    const manual = all.filter((i: any) => i.vendor_id === vendorId).reduce((a: number, i: any) => a + Number(i.balance_amount), 0);
    expect(Math.abs(sum - manual)).toBeLessThan(0.5);
    expect(scoped.every((i: any) => i.vendor_id === vendorId)).toBeTruthy();

    const { page } = await app.open(MGR, '/secure/purchases/invoices/outstanding');
    await expectShell(page);
    await expect(page.getByTestId(TID.invRow).first()).toBeVisible();
  });

  test('INV-7 deleting a confirmed invoice reverses its stock in one transaction @edge', async ({ api }) => {
    const inv = await confirmedInvoice(api);
    const stockedBal = async () => {
      const r = await api.request('POST', '/stock/filter', { available: true, id: inv.productId }, MGR);
      return r.body.filter((x: any) => x.batch === inv.batch).reduce((a: number, x: any) => a + Number(x.balance), 0);
    };
    expect(await stockedBal()).toBeGreaterThan(0);
    const del = await api.request('DELETE', `/purchases/${inv.id}`, undefined, MGR);
    expect(del.status).toBeLessThan(400);
    // stock for that batch is gone (reversed) - never left half-applied
    expect(await stockedBal()).toBe(0);
    // and it drops off the invoice list
    const list = await api.request('GET', '/purchases?page=1&limit=200', undefined, MGR);
    const stillListed = Array.isArray(list.body?.rows ?? list.body)
      ? (list.body.rows ?? list.body).some((i: any) => i.id === inv.id)
      : false;
    expect(stillListed).toBeFalsy();
  });

  test('INV-8 "set sale price" from an invoice line resolves the batch price @happy', async ({ api }) => {
    const inv = await confirmedInvoice(api);
    // the GRN line carried saleprice:16 for this batch (issue #132)
    const set = await api.request('POST', '/purchaseitems/saleprice', { productid: String(inv.productId), batch: inv.batch }, MGR);
    expect(set.status).toBeLessThan(400);
    const row = Array.isArray(set.body) ? set.body[0] : set.body;
    expect(row).toBeTruthy();
    expect(Number(row.sale_price ?? row.saleprice)).toBeGreaterThan(0);

    // and the downstream product price feed resolves
    const prices = await api.request('GET', `/products/prices/${inv.productId}`, undefined, MGR);
    expect(prices.status).toBeLessThan(400);
    expect(prices.body).toHaveProperty('history');
  });
});
