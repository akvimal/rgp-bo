/**
 * Purchase invoice built from a purchase order — POINV-1..3
 * Source: docs/planning/PURCHASE_FLOW_REVISION.md (part C)
 *
 * An invoice against a PO starts with the order's lines still to come, remembers what each was expected to be, marks a line that was not on the order,
 * and the header asks for the order (or "No purchase order") first, with the vendor taken from it.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function vendorId(api: any) { return (await api.request('GET', '/vendors', undefined, MGR)).body[0].id; }
async function products(api: any, n: number): Promise<number[]> {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 1000 }, MGR)).body;
  return ([...new Set(rows.filter((x: any) => x.status === 'VERIFIED').map((x: any) => x.id))] as number[]).slice(0, n);
}
/** a submitted (approved) PO with one line per quantity given */
async function approvedPO(api: any, qtys: number[]) {
  const v = await vendorId(api);
  const prods = await products(api, qtys.length + 1);
  const po = await api.request('POST', '/purchaseorders', { vendorid: v, comments: 'qa po-invoice' }, MGR);
  for (let i = 0; i < qtys.length; i++) {
    const pr = await api.request('POST', '/purchaserequests', { productid: prods[i], qty: qtys[i], vendorid: v }, MGR);
    await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  }
  const sub = await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
  expect(sub.status).toBeLessThan(300);
  return { id: po.body.id as number, vendor: v as number, prods };
}
const newInvoice = (api: any, vendorid: number, purchaseorderid: number | null) =>
  api.request('POST', '/purchases', { vendorid, purchaseorderid, invoiceno: `QA/PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`, invoicedate: '2026-09-04', printedtotal: 100 }, MGR);
const itemsOf = async (api: any, id: number) => (await api.request('GET', `/purchases/${id}`, undefined, MGR)).body.items as any[];

