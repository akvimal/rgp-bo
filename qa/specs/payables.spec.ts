/**
 * Vendor Payables (WS-2, docs/planning/PURCHASING_PAYABLES_GST_PROGRAM.md)
 * New feature, not part of the original 120-case manual-test-plan.html.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';

async function completedInvoice(api: any, tag: string) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const prod = data.m.products[40].id;
  const po = await api.request('POST', '/purchaseorders', { vendorid: v }, MGR);
  const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 10, vendorid: v }, MGR);
  await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
  const st = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
  if (st.body.status === 'PENDING_APPROVAL') await api.request('POST', `/purchaseorders/${po.body.id}/approve`, undefined, MGR);
  const inv = await api.request('POST', '/purchases', {
    vendorid: v, purchaseorderid: String(po.body.id), invoiceno: `QA-PAY-${tag}-${po.body.id}`, invoicedate: '2026-07-01',
  }, MGR);
  const lineTotal = +(10 * 15 * 1.12).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod, qty: 10, ptrvalue: 15, ptrcost: 15, mrpcost: 22,
    taxpcnt: 12, total: lineTotal, batch: `PAY-${tag}-${po.body.id}`, expdate: '2028-06-30', saleprice: 20,
  }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lineTotal } }, MGR);
  return { id: inv.body.id, vendorid: v, total: lineTotal };
}

test.describe('Vendor Payables @p1', () => {
  test('PAYABLES-NAV the Payables screen is reachable and lists a vendor with a balance @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/purchases/payables');
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'Purchase' })).toBeVisible();
    await expect(page.getByTestId('payables-row').first()).toBeVisible();
  });

  test('PAYABLES-SUMMARY the vendor rollup totals match the sum of that vendor\'s outstanding invoices @happy', async ({ api }) => {
    const inv = await completedInvoice(api, 'sum');
    const summary = (await api.request('GET', '/purchases/payables', undefined, MGR)).body;
    const row = summary.find((v: any) => v.vendor_id === inv.vendorid);
    expect(row, 'vendor appears in the payables rollup').toBeTruthy();

    const outstanding = (await api.request('GET', `/purchases/outstanding?vendorid=${inv.vendorid}`, undefined, MGR)).body;
    const manualTotal = outstanding.reduce((a: number, o: any) => a + Number(o.balance_amount), 0);
    expect(Math.abs(row.total_outstanding - manualTotal)).toBeLessThan(0.5);
    expect(row.invoice_count).toBe(outstanding.length);
  });

  test('PAYRUN-SPLIT a pay run splits one payment across two invoices, oldest first @happy', async ({ api }) => {
    const a = await completedInvoice(api, 'r1');
    const b = await completedInvoice(api, 'r2');
    expect(a.vendorid).toBe(b.vendorid); // both invoices land on vendor[0] -> same vendor, splittable

    const payA = 50;
    const payB = 30;
    const batch = await api.request('POST', '/vendorpayments/batch', {
      vendorid: a.vendorid, paydate: '2026-09-04', paymode: 'Transfer', transref: 'QA-BATCH',
      allocations: [{ invoiceid: a.id, amount: payA }, { invoiceid: b.id, amount: payB }],
    }, MGR);
    expect(batch.status).toBeLessThan(300);
    expect(batch.body.count).toBe(2);
    expect(Math.abs(batch.body.total - (payA + payB))).toBeLessThan(0.01);
    expect(batch.body.batchref).toBeTruthy();
    expect(batch.body.payments.every((p: any) => p.batchref === batch.body.batchref)).toBeTruthy();

    const invA = await api.request('GET', `/purchases/${a.id}`, undefined, MGR);
    const invB = await api.request('GET', `/purchases/${b.id}`, undefined, MGR);
    expect(Math.abs(Number(invA.body.paidamount) - payA)).toBeLessThan(0.01);
    expect(Math.abs(Number(invB.body.paidamount) - payB)).toBeLessThan(0.01);
  });

  test('PAYRUN-ATOMIC a pay run with one invalid line commits nothing @negative', async ({ api }) => {
    const inv = await completedInvoice(api, 'atomic');
    const before = await api.request('GET', `/purchases/${inv.id}`, undefined, MGR);
    expect(Number(before.body.paidamount || 0)).toBe(0);

    const batch = await api.request('POST', '/vendorpayments/batch', {
      vendorid: inv.vendorid, paydate: '2026-09-04', paymode: 'Cash',
      allocations: [{ invoiceid: inv.id, amount: 10 }, { invoiceid: inv.id, amount: 999999 }],
    }, MGR);
    expect(batch.status).toBe(400);

    const after = await api.request('GET', `/purchases/${inv.id}`, undefined, MGR);
    expect(Number(after.body.paidamount || 0)).toBe(0); // the valid first line was rolled back too
  });
});
