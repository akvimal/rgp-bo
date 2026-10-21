/**
 * Digital payments carry the provider's reference — DIGI-1..2
 * A bill paid digitally must say how and carry the Paytm reference, so it can be matched to the settlement file later.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

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

/** a counter bill of one line, paid partly or fully digitally */
function bill(pay: { cash: number; digi: number; method?: string | null; ref?: string | null }, total = 100) {
  const s = POOL[0];
  const now = new Date().toISOString();
  return {
    customerid: data.anyCustomer(), billdate: now, orderdate: now,
    cashamt: pay.cash, digiamt: pay.digi, digimethod: pay.method ?? null, digirefno: pay.ref ?? null,
    total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 1, total }],
  };
}
const refNo = (p = 'PT') => `${p}${Date.now()}${Math.floor(Math.random() * 1e4)}`;

test.describe('Digital payments @p1', () => {
  test('DIGI-1 a digital amount needs a method and a well-formed Paytm reference, used once @negative', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const post = (b: any) => api.request('POST', '/sales', b, CASHIER);

    expect((await post(bill({ cash: 0, digi: 100, method: 'UPI', ref: '' }))).status).toBe(400);            // no reference
    expect((await post(bill({ cash: 0, digi: 100, method: 'UPI', ref: 'AB1' }))).status).toBe(400);        // too short
    expect((await post(bill({ cash: 0, digi: 100, method: 'UPI', ref: 'bad ref!#' }))).status).toBe(400);  // not letters and digits
    expect((await post(bill({ cash: 0, digi: 100, method: 'Cheque', ref: refNo() }))).status).toBe(400);   // not a digital method
    expect((await post(bill({ cash: 0, digi: 100, method: null, ref: refNo() }))).status).toBe(400);       // no method

    const ref = refNo('pt ');                                                                               // spaces and lower case are tidied
    const ok = await post(bill({ cash: 40, digi: 60, method: 'PayTM', ref }));                              // an old client's "PayTM" is a UPI payment
    expect(ok.status).toBeLessThan(300);
    expect(ok.body.digimethod).toBe('UPI');
    expect(ok.body.digirefno).toBe(ref.toUpperCase().replace(/\s+/g, ''));
    expect(ok.body.digiprovider).toBe('Paytm');

    // the same reference cannot pay a second bill
    const dup = await post(bill({ cash: 0, digi: 100, method: 'UPI', ref: ok.body.digirefno.toLowerCase() }));
    expect(dup.status).toBe(400);
    expect(JSON.stringify(dup.body)).toContain('already on bill');
  });

  test('DIGI-2 a cash bill carries no digital method or reference @edge', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const r = await api.request('POST', '/sales', bill({ cash: 100, digi: 0, method: 'UPI', ref: refNo() }), CASHIER);
    expect(r.status).toBeLessThan(300);
    expect(r.body.digimethod ?? null).toBeNull();
    expect(r.body.digirefno ?? null).toBeNull();
    expect(r.body.digiprovider ?? null).toBeNull();
    const card = await api.request('POST', '/sales', bill({ cash: 0, digi: 100, method: 'Card', ref: refNo('CARD') }), CASHIER);
    expect(card.status).toBeLessThan(300);
    expect(card.body.digimethod).toBe('Card');
  });
});
