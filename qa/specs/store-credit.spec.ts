/**
 * Customer store credit — CR-1..4
 * A return can be refunded as store credit; the credit sits on the customer and pays part or all of a later bill.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

let POOL: any[] = [];
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
  const rows = await (await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
    body: JSON.stringify({ available: true, limit: 200 }),
  })).json();
  POOL = rows.filter((x: any) => Number(x.balance) > 30 && x.status === 'VERIFIED').map((x: any) => ({
    itemid: x.item_id, productid: x.id, batch: x.batch,
    price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)),
    mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

const mobile = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

/** a counter bill; qty units at 100 each; `over` carries the payment split and the customer */
function bill(over: Record<string, any>, qty = 2) {
  const s = POOL[POOL.length - 2];
  const now = new Date().toISOString();
  const total = 100 * qty;
  return {
    billdate: now, orderdate: now, cashamt: 0, digiamt: 0, total, discamount: 0, expreturndays: 7,
    status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: 100, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty, total }],
    ...over,
  };
}

let customerId = 0;
const credit = async (api: any, id: number) => (await api.request('GET', `/customers/${id}/credit`, undefined, MGR)).body;

test.describe('Store credit @p1', () => {
  test('CR-1 a return refunded as credit adds to the customer\'s balance, once, for the accepted quantity @happy', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const sale = await api.request('POST', '/sales', bill({ cashamt: 200, customer: { name: 'QA Credit Customer', mobile: mobile() } }), COUNTER);
    expect(sale.status).toBeLessThan(300);
    customerId = sale.body.customer?.id || sale.body.customerid;
    expect(customerId).toBeTruthy();
    const line = sale.body.items[0];

    const ret = async (qty: number, extra: any = {}) => (await api.request('POST', '/sales/returns', [{ saleitemid: line.id, qty, status: 'NEW', reason: 'Defective', ...extra }], COUNTER)).body[0];
    const settle = (id: number, b: any) => api.request('PUT', '/sales/returns', { id, status: 'ADJUSTED', ...b }, COUNTER);

    const r1 = await ret(1, { refundmode: 'CREDIT' });
    expect((await settle(r1.id, { acceptedqty: 5 })).status).toBe(400);                 // more than was returned
    expect((await settle(r1.id, { refundmode: 'VOUCHER' })).status).toBe(400);                            // not a refund mode
    const ok = await settle(r1.id, { acceptedqty: 1 });
    expect(ok.status).toBeLessThan(300);
    expect(ok.body.refundmode).toBe('CREDIT');
    expect(Number(ok.body.refundamount)).toBe(100);
    expect((await credit(api, customerId)).balance).toBe(100);
    expect((await settle(r1.id, { acceptedqty: 1 })).status).toBe(400);                                   // settled once
    expect((await credit(api, customerId)).balance).toBe(100);

    // a rejected item earns nothing; cash refunds are recorded but add no credit
    const r2 = await ret(1);
    const none = await settle(r2.id, { refundmode: 'CREDIT', acceptedqty: 0 });
    expect(none.status).toBeLessThan(300);
    expect(Number(none.body.refundamount)).toBe(0);
    expect((await credit(api, customerId)).balance).toBe(100);

    // a walk-in with no number cannot hold credit
    const walk = await api.request('POST', '/sales', bill({ customerid: data.anyCustomer(), cashamt: 200 }), COUNTER);
    const wl = walk.body.items[0];
    const wr = (await api.request('POST', '/sales/returns', [{ saleitemid: wl.id, qty: 1, status: 'NEW', reason: 'Defective', refundmode: 'CASH' }], COUNTER)).body[0];
    const cash = await settle(wr.id, { acceptedqty: 1 });
    expect(cash.status).toBeLessThan(300);
    expect(cash.body.refundmode).toBe('CASH');
  });

  test('CR-2 a bill can use store credit for part or all of it; limits are enforced @edge', async ({ api }) => {
    test.skip(!POOL.length || !customerId, 'needs CR-1');
    const cust = { id: customerId, name: 'QA Credit Customer', mobile: (await credit(api, customerId)).customer.mobile, confirmduplicate: true };
    await api.request('POST', `/customers/${customerId}/credit/adjustment`, { amount: 400, note: 'QA opening credit' }, MGR);
    const start = (await credit(api, customerId)).balance as number;
    expect(start).toBe(500);

    const post = (b: any, qty = 2) => api.request('POST', '/sales', bill({ customer: cust, ...b }, qty), COUNTER);
    expect((await post({ creditamt: 100, cashamt: 0 })).status).toBe(400);                                // 100 of 200 tendered
    expect((await post({ creditamt: 9999, cashamt: 0 })).status).toBe(400);                               // more than the bill
    expect((await post({ creditamt: 200, staffcreditamt: 200, staffcredituserid: 1 })).status).toBe(400); // not with staff credit
    const walk = await api.request('POST', '/sales', bill({ customerid: data.anyCustomer(), creditamt: 200 }), COUNTER);
    expect(walk.status).toBe(400);                                                                        // needs a named customer

    const part = await post({ creditamt: 120, cashamt: 80 });
    expect(part.status).toBeLessThan(300);
    expect(Number(part.body.creditamt)).toBe(120);
    expect((await credit(api, customerId)).balance).toBe(start - 120);
    const full = await post({ creditamt: 200, cashamt: 0 });
    expect(full.status).toBeLessThan(300);
    expect((await credit(api, customerId)).balance).toBe(start - 320);

    // the balance cannot be overspent
    const left = start - 320;                                                                             // 180
    const big = await post({ creditamt: 200, cashamt: 0 });
    expect(big.status).toBe(400);
    expect(JSON.stringify(big.body)).toContain('store credit');
    expect((await credit(api, customerId)).balance).toBe(left);

    const entries = (await credit(api, customerId)).entries;
    expect(entries.filter((e: any) => e.kind === 'REDEEMED' && (e.sale_id === part.body.id || e.sale_id === full.body.id))).toHaveLength(2);
  });

  test('CR-3 only the Business Head corrects credit, with a reason, never below zero @negative', async ({ api }) => {
    test.skip(!customerId, 'needs CR-1');
    const url = `/customers/${customerId}/credit/adjustment`;
    expect((await api.request('POST', url, { amount: 10, note: 'QA counter attempt' }, COUNTER)).status).toBe(403);
    expect((await api.request('POST', url, { amount: 10, note: 'x' }, MGR)).status).toBe(400);
    expect((await api.request('POST', url, { amount: 0, note: 'QA nothing' }, MGR)).status).toBe(400);
    const now = (await credit(api, customerId)).balance as number;
    expect((await api.request('POST', url, { amount: -(now + 1), note: 'QA too much' }, MGR)).status).toBe(400);
    expect((await api.request('POST', url, { amount: -5, note: 'QA correction' }, MGR)).status).toBeLessThan(300);
    expect((await credit(api, customerId)).balance).toBe(now - 5);
    const audit = await api.request('GET', '/audit?action=customercredit.adjusted&limit=3', undefined, MGR);
    expect(audit.body.rows.length).toBeGreaterThan(0);
  });

  test('CR-4 the returns list shows the refund, and the customer page shows the credit @happy', async ({ app }) => {
    test.skip(!customerId, 'needs CR-1');
    const { page } = await app.open(MGR, '/secure/sales/returns');
    await expectShell(page);
    await expect(page.getByTestId('ret-refund').first()).toBeVisible();
    const edit = await app.open(MGR, `/secure/customers/cust/edit/${customerId}`);
    await expect(edit.page.getByTestId('cust-credit-panel')).toBeVisible();
    await expect(edit.page.getByTestId('cc-balance')).toBeVisible();
    await expect(edit.page.getByTestId('cc-entry').first()).toBeVisible();
  });
});
