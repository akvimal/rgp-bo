/**
 * Returns to a vendor, credited on a later invoice - VRC-1..3
 * A return can be adjusted on a draft invoice, and also on a completed invoice as long as nothing has been paid on it (the amount payable comes down).
 * Once a payment is recorded the amount is fixed, so the credit is refused (and taking one off is refused too).
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const run = Date.now().toString().slice(-6);
let seq = 0;

/** a completed invoice for the vendor with one verified line; qty x 12 + 12% GST */
async function invoice(api: any, vendorid: number, productid: number, qty: number, complete = true) {
  const n = ++seq;
  // at the product's own last cost and MRP, so no rate-change reason is asked for
  const last = ((await api.request('POST', '/stock/filter', { id: productid, limit: 1 }, MGR)).body as any[])[0];
  const mrp = Number(last?.mrp_cost) || 20;
  const ptr = +(mrp * 0.6).toFixed(2);
  const inv = await api.request('POST', '/purchases', { vendorid, invoiceno: `QA-VRC-${run}-${n}`, invoicedate: '2026-09-04' }, MGR);
  expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
  const lineTotal = +(qty * ptr).toFixed(2);                     // a line's total is before tax
  const total = Math.round(lineTotal * 1.12);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid, qty, ptrvalue: ptr, ptrcost: ptr, mrpcost: mrp, taxpcnt: 12, total: lineTotal, batch: `VRC-${run}-${n}`, expdate: '2028-06-30', saleprice: +(mrp * 0.8).toFixed(2),
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  if (complete) {
    const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total } }, MGR);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  }
  const got = (await api.request('GET', `/purchases/${inv.body.id}`, undefined, MGR)).body;
  return { id: inv.body.id as number, itemid: it.body.id as number, storeid: got.storeid as number, total, no: got.invoiceno as string, ptr };
}

const sendBack = async (api: any, vendorid: number, from: any, qty: number) => {
  const r = await api.request('POST', '/vendor-returns', { vendorid, storeid: from.storeid, reason: `QA ${run}`, items: [{ itemid: from.itemid, qty, rate: from.ptr }] }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return r.body as { id: number; total: number };
};
const totalOf = async (api: any, id: number) => Number((await api.request('GET', `/purchases/${id}`, undefined, MGR)).body.total);
const creditsOf = async (api: any, id: number) => (await api.request('GET', `/vendor-returns/invoice/${id}`, undefined, MGR)).body;

test.describe('Vendor return credited on an invoice @p1', () => {
  test('VRC-1 a completed invoice with nothing paid takes the credit: the amount payable comes down, and it can be taken off again @happy', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0].id;
    const prod = data.m.products[20].id;
    const bought = await invoice(api, vendor, prod, 20);                 // the goods that go back
    const next = await invoice(api, vendor, prod, 10);                   // the later invoice, already completed
    const ret = await sendBack(api, vendor, bought, 5);                  
    expect(ret.total).toBeCloseTo(5 * bought.ptr * 1.12, 2);

    const before = await totalOf(api, next.id);
    const view = await creditsOf(api, next.id);
    expect(view).toMatchObject({ editable: true, completed: true });
    expect(view.open.map((r: any) => r.id)).toContain(ret.id);

    const add = await api.request('POST', `/vendor-returns/invoice/${next.id}`, { returnid: ret.id }, MGR);
    expect(add.status, JSON.stringify(add.body)).toBeLessThan(300);
    const after = await totalOf(api, next.id);
    expect(Math.abs(after - (before - ret.total))).toBeLessThanOrEqual(1);      // the invoice total is rounded to the rupee
    expect(after).toBeLessThan(before);
    const applied = (await creditsOf(api, next.id)).applied;
    expect(applied.map((c: any) => c.returnid)).toContain(ret.id);

    // taking it off puts the amount back and the return is open again
    const credit = applied.find((c: any) => c.returnid === ret.id);
    expect((await api.request('DELETE', `/vendor-returns/invoice/${next.id}/${credit.id}`, undefined, MGR)).status).toBeLessThan(300);
    expect(await totalOf(api, next.id)).toBe(before);
    expect((await creditsOf(api, next.id)).open.map((r: any) => r.id)).toContain(ret.id);
  });

  test('VRC-2 once a payment is recorded the credit is refused, with the reason, and a credit already on it cannot be taken off @negative', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0].id;
    const prod = data.m.products[20].id;
    const bought = await invoice(api, vendor, prod, 20);
    const next = await invoice(api, vendor, prod, 10);
    const r1 = await sendBack(api, vendor, bought, 2);
    const r2 = await sendBack(api, vendor, bought, 3);

    // adjusted first, then a part payment is made
    expect((await api.request('POST', `/vendor-returns/invoice/${next.id}`, { returnid: r1.id }, MGR)).status).toBeLessThan(300);
    const pay = await api.request('POST', '/vendorpayments', { vendorid: vendor, invoiceid: next.id, paydate: '2026-09-10', amount: 20, paymode: 'Cash' }, MGR);
    expect(pay.status, JSON.stringify(pay.body)).toBeLessThan(300);

    const view = await creditsOf(api, next.id);
    expect(view.editable).toBe(false);
    expect(view.reason).toMatch(/payment has been recorded/);
    const total = await totalOf(api, next.id);

    const refused = await api.request('POST', `/vendor-returns/invoice/${next.id}`, { returnid: r2.id }, MGR);
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toMatch(/payment has been recorded/);
    const credit = view.applied[0];
    const noOff = await api.request('DELETE', `/vendor-returns/invoice/${next.id}/${credit.id}`, undefined, MGR);
    expect(noOff.status).toBe(400);
    expect(JSON.stringify(noOff.body)).toMatch(/taken off/);
    expect(await totalOf(api, next.id), 'the amount did not move').toBe(total);
    expect((await creditsOf(api, next.id)).open.map((r: any) => r.id), 'the return is still open for the next invoice').toContain(r2.id);
  });

  test('VRC-3 the invoice page offers it on a completed unpaid invoice, with a real click, and says so @happy', async ({ api, app }) => {
    const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0].id;
    const prod = data.m.products[20].id;
    const bought = await invoice(api, vendor, prod, 20);
    const next = await invoice(api, vendor, prod, 10);
    const ret = await sendBack(api, vendor, bought, 4);
    const before = await totalOf(api, next.id);

    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${next.id}`);
    const card = page.getByTestId('invoice-returns');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('invoice-returns-completed')).toContainText('nothing has been paid');
    const row = card.getByTestId('invoice-open-return').filter({ hasText: `#${ret.id}` }).first();
    await row.getByTestId('invoice-credit-add').click();
    await expect(card.getByTestId('invoice-credit-row')).toHaveCount(1);
    expect(await totalOf(api, next.id)).toBeLessThan(before);
    await card.getByTestId('invoice-credit-remove').click();
    await expect(card.getByTestId('invoice-credit-row')).toHaveCount(0);
    expect(await totalOf(api, next.id)).toBe(before);
  });
});
