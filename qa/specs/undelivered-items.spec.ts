/**
 * Items an order asked for that the vendor did not deliver — UND-1..4
 *
 * On an invoice against a purchase order, a line the vendor did not (fully) deliver is decided before the invoice can be completed: it is still to come on the
 * same order, ordered again (a new order, the same or another vendor), added to another open order, or kept as a request. A moved quantity leaves the
 * original order as "not delivered".
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function vendorIds(api: any): Promise<number[]> { return (await api.request('GET', '/vendors', undefined, MGR)).body.map((v: any) => v.id); }
async function products(api: any, n: number): Promise<number[]> {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 1000 }, MGR)).body;
  return ([...new Set(rows.filter((x: any) => x.status === 'VERIFIED').map((x: any) => x.id))] as number[]).slice(0, n);
}
/** an order (submitted unless asked to stay a draft) with one line per quantity given */
async function order(api: any, qtys: number[], submit = true) {
  const [v] = await vendorIds(api);
  const prods = await products(api, qtys.length + 1);
  const po = await api.request('POST', '/purchaseorders', { vendorid: v, comments: 'qa undelivered' }, MGR);
  for (let i = 0; i < qtys.length; i++) {
    const pr = await api.request('POST', '/purchaserequests', { productid: prods[i], qty: qtys[i], vendorid: v }, MGR);
    await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  }
  if (submit) expect((await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR)).status).toBeLessThan(300);
  return { id: po.body.id as number, vendor: v as number };
}
const newInvoice = (api: any, vendorid: number, purchaseorderid: number) =>
  api.request('POST', '/purchases', { vendorid, purchaseorderid, invoiceno: `QA/UND-${Date.now()}-${Math.floor(Math.random() * 1000)}`, invoicedate: '2026-09-04', printedtotal: 100 }, MGR);
const itemsOf = async (api: any, id: number) => (await api.request('GET', `/purchases/${id}`, undefined, MGR)).body.items as any[];
const undelivered = async (api: any, id: number) => (await api.request('GET', `/purchases/${id}/undelivered`, undefined, MGR)).body;
const complete = (api: any, id: number) => api.request('PUT', '/purchases/confirm', { ids: [id], values: { status: 'COMPLETE' } }, MGR);
const orderOf = async (api: any, id: number) => (await api.request('GET', `/purchaseorders/${id}`, undefined, MGR)).body;

/** an invoice for an order of [10, 7] where the vendor sent 4 of the first line and all of the second */
async function shortInvoice(api: any) {
  const po = await order(api, [10, 7]);
  const inv = await newInvoice(api, po.vendor, po.id);
  const items = await itemsOf(api, inv.body.id);
  const first = items.find((i: any) => +i.qty === 10);
  await api.request('PUT', '/purchaseitems', { ids: [first.id], values: { qty: 4 } }, MGR);
  return { po, invoice: inv.body.id as number, line: first };
}

