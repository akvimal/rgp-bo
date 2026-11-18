/**
 * The step after completing a purchase invoice: mark it payment ready — PREADY-1..4
 * Completing means the goods and the bill agree; marking ready says it is checked and may go to finance. A payment (and a pay run line) is refused
 * until then, alongside the hold and approval checks.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
let seq = 0;
const run = Date.now() % 100000;

/** a received invoice with a vendor invoice number and a balance, not yet marked ready (complete = false leaves it a draft) */
async function invoice(api: any, complete = true, withNumber = true) {
  const n = ++seq;
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const prod = data.m.products[42].id;
  const lineTotal = 150;                              // a line's total is before tax
  const net = +(lineTotal * 1.12).toFixed(2);          // 168 with 12% GST
  const body: any = { vendorid: v, invoicedate: '2026-09-04', printedtotal: net };
  if (withNumber) body.invoiceno = `QA-PR-${run}-${n}`; else body.challanno = `CH-PR-${run}-${n}`;
  const inv = await api.request('POST', '/purchases', body, MGR);
  expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod, qty: 10, ptrvalue: 15, ptrcost: 15, mrpcost: 22, taxpcnt: 12, total: lineTotal,
    batch: `PR-${run}-${n}`, expdate: '2028-06-30', saleprice: 20,
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  if (complete) {
    const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lineTotal } }, MGR);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  }
  return { id: inv.body.id as number, vendorid: v as number };
}

const pay = (api: any, i: { id: number; vendorid: number }, amount = 10) =>
  api.request('POST', '/vendorpayments', { vendorid: i.vendorid, invoiceid: i.id, paydate: '2026-09-10', amount, paymode: 'Cash' }, MGR);

test.describe('Invoice: mark payment ready @p1', () => {
  test('PREADY-1 a completed invoice waits as Not ready, cannot be paid, and can once it is marked ready @happy', async ({ api }) => {
    const inv = await invoice(api);
    const before = (await api.request('GET', '/purchases/summary', undefined, MGR)).body;

    const row = (await api.request('GET', `/purchases/search?view=notready&vendor=${inv.vendorid}&limit=100`, undefined, MGR)).body.data.find((i: any) => i.id === inv.id);
    expect(row, 'in the Not ready view').toBeTruthy();
    expect(row.payment_status).toBe('Not ready');
    expect(row.payment_ready).toBe(false);
    expect((await api.request('GET', `/purchases/search?view=ready&vendor=${inv.vendorid}&limit=100`, undefined, MGR)).body.data.some((i: any) => i.id === inv.id)).toBe(false);
    expect(before.notready.count).toBeGreaterThan(0);
    const outstanding = (await api.request('GET', `/purchases/outstanding?vendorid=${inv.vendorid}`, undefined, MGR)).body.find((i: any) => i.id === inv.id);
    expect(outstanding.not_ready).toBe(true);

    const refused = await pay(api, inv);
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toContain('ready for payment');
    const batch = await api.request('POST', '/vendorpayments/batch', { vendorid: inv.vendorid, paydate: '2026-09-10', paymode: 'Cash', allocations: [{ invoiceid: inv.id, amount: 5 }] }, MGR);
    expect(batch.status).toBe(400);

    const marked = await api.request('POST', `/purchases/${inv.id}/payment-ready`, { note: 'checked against the challan' }, MGR);
    expect(marked.status, JSON.stringify(marked.body)).toBeLessThan(300);
    expect(marked.body.ready).toBe(true);
    expect((await api.request('POST', `/purchases/${inv.id}/payment-ready`, {}, MGR)).status).toBeLessThan(300);     // marking again changes nothing

    const after = (await api.request('GET', `/purchases/search?view=ready&vendor=${inv.vendorid}&limit=100`, undefined, MGR)).body.data.find((i: any) => i.id === inv.id);
    expect(after.payment_ready).toBe(true);
    expect(after.ready_by).toBeTruthy();
    expect(after.ready_note).toContain('challan');
    expect(after.payment_status).toBe('Unpaid');
    const one = (await api.request('GET', `/purchases/${inv.id}`, undefined, MGR)).body;
    expect(one.paymentready.by).toBeTruthy();

    const ok = await pay(api, inv);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
  });

  test('PREADY-2 only a completed, numbered invoice with a balance can be marked ready @negative', async ({ api }) => {
    const draft = await invoice(api, false);
    expect((await api.request('POST', `/purchases/${draft.id}/payment-ready`, {}, MGR)).status).toBe(400);          // not completed
    const awaiting = await invoice(api, true, false);
    expect((await api.request('POST', `/purchases/${awaiting.id}/payment-ready`, {}, MGR)).status).toBe(400);       // no vendor invoice number yet
    expect((await api.request('POST', '/purchases/999999999/payment-ready', {}, MGR)).status).toBe(404);
  });

  test('PREADY-3 the mark can be taken back until something is paid, then it stays @edge', async ({ api }) => {
    const inv = await invoice(api);
    await api.request('POST', `/purchases/${inv.id}/payment-ready`, {}, MGR);
    expect((await api.request('POST', `/purchases/${inv.id}/payment-unready`, {}, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', `/purchases/search?view=notready&vendor=${inv.vendorid}&limit=100`, undefined, MGR)).body.data.some((i: any) => i.id === inv.id)).toBe(true);
    expect((await pay(api, inv)).status).toBe(400);

    await api.request('POST', `/purchases/${inv.id}/payment-ready`, {}, MGR);
    expect((await pay(api, inv)).status).toBeLessThan(300);
    expect((await api.request('POST', `/purchases/${inv.id}/payment-unready`, {}, MGR)).status).toBe(400);          // a payment is recorded: it stays ready
  });

  test('PREADY-4 a role without purchasing access cannot mark an invoice ready @negative', async ({ api }) => {
    const inv = await invoice(api);
    const sales = await api.request('POST', `/purchases/${inv.id}/payment-ready`, {}, 'sales1@local.test');
    expect([401, 403]).toContain(sales.status);
  });
});
