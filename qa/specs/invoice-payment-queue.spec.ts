/**
 * Marked-for-payment invoices on the invoice list — PQ-1..6
 * Filters by when it falls due, when it was marked ready and how much; marking several at once; the payment queue grouped by vendor; and the screens:
 * the stage tabs, choosing invoices, the sticky bar, and paying the chosen ones.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
let seq = 0;
const run = Date.now() % 100000;

/** a received invoice with a vendor invoice number and a balance of 168, not yet marked ready (complete = false leaves it a draft) */
async function invoice(api: any, complete = true) {
  const n = ++seq;
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const prod = data.m.products[44].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoicedate: '2026-09-04', invoiceno: `QA-PQ-${run}-${n}`, printedtotal: 168 }, MGR);
  expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod, qty: 10, ptrvalue: 15, ptrcost: 15, mrpcost: 22, taxpcnt: 12, total: 150, batch: `PQ-${run}-${n}`, expdate: '2028-06-30', saleprice: 20,
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  if (complete) expect((await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: 168 } }, MGR)).status).toBeLessThan(300);
  return { id: inv.body.id as number, vendorid: v as number, no: `QA-PQ-${run}-${n}` };
}
const ready = (api: any, id: number, note?: string) => api.request('POST', `/purchases/${id}/payment-ready`, { note }, MGR);
const search = async (api: any, qs: string) => (await api.request('GET', `/purchases/search?limit=100&${qs}`, undefined, MGR)).body;

