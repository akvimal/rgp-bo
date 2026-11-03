/**
 * Cancelling (voiding) a purchase order that was sent - POC-1..4
 * A submitted order, one waiting for approval or one turned down can be cancelled as long as no purchase invoice is linked to it;
 * a draft is deleted instead. The order stays on record as CANCELLED and its items are free to order again.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const run = Date.now().toString().slice(-7);
let n = 0;

async function vendor(api: any) { return (await api.request('GET', '/vendors', undefined, MGR)).body[0].id as number; }

/** a product with an open Urgent request, put on a new draft order through Reorder */
async function draft(api: any) {
  const v = await vendor(api);
  const tag = `${run}${++n}`;
  const prod = await api.request('POST', '/products', { title: `QA POCANCEL ${tag}`, taxpcnt: 12, category: 'Analgesic', code: `PC${tag}`, pack: 1, props: {} }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const req = await api.request('POST', '/purchaserequests', { productid: prod.body.id, qty: 12, vendorid: v, priority: 'Urgent' }, MGR);
  const s = ((await api.request('GET', '/purchase-suggestions?includezero=true', undefined, MGR)).body as any[]).find((x) => x.product_id === prod.body.id);
  const made = await api.request('POST', '/purchase-suggestions/create-orders', {
    items: [{ productid: prod.body.id, vendorid: v, finalqty: s.final_qty, trendqty: s.trend_qty, adhocqty: s.adhoc_qty, requestids: s.request_ids, reasonsummary: s.reason_summary }] }, MGR);
  expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
  return { orderId: made.body.orders[0].id as number, productid: prod.body.id as number, requestid: req.body.id as number, vendorid: v };
}
/** sent: submitted, and approved if it had to wait for approval */
async function sent(api: any) {
  const d = await draft(api);
  expect((await api.request('POST', `/purchaseorders/${d.orderId}/submit`, undefined, MGR)).status).toBeLessThan(300);
  let po = (await api.request('GET', `/purchaseorders/${d.orderId}`, undefined, MGR)).body;
  if (po.status === 'PENDING_APPROVAL') {
    expect((await api.request('POST', `/purchaseorders/${d.orderId}/approve`, undefined, MGR)).status).toBeLessThan(300);
    po = (await api.request('GET', `/purchaseorders/${d.orderId}`, undefined, MGR)).body;
  }
  expect(po.status).toBe('SUBMITTED');
  return d;
}
const order = async (api: any, id: number) => (await api.request('GET', `/purchaseorders/${id}`, undefined, MGR)).body;

test.describe('Cancel a sent purchase order @p1', () => {
  test('POC-1 a sent order is cancelled with a reason: it stays as CANCELLED and its request is Open again @happy', async ({ api }) => {
    const d = await sent(api);
    const noReason = await api.request('POST', `/purchaseorders/${d.orderId}/cancel`, { reason: ' ' }, MGR);
    expect(noReason.status).toBe(400);
    expect(noReason.body.message).toContain('why');

    const res = await api.request('POST', `/purchaseorders/${d.orderId}/cancel`, { reason: 'ordered by mistake' }, MGR);
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
    const po = await order(api, d.orderId);
    expect(po.status).toBe('CANCELLED');
    expect(po.cancelreason).toBe('ordered by mistake');
    expect(po.cancelledon).toBeTruthy();
    const list = (await api.request('GET', '/purchaseorders?status=CANCELLED', undefined, MGR)).body as any[];
    expect(list.some((o) => o.id === d.orderId)).toBe(true);

    const r = (await api.request('GET', `/purchaserequests/${d.requestid}`, undefined, MGR)).body;
    expect(r.status).toBe('Open');
    expect(r.orderid ?? null).toBeNull();
    const back = ((await api.request('GET', '/purchase-suggestions?includezero=true', undefined, MGR)).body as any[]).find((x) => x.product_id === d.productid);
    expect(back.on_order_qty).toBe(0);                                       // no longer counted as on order

    const again = await api.request('POST', `/purchaseorders/${d.orderId}/cancel`, { reason: 'again' }, MGR);
    expect(again.status).toBe(400);
    expect(again.body.message).toContain('already cancelled');
  });

  test('POC-2 an order with a purchase invoice linked cannot be cancelled @negative', async ({ api }) => {
    const d = await sent(api);
    const inv = await api.request('POST', '/purchases', { vendorid: d.vendorid, purchaseorderid: String(d.orderId), invoiceno: `QA-POC-${run}${n}`, invoicedate: new Date().toISOString().slice(0, 10) }, MGR);
    expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
    const res = await api.request('POST', `/purchaseorders/${d.orderId}/cancel`, { reason: 'too late' }, MGR);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('purchase invoice is linked');
    expect((await order(api, d.orderId)).status).toBe('SUBMITTED');
  });

  test('POC-3 a draft is deleted, not cancelled; a cancelled order cannot be approved or invoiced @edge', async ({ api }) => {
    const dr = await draft(api);
    const asDraft = await api.request('POST', `/purchaseorders/${dr.orderId}/cancel`, { reason: 'draft' }, MGR);
    expect(asDraft.status).toBe(400);
    expect(asDraft.body.message).toContain('deleted');

    const d = await sent(api);
    expect((await api.request('POST', `/purchaseorders/${d.orderId}/cancel`, { reason: 'changed my mind' }, MGR)).status).toBeLessThan(300);
    const approve = await api.request('POST', `/purchaseorders/${d.orderId}/approve`, undefined, MGR);
    expect(approve.status).toBeGreaterThanOrEqual(400);
    expect((await order(api, d.orderId)).status).toBe('CANCELLED');
    const inv = await api.request('POST', '/purchases', { vendorid: d.vendorid, purchaseorderid: String(d.orderId), invoiceno: `QA-POC2-${run}${n}`, invoicedate: new Date().toISOString().slice(0, 10) }, MGR);
    expect(inv.status).toBeGreaterThanOrEqual(400);
  });

  test('POC-4 on the order: Cancel order asks why, then shows it as cancelled @happy', async ({ app, api }) => {
    const d = await sent(api);
    const { page } = await app.open(MGR, `/secure/purchases/orders/${d.orderId}`);
    await page.getByTestId('po-cancel').click();
    await page.getByTestId('po-cancel-confirm').click();
    await expect(page.getByTestId('po-cancel-error')).toContainText('why');
    await page.getByTestId('po-cancel-reason').fill('vendor cannot supply');
    await page.getByTestId('po-cancel-confirm').click();
    await expect(page.getByTestId('po-cancelled')).toContainText('vendor cannot supply');
    await expect(page.getByTestId('po-cancel')).toHaveCount(0);
    expect((await order(api, d.orderId)).status).toBe('CANCELLED');
  });
});
