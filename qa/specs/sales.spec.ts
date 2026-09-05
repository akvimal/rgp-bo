/**
 * Sales / POS — SALE-2, SALE-6..8, SALE-11   (SALE-1/3/4/5/9/10 are in regression.spec.ts)
 * Source: docs/testing/manual-test-plan.html  (module "sales")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

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

async function ringUp(api: any, over: Partial<{ cash: number; digi: number; total: number; deliverytype: string }> = {}) {
  const s = POOL[0];
  const gross = s.price * 2;
  const total = over.total ?? +(gross * (1 + s.taxpcnt / 100)).toFixed(2);
  const now = new Date().toISOString();
  return api.request('POST', '/sales', {
    customerid: data.anyCustomer(), billdate: now, orderdate: now,
    cashamt: over.cash ?? total, digiamt: over.digi ?? 0, digimethod: (over.digi ?? 0) > 0 ? 'UPI' : null,
    total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in',
    deliverytype: over.deliverytype ?? 'Counter',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 2, total }],
  }, CASHIER);
}

test.describe('Sales / POS @p1', () => {
  test('SALE-2 a payment split that does not add up to the bill is rejected (issue #137) @negative', async ({ api }) => {
    const r = await ringUp(api, { cash: 10, digi: 5, total: 500 });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  test('SALE-6 a sale can be booked for delivery @happy', async ({ api }) => {
    const sale = await ringUp(api, { deliverytype: 'Delivery' });
    const partner = (await api.request('GET', '/delivery-partners', undefined, MGR)).body[0];
    const del = await api.request('POST', '/deliveries', {
      saleid: sale.body.id, courierpartner: partner.name, deliverymethod: 'Courier',
      receivername: 'QA Receiver', receiverphone: '9800000001', receiveraddress: '5 QA Road',
      status: 'Pending',
    }, CASHIER);
    expect([200, 201]).toContain(del.status);
    const list = await api.request('GET', '/deliveries', undefined, CASHIER);
    const rec = list.body.find((d: any) => (d.saleid ?? d.saleId) === sale.body.id);
    expect(rec).toBeTruthy();
    expect(String(rec.status)).toMatch(/pending/i);
  });

  test('SALE-7 a delivery can be marked delivered & confirmed (incl. COD) @happy', async ({ api }) => {
    const sale = await ringUp(api, { cash: 0, deliverytype: 'Delivery' });
    const partner = (await api.request('GET', '/delivery-partners', undefined, MGR)).body[0];
    await api.request('POST', '/deliveries', {
      saleid: sale.body.id, courierpartner: partner.name, deliverymethod: 'Courier',
      receivername: 'COD Receiver', receiverphone: '9800000002', receiveraddress: '6 QA Road',
      paymentmode: 'COD', status: 'Pending',
    }, CASHIER);
    const upd = await api.request('PUT', `/deliveries/${sale.body.id}`, {
      status: 'Delivered', deliveredat: new Date().toISOString(),
      confirmed: true, confirmedby: 'Customer', confirmedat: new Date().toISOString(),
      collectionstatus: 'Collected',
    }, CASHIER);
    expect(upd.status).toBeLessThan(400);
    const rec = (await api.request('GET', '/deliveries', undefined, CASHIER)).body
      .find((d: any) => (d.saleid ?? d.saleId) === sale.body.id);
    expect(String(rec.status)).toMatch(/delivered/i);
    expect(rec.confirmed).toBeTruthy();
  });

  test('SALE-8 a delivery can be marked failed with a reason @negative', async ({ api }) => {
    const sale = await ringUp(api, { deliverytype: 'Delivery' });
    const partner = (await api.request('GET', '/delivery-partners', undefined, MGR)).body[0];
    await api.request('POST', '/deliveries', {
      saleid: sale.body.id, courierpartner: partner.name, deliverymethod: 'Courier',
      receivername: 'Fail Receiver', receiverphone: '9800000003', receiveraddress: '7 QA Road', status: 'Pending',
    }, CASHIER);
    const upd = await api.request('PUT', `/deliveries/${sale.body.id}`, {
      status: 'Failed', failurereason: 'Customer unavailable at address',
    }, CASHIER);
    expect(upd.status).toBeLessThan(400);
    const rec = (await api.request('GET', '/deliveries', undefined, CASHIER)).body
      .find((d: any) => (d.saleid ?? d.saleId) === sale.body.id);
    expect(String(rec.status)).toMatch(/failed/i);
    expect(rec.failurereason ?? rec.failure_reason).toContain('unavailable');
  });

  test('SALE-11 a split-payment sale shows both tenders in its shift report @integration', async ({ api }) => {
    const s = POOL[1];
    const total = +(s.price * 4 * (1 + s.taxpcnt / 100)).toFixed(2);
    const cashPart = +(total * 0.5).toFixed(2);
    const digiPart = +(total - cashPart).toFixed(2);
    const now = new Date().toISOString();

    // read the report for whatever shift THIS sale lands on
    const sale = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now,
      cashamt: cashPart, digiamt: digiPart, digimethod: 'Card', digirefno: 'SALE11REF',
      total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 4, total }],
    }, CASHIER);
    const shiftId = sale.body.shiftid;
    expect(shiftId, 'the sale linked to an open shift').toBeTruthy();
    // the split is recorded on the sale itself
    expect(Number(sale.body.cashamt)).toBeCloseTo(cashPart, 0);
    expect(Number(sale.body.digiamt)).toBeCloseTo(digiPart, 0);

    const rpt = await api.request('GET', `/store-cash/shifts/${shiftId}/report`, undefined, MGR);
    expect(rpt.status, 'shift report responds (issue #130)').toBeLessThan(400);
    // both tender columns are populated and the cash portion of this sale is reflected
    expect(Number(rpt.body.sales.cash_sales)).toBeGreaterThan(0);
    expect(Number(rpt.body.sales.digi_sales)).toBeGreaterThan(0);
    expect(Number(rpt.body.sales.cash_sales)).toBeGreaterThanOrEqual(cashPart - 1);
  });

  test('the POS billing screen opens with a Complete action @happy', async ({ app }) => {
    const { page } = await app.open(CASHIER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await expectShell(page);
    await expect(page.getByRole('button', { name: /Complete/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible();
  });
});