test.describe('Invoices marked for payment @p1', () => {
  test('PQ-1 the list filters by when it falls due, when it was marked ready, and the amount; and sorts by ready since @happy', async ({ api }) => {
    const a = await invoice(api);
    await ready(api, a.id, 'pq1');
    const v = `vendor=${a.vendorid}`;
    const ids = async (qs: string) => (await search(api, `${v}&${qs}`)).data.map((i: any) => i.id);

    expect(await ids('view=ready')).toContain(a.id);
    expect(await ids('view=ready&due=overdue')).toContain(a.id);                       // dated September: past its due date
    expect(await ids('view=ready&due=later')).not.toContain(a.id);
    const today = new Date().toISOString().slice(0, 10);
    expect(await ids(`view=ready&readyfrom=${today}`)).toContain(a.id);                // marked today
    expect(await ids('view=ready&readyto=2020-01-01')).not.toContain(a.id);
    expect(await ids('view=ready&min=168&max=168')).toContain(a.id);
    expect(await ids('view=ready&min=100000')).not.toContain(a.id);
    const sorted = await search(api, `${v}&view=ready&sort=ready_on&dir=desc`);
    expect(sorted.data[0].payment_ready).toBe(true);
    expect(sorted.data[0].ready_on).toBeTruthy();
  });

  test('PQ-2 several invoices are marked ready at once with one note; the ones that cannot are returned with the reason, and the mark can be taken back @happy', async ({ api }) => {
    const a = await invoice(api), b = await invoice(api), draft = await invoice(api, false);
    const r = await api.request('POST', '/purchases/payment-ready-bulk', { ids: [a.id, b.id, draft.id], note: 'bulk note' }, MGR);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(r.body.done).toBe(2);
    expect(r.body.skipped).toHaveLength(1);
    expect(r.body.skipped[0]).toMatchObject({ id: draft.id });
    expect(r.body.skipped[0].reason).toContain('Complete the invoice');
    const row = (await search(api, `vendor=${a.vendorid}&view=ready`)).data.find((i: any) => i.id === a.id);
    expect(row.ready_note).toBe('bulk note');

    // pay one: its mark stays; the other can be taken back
    expect((await api.request('POST', '/vendorpayments', { vendorid: b.vendorid, invoiceid: b.id, paydate: '2026-09-10', amount: 10, paymode: 'Cash' }, MGR)).status).toBeLessThan(300);
    const back = await api.request('POST', '/purchases/payment-unready-bulk', { ids: [a.id, b.id] }, MGR);
    expect(back.body.done).toBe(1);
    expect(back.body.skipped.map((x: any) => x.id)).toEqual([b.id]);
    expect((await search(api, `vendor=${a.vendorid}&view=notready`)).data.some((i: any) => i.id === a.id)).toBe(true);

    expect((await api.request('POST', '/purchases/payment-ready-bulk', { ids: [] }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/purchases/payment-ready-bulk', { ids: [a.id] }, 'role.readonly@qa.local')).status).not.toBeLessThan(400);
  });

  test('PQ-3 the payment queue lists what can be paid now, grouped by vendor with overdue first; a hold or a payment takes an invoice out @happy', async ({ api }) => {
    const a = await invoice(api), b = await invoice(api);
    await api.request('POST', '/purchases/payment-ready-bulk', { ids: [a.id, b.id] }, MGR);
    const q = (await api.request('GET', `/purchases/payment-queue?vendor=${a.vendorid}`, undefined, MGR)).body;
    expect(q.vendors).toHaveLength(1);
    const v = q.vendors[0];
    expect(v.invoices.map((i: any) => i.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(v.balance).toBeGreaterThanOrEqual(336);
    expect(v.overdue).toBeGreaterThanOrEqual(336);                                       // dated September
    expect(q.totals.count).toBe(v.count);
    expect(v.invoices.find((i: any) => i.id === a.id)).toMatchObject({ days_overdue: expect.any(Number), business_name: expect.any(String) });

    expect((await api.request('POST', `/purchases/${a.id}/hold`, { reason: 'QA hold for the queue' }, MGR)).status).toBeLessThan(300);
    const held = (await api.request('GET', `/purchases/payment-queue?vendor=${a.vendorid}`, undefined, MGR)).body;
    expect(held.vendors[0].invoices.some((i: any) => i.id === a.id)).toBe(false);
    expect((await api.request('POST', `/purchases/${a.id}/release`, {}, MGR)).status).toBeLessThan(300);

    expect((await api.request('POST', '/vendorpayments', { vendorid: b.vendorid, invoiceid: b.id, paydate: '2026-09-10', amount: 168, paymode: 'Cash' }, MGR)).status).toBeLessThan(300);
    const paid = (await api.request('GET', `/purchases/payment-queue?vendor=${a.vendorid}`, undefined, MGR)).body;
    expect(paid.vendors[0].invoices.some((i: any) => i.id === b.id)).toBe(false);
  });

  test('PQ-4 the list shows the stage tabs, and the rows to be marked can be chosen and marked together @happy', async ({ app, api }) => {
    const a = await invoice(api), b = await invoice(api);
    const { page } = await app.open(MGR, `/secure/purchases/invoices/list?view=notready&vendor=${a.vendorid}`);
    await expectShell(page);
    await expect(page.getByTestId('inv-status-tabs')).toBeVisible();
    await expect(page.getByTestId('inv-stage-notready')).toContainText('Needs marking');
    const rowA = page.locator(`[data-testid=inv-row][data-invoice=\"${a.no}\"]`);
    await expect(rowA).toBeVisible();
    await expect(rowA.getByTestId('inv-payment')).toHaveText('Needs marking');
    await rowA.getByTestId('inv-pick').check();
    await page.locator(`[data-testid=inv-row][data-invoice=\"${b.no}\"]`).getByTestId('inv-pick').check();
    await expect(page.getByTestId('inv-bulk-count')).toContainText('2 chosen');
    await page.getByTestId('inv-bulk-note').fill('checked in the UI');
    await page.getByTestId('inv-bulk-mark').click();
    await expect(page.getByTestId('inv-message')).toContainText('2 invoices marked ready for payment');
    await expect(page.locator(`[data-testid=inv-row][data-invoice=\"${a.no}\"]`)).toHaveCount(0);        // it has left Needs marking
    await page.getByTestId('inv-stage-ready').click();
    const ready1 = page.locator(`[data-testid=inv-row][data-invoice=\"${a.no}\"]`);
    await expect(ready1).toBeVisible();
    await expect(ready1.getByTestId('inv-payment')).toHaveText('Ready for payment');
    await expect(ready1.getByTestId('inv-ready-since')).toContainText('checked in the UI');
  });

  test('PQ-5 the payment queue groups by vendor, and the chosen invoices are paid in one go @happy', async ({ app, api }) => {
    const a = await invoice(api), b = await invoice(api);
    await api.request('POST', '/purchases/payment-ready-bulk', { ids: [a.id, b.id] }, MGR);
    const { page } = await app.open(MGR, `/secure/purchases/invoices/queue?vendor=${a.vendorid}`);
    await expectShell(page);
    await expect(page.getByTestId('inv-tab-queue')).toHaveClass(/active/);
    await expect(page.getByTestId('queue-vendor')).toHaveCount(1);
    const rowA = page.locator(`[data-testid=queue-row][data-invoice=\"${a.no}\"]`);
    await expect(rowA).toBeVisible();
    await rowA.getByTestId('inv-pick').check();
    await page.locator(`[data-testid=queue-row][data-invoice=\"${b.no}\"]`).getByTestId('inv-pick').check();
    await expect(page.getByTestId('inv-bulk-count')).toContainText('2 chosen');
    await page.getByTestId('inv-bulk-pay').click();
    await expect(page.getByTestId('inv-bulkpay-dialog')).toBeVisible();
    await expect(page.getByTestId('inv-bulkpay-total')).toContainText('336');
    await page.getByTestId('inv-bulkpay-ref').fill('QA-PQ-UTR');
    await page.getByTestId('inv-bulkpay-save').click();
    await expect(page.getByTestId('inv-message')).toContainText('2 invoices paid');
    await expect(page.locator(`[data-testid=queue-row][data-invoice=\"${a.no}\"]`)).toHaveCount(0);
    for (const i of [a, b]) expect(Number((await api.request('GET', `/purchases/${i.id}`, undefined, MGR)).body.paidamount)).toBeGreaterThanOrEqual(168);
  });

  test('PQ-6 a person who cannot mark or pay sees the list and the queue without the actions @negative', async ({ app }) => {
    const { page } = await app.open('sales1@local.test', '/secure/purchases/invoices/queue');
    await expect(page.getByTestId('queue-pay')).toHaveCount(0);
    await expect(page.getByTestId('inv-bulk-pay')).toHaveCount(0);
  });
});