test.describe('Purchase invoice from a purchase order @p1', () => {
  test('POINV-1 saving an invoice against a PO brings in its lines with what was expected; a line not on the order is marked @happy', async ({ api }) => {
    const po = await approvedPO(api, [10, 7]);
    const inv = await newInvoice(api, po.vendor, po.id);
    expect(inv.status).toBeLessThan(300);
    const items = await itemsOf(api, inv.body.id);
    expect(items.length).toBe(2);
    expect(items.map((i: any) => +i.qty).sort((a: number, b: number) => a - b)).toEqual([7, 10]);
    items.forEach((i: any) => { expect(i.offpo).toBe(false); expect(i.poexpect).toBeTruthy(); expect(+i.poexpect.qty).toBe(+i.qty); });

    // a product the order did not list, added by hand, is received but marked
    const extra = (await products(api, 12)).find((id) => !po.prods.slice(0, 2).includes(id)) as number;
    expect(extra).toBeTruthy();
    const add = await api.request('POST', '/purchaseitems', {
      invoiceid: inv.body.id, productid: extra, qty: 3, ptrvalue: 20, ptrcost: 20, mrpcost: 30, taxpcnt: 12, total: 60,
      batch: `E${Date.now()}`.slice(0, 12), expdate: '2028-06-30', saleprice: 25,
    }, MGR);
    expect(add.status, JSON.stringify(add.body)).toBeLessThan(300);
    const after = await itemsOf(api, inv.body.id);
    expect(after.length).toBe(3);
    const off = after.find((i: any) => i.productid === extra);
    expect(off.offpo).toBe(true);
    expect(off.offporeason).toBeTruthy();
  });

  test('POINV-2 an order invoiced in parts: the next invoice starts with what is left @edge', async ({ api }) => {
    const po = await approvedPO(api, [10]);
    const first = await newInvoice(api, po.vendor, po.id);
    const [line] = await itemsOf(api, first.body.id);
    expect(+line.qty).toBe(10);
    await api.request('PUT', '/purchaseitems', { ids: [line.id], values: { qty: 4 } }, MGR);       // the vendor sent only 4

    const second = await newInvoice(api, po.vendor, po.id);
    const rest = await itemsOf(api, second.body.id);
    expect(rest.length).toBe(1);
    expect(+rest[0].qty).toBe(6);
    expect(+rest[0].poexpect.ordered).toBe(10);
  });

  test('POINV-3 the form asks for the order first: the vendor comes from it and cannot be changed; "No purchase order" frees the vendor @happy', async ({ app, api }) => {
    const po = await approvedPO(api, [5]);
    const { page } = await app.open(MGR, '/secure/purchases/invoices/new');
    const choose = page.getByTestId('inv-f-po-first');
    await expect(choose).toBeVisible();
    await expect(page.getByTestId('inv-f-hint')).toContainText('purchase order');
    await expect(page.getByTestId('inv-f-save')).toBeDisabled();

    await expect(choose.locator(`option[value="${po.id}"]`)).toHaveCount(1);
    await choose.selectOption(String(po.id));
    await expect(page.getByTestId('inv-f-vendor')).toBeDisabled();
    await expect(page.getByTestId('inv-f-vendor')).toHaveValue(String(po.vendor));
    await expect(page.getByTestId('inv-f-po-line')).toHaveCount(1);                              // the order's lines show on the form at once, with what is still to come
    await expect(page.getByTestId('inv-f-po-lines')).toContainText('1 still to come');

    await choose.selectOption('NONE');
    await expect(page.getByTestId('inv-f-vendor')).toBeEnabled();
    await expect(page.getByTestId('inv-f-po-lines')).toHaveCount(0);                              // no order: no lines to show
  });

  test('POINV-4 a line that differs from the order shows what the order said @happy', async ({ app, api }) => {
    const po = await approvedPO(api, [10]);
    const inv = await newInvoice(api, po.vendor, po.id);
    const [line] = await itemsOf(api, inv.body.id);
    await api.request('PUT', '/purchaseitems', { ids: [line.id], values: { qty: 12 } }, MGR);          // more than ordered
    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${inv.body.id}`);
    await expect(page.getByTestId(`item-orderflags-${line.id}`)).toContainText('More than ordered');
    await expect(page.getByTestId('order-diff-note')).toContainText('differ');
  });

  test('POREQ-1 a new request is needed in two days and the dialog says New Purchase Request @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/purchases/requests');
    await page.getByRole('button', { name: /Add Request/i }).click();
    await expect(page.locator('.p-dialog-title')).toHaveText('New Purchase Request');
    const d = new Date(); d.setDate(d.getDate() + 2);
    const want = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await expect(page.locator('input[formcontrolname="neededby"]')).toHaveValue(want);
  });

  test('POADD-1 Add items is a table: several reviewed requests are ticked and added together, each with a history icon @happy', async ({ app, api }) => {
    const v = await vendorId(api);
    const prods = await products(api, 2);
    const po = await api.request('POST', '/purchaseorders', { vendorid: v, comments: 'qa add items' }, MGR);
    for (const p of prods) {
      const pr = await api.request('POST', '/purchaserequests', { productid: p, qty: 3, vendorid: v }, MGR);
      await api.request('PUT', `/purchaserequests/${pr.body.id}`, { status: 'Reviewed' }, MGR);
    }
    const { page } = await app.open(MGR, `/secure/purchases/orders/${po.body.id}`);
    await page.getByTestId('po-add-request').click();
    await expect(page.getByTestId('po-pick-table')).toBeVisible();
    await page.getByTestId('po-pick-all').check();
    const n = await page.getByTestId('po-pick-check').count();
    expect(n).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId('po-pick-count')).toContainText(`${n} of ${n}`);
    await page.getByTestId('po-pick-add').click();
    await expect(page.getByTestId('po-fulfilment-row')).toHaveCount(n);
    await expect(page.getByTestId('po-history').first()).toBeVisible();
  });
});