test.describe('Items not delivered @p1', () => {
  test('UND-1 the lines not delivered are listed with the quantity left, and the invoice cannot be completed until they are decided @happy', async ({ api }) => {
    const { invoice, line } = await shortInvoice(api);
    const u = await undelivered(api, invoice);
    expect(u.lines.length).toBe(1);
    expect(u.lines[0].ordered).toBe(10);
    expect(u.lines[0].here).toBe(4);
    expect(u.lines[0].undelivered).toBe(6);
    expect(u.lines[0].product_id).toBe(line.productid);
    expect(u.decided_qty).toBeNull();

    const blocked = await complete(api, invoice);
    expect(blocked.status).toBe(400);
    expect(JSON.stringify(blocked.body)).toMatch(/not delivered/i);
  });

  test('UND-2 ordering it again with another vendor: the line leaves the order as not delivered and a new order carries it @happy', async ({ api }) => {
    const { po, invoice, line } = await shortInvoice(api);
    const vendors = await vendorIds(api);
    const other = vendors.find((v) => v !== po.vendor) as number;
    expect(other).toBeTruthy();
    const u = await undelivered(api, invoice);
    const r = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: u.lines[0].request_id, qty: 6, action: 'new', vendorid: other }] }, MGR);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(r.body.results[0]).toMatchObject({ action: 'new', vendor_id: other, lines: 1 });
    const neworder = await orderOf(api, r.body.results[0].order_id);
    expect(neworder.vendorid ?? neworder.vendor_id).toBe(other);
    expect(neworder.requests.length).toBe(1);
    expect(neworder.requests[0].productid).toBe(line.productid);
    expect(+neworder.requests[0].orderedqty).toBe(6);

    // the original order now asks only for what was delivered, and nothing is left to decide
    const original = await orderOf(api, po.id);
    const old = original.requests.find((x: any) => x.productid === line.productid);
    expect(+old.orderedqty).toBe(4);
    expect((await undelivered(api, invoice)).lines.length).toBe(0);
    const again = await complete(api, invoice);
    expect(JSON.stringify(again.body)).not.toMatch(/not delivered/i);
  });

  test('UND-3 adding it to another open order: a draft takes it at once, a submitted one goes back for approval @happy', async ({ api }) => {
    const { invoice } = await shortInvoice(api);
    const draft = await order(api, [3], false);
    const submitted = await order(api, [2], true);
    const u = await undelivered(api, invoice);
    expect(u.open_orders.map((o: any) => o.id)).toEqual(expect.arrayContaining([draft.id, submitted.id]));

    const toDraft = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: u.lines[0].request_id, qty: 2, action: 'existing', orderid: draft.id }] }, MGR);
    expect(toDraft.status, JSON.stringify(toDraft.body)).toBeLessThan(300);
    expect(toDraft.body.results[0]).toMatchObject({ action: 'existing', order_id: draft.id, sent_for_approval: false });
    expect((await orderOf(api, draft.id)).requests.length).toBe(2);

    const u2 = await undelivered(api, invoice);
    expect(u2.lines[0].undelivered).toBe(4);
    const toSubmitted = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: u2.lines[0].request_id, qty: 4, action: 'existing', orderid: submitted.id }] }, MGR);
    expect(toSubmitted.status, JSON.stringify(toSubmitted.body)).toBeLessThan(300);
    expect(toSubmitted.body.results[0].sent_for_approval).toBe(true);
    expect((await orderOf(api, submitted.id)).requests.length).toBe(2);
  });

  test('UND-4 still to come, or kept as a request: both settle the invoice; a bad quantity or order is refused @edge', async ({ api }) => {
    const { po, invoice } = await shortInvoice(api);
    const u = await undelivered(api, invoice);
    const rid = u.lines[0].request_id;

    const tooMany = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: rid, qty: 99, action: 'request' }] }, MGR);
    expect(tooMany.status).toBe(400);
    const sameOrder = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: rid, qty: 1, action: 'existing', orderid: po.id }] }, MGR);
    expect(sameOrder.status).toBe(400);
    const noOrder = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: rid, qty: 1, action: 'existing' }] }, MGR);
    expect(noOrder.status).toBe(400);

    // it is still to come: the invoice may now be completed as far as this goes
    const wait = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: rid, action: 'wait' }] }, MGR);
    expect(wait.status).toBeLessThan(300);
    expect(wait.body.waiting_qty).toBe(6);
    expect((await undelivered(api, invoice)).decided_qty).toBe(6);
    expect(JSON.stringify((await complete(api, invoice)).body)).not.toMatch(/not delivered/i);

    // a change to the invoice's lines that leaves a different quantity undelivered asks again
    const items = await itemsOf(api, invoice);
    const first = items.find((i: any) => i.productid === u.lines[0].product_id);
    await api.request('PUT', '/purchaseitems', { ids: [first.id], values: { qty: 2 } }, MGR);
    expect(JSON.stringify((await complete(api, invoice)).body)).toMatch(/not delivered/i);

    // keeping the rest as a request: it waits, unordered, to be ordered later
    const u2 = await undelivered(api, invoice);
    const kept = await api.request('POST', `/purchases/${invoice}/undelivered`, { moves: [{ requestid: rid, qty: u2.lines[0].undelivered, action: 'request' }] }, MGR);
    expect(kept.status, JSON.stringify(kept.body)).toBeLessThan(300);
    expect(kept.body.results[0]).toMatchObject({ action: 'request', lines: 1 });
    expect((await undelivered(api, invoice)).lines.length).toBe(0);
  });
});
