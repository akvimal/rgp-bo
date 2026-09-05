/**
 * Vendors — VEND-1..4
 * Source: docs/testing/manual-test-plan.html  (module "vendors")
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';

test.describe('Vendors @p1', () => {
  test('VEND-1 a new vendor is saved and selectable on a Purchase Order @happy', async ({ app, api }) => {
    const name = `QA Vendor ${Date.now()}`;
    const { page } = await app.open(MGR, '/secure/purchases/vendors/new');
    await expectShell(page);
    await page.getByTestId(TID.vendorFName).fill(name);
    await page.getByTestId(TID.vendorFGstn).fill('29ABCDE1234F1Z5');
    await page.getByTestId(TID.vendorFContact).fill('QA Contact');
    await page.getByTestId(TID.vendorFPhone).fill('9812345678');
    await expect(page.getByTestId(TID.vendorFSubmit)).toBeEnabled();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/vendors') && r.request().method() === 'POST'),
      page.getByTestId(TID.vendorFSubmit).click(),
    ]);
    expect(resp.status()).toBeLessThan(400);

    await expect.poll(async () =>
      (await api.request('GET', '/vendors', undefined, MGR)).body.some((v: any) => v.name === name),
    ).toBeTruthy();
  });

  test('VEND-2 a duplicate vendor - confirm the actual behaviour @negative', async ({ api }) => {
    const existing = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
    const dup = await api.request('POST', '/vendors', {
      name: existing.name, contactname: 'x', contactphone: '9000000000', address: 'x', gstn: existing.gstn, comments: '',
    }, MGR);
    // the plan leaves warn-vs-block undecided; record what the API actually does
    const behaviour = dup.status === 409 || dup.status >= 400 ? 'blocked' : 'allowed (created a second vendor)';
    test.info().annotations.push({ type: 'finding', description: `VEND-2: a duplicate vendor name/GST is ${behaviour} (HTTP ${dup.status})` });
    expect(dup.status).toBeLessThan(500);
  });

  test('VEND-3 a deactivated vendor drops off new orders but stays on history @edge', async ({ api }) => {
    const v = await api.request('POST', '/vendors', {
      name: `QA Deac ${Date.now()}`, contactname: 'x', contactphone: '9000000001', address: 'x', gstn: '29AAAAA0000A1Z1', comments: '',
    }, MGR);
    const id = v.body.id;
    // put it on a PO first (history)
    const po = await api.request('POST', '/purchaseorders', { vendorid: id }, MGR);
    await api.request('DELETE', `/vendors/${id}`, undefined, MGR);

    const active = await api.request('GET', '/vendors', undefined, MGR);
    expect(active.body.some((x: any) => x.id === id)).toBeFalsy(); // gone from the pick list
    const histPo = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
    expect(histPo.body.vendorid).toBe(id); // still referenced on the old order
  });

  test('VEND-4 recording a payment drops the outstanding balance by exactly the amount @happy', async ({ api }) => {
    let outstanding = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body
      .find((i: any) => Number(i.balance_amount) > 200);
    if (!outstanding) {
      // create one: fresh approved-PO -> GRN with a real total, unpaid
      const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
      const prod = data.m.products[30].id;
      const po = await api.request('POST', '/purchaseorders', { vendorid: v }, MGR);
      const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 15, vendorid: v }, MGR);
      await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
      await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
      const st = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
      if (st.body.status === 'PENDING_APPROVAL') await api.request('POST', `/purchaseorders/${po.body.id}/approve`, undefined, MGR);
      const inv = await api.request('POST', '/purchases', { vendorid: v, purchaseorderid: String(po.body.id), invoiceno: `QA-V4-${po.body.id}`, invoicedate: '2026-09-04' }, MGR);
      const lt = +(15 * 20 * 1.12).toFixed(2);
      const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod, qty: 15, ptrvalue: 20, ptrcost: 20, mrpcost: 30, taxpcnt: 12, total: lt, batch: `V4-${po.body.id}`, expdate: '2028-06-30', saleprice: 26 }, MGR);
      await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
      await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lt } }, MGR);
      outstanding = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body.find((i: any) => i.id === inv.body.id);
    }
    expect(outstanding, 'an invoice with a balance').toBeTruthy();
    const before = Number(outstanding.balance_amount);
    const amount = 150;

    const pay = await api.request('POST', '/vendorpayments', {
      vendorid: outstanding.vendor_id, invoiceid: outstanding.id,
      paydate: '2026-09-04', amount, paymode: 'Transfer',
    }, MGR);
    expect([200, 201]).toContain(pay.status);

    const inv = await api.request('GET', `/purchases/${outstanding.id}`, undefined, MGR);
    expect(Math.abs((before - Number(inv.body.balanceamount)) - amount)).toBeLessThan(0.5);
  });

  test('VEND-4b partial then clearing payments track the running balance @edge', async ({ api }) => {
    const inv = (await api.request('GET', '/purchases/outstanding', undefined, MGR)).body
      .find((i: any) => Number(i.balance_amount) > 50);
    test.skip(!inv, 'no outstanding invoice with a usable balance');
    const bal = Number(inv.balance_amount);
    const half = Math.floor(bal / 2);

    await api.request('POST', '/vendorpayments', { vendorid: inv.vendor_id, invoiceid: inv.id, paydate: '2026-09-04', amount: half, paymode: 'Transfer' }, MGR);
    let cur = await api.request('GET', `/purchases/${inv.id}`, undefined, MGR);
    expect(Math.abs(Number(cur.body.balanceamount) - (bal - half))).toBeLessThan(1);

    await api.request('POST', '/vendorpayments', { vendorid: inv.vendor_id, invoiceid: inv.id, paydate: '2026-09-04', amount: bal - half, paymode: 'Cash' }, MGR);
    cur = await api.request('GET', `/purchases/${inv.id}`, undefined, MGR);
    expect(Number(cur.body.balanceamount)).toBeLessThanOrEqual(0.5);
    expect(String(cur.body.paymentstatus).toLowerCase()).toContain('paid');
  });
});
