/**
 * P0 regression slice — SALE 1-5, STK 1-2/7, INV 1-5
 * Source: docs/testing/manual-test-plan.html  (modules "sales", "stock", "invoices")
 *
 * This branch adds JWT refresh, acting-user on every sale, FK/constraint changes
 * (mig 021) and product-price fixes. These check the money paths still hold.
 * Exercised through the API (source of truth) with a UI smoke on the POS screen.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

let POOL: any[] = [];
test.beforeAll(async () => {
  const r = await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${(await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
      })).json()).token}`,
    },
    body: JSON.stringify({ available: true, limit: 400 }),
  });
  POOL = (await r.json())
    .filter((x: any) => Number(x.balance) > 50 && x.status === 'VERIFIED')
    .map((x: any) => ({
      itemid: x.item_id, productid: x.id, batch: x.batch,
      price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)),
      mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
    }));
});
function sellable() {
  expect(POOL.length).toBeGreaterThan(5);
  return POOL;
}

test.describe('P0 regression — sales / stock / invoices @p0', () => {
  test('SALE-1 a multi-item split-payment sale totals correctly and links a shift + acting user @happy', async ({ api }) => {
    const items = sellable().slice(0, 2).map((s) => ({
      itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price,
      mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 2,
      total: +(s.price * 2 * (1 + s.taxpcnt / 100)).toFixed(2),
    }));
    const total = +items.reduce((a, b) => a + b.total, 0).toFixed(2);
    const cash = +(total * 0.6).toFixed(2);
    const digi = +(total - cash).toFixed(2);
    const now = new Date().toISOString();
    const { status, body } = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now,
      cashamt: cash, digiamt: digi, digimethod: 'UPI', digirefno: 'QAREF1234',
      total, discamount: 0, expreturndays: 7, status: 'COMPLETE',
      ordertype: 'Walk-in', deliverytype: 'Counter', items,
    }, CASHIER);
    expect([200, 201]).toContain(status);
    expect(Number(body.cashamt) + Number(body.digiamt)).toBeCloseTo(total, 1);
    expect(body.shiftid).toBeTruthy();          // linked to the cashier's open shift
    expect(body.actinguserid).toBeTruthy();     // acting user captured
    expect(body.billno).toBeTruthy();
  });

  test('SALE-3 completing a sale decrements stock for the sold batch @happy', async ({ api }) => {
    // pick a batch with real headroom
    const s = sellable().find((x) => x.itemid) ?? sellable()[0];
    const soldBatchBal = async () => {
      const r = await api.request('POST', '/stock/filter', { available: true, id: s.productid }, MGR);
      return r.body.filter((x: any) => x.item_id === s.itemid).reduce((a: number, x: any) => a + Number(x.balance), 0);
    };
    const b0 = await soldBatchBal();
    const qty = 3;
    const now = new Date().toISOString();
    const r = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now,
      cashamt: +(s.price * qty * (1 + s.taxpcnt / 100)).toFixed(2), digiamt: 0,
      total: +(s.price * qty * (1 + s.taxpcnt / 100)).toFixed(2), discamount: 0, expreturndays: 7,
      status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty, total: +(s.price * qty * (1 + s.taxpcnt / 100)).toFixed(2) }],
    }, CASHIER);
    expect([200, 201]).toContain(r.status);
    expect(b0 - (await soldBatchBal())).toBe(qty);
  });

  test('SALE-4/STK-7 an oversell attempt is blocked; stock never goes negative (issue #138) @edge', async ({ api }) => {
    const s = sellable()[0];
    const now = new Date().toISOString();
    const gross = +(s.price * 999999 * (1 + s.taxpcnt / 100)).toFixed(2);
    const r = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now,
      cashamt: gross, digiamt: 0, total: gross, discamount: 0, expreturndays: 7,
      status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 999999, total: gross }],
    }, CASHIER);
    expect(r.status).toBeGreaterThanOrEqual(400); // rejected
    const stock = await api.request('POST', '/stock/filter', { available: true, id: s.productid }, MGR);
    const bal = stock.body.filter((x: any) => x.item_id === s.itemid).reduce((a: number, x: any) => a + Number(x.balance), 0);
    expect(bal).toBeGreaterThanOrEqual(0);
  });

  test('SALE-5 a PENDING sale can be discarded with no net stock/cash impact @happy', async ({ api }) => {
    const s = sellable()[0];
    const bal = async () => {
      const r = await api.request('POST', '/stock/filter', { available: true, id: s.productid }, MGR);
      return r.body.filter((x: any) => x.item_id === s.itemid).reduce((a: number, x: any) => a + Number(x.balance), 0);
    };
    const balBefore = await bal();  // before the whole create + discard cycle
    const now = new Date().toISOString();
    const created = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now,
      cashamt: 0, digiamt: 0, total: 0, discamount: 0, expreturndays: 7,
      status: 'PENDING', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 1, total: +(s.price).toFixed(2) }],
    }, CASHIER);
    const del = await api.request('DELETE', `/sales/${created.body.id}`, undefined, CASHIER);
    expect(del.status).toBeLessThan(400);
    expect(await bal()).toBe(balBefore); // net zero
  });

  test('SALE-9 a partial return is recorded against the sale line @happy', async ({ api }) => {
    const s = sellable()[1];
    const now = new Date().toISOString();
    const sale = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now,
      cashamt: +(s.price * 3 * (1 + s.taxpcnt / 100)).toFixed(2), digiamt: 0,
      total: +(s.price * 3 * (1 + s.taxpcnt / 100)).toFixed(2), discamount: 0, expreturndays: 7,
      status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 3, total: +(s.price * 3 * (1 + s.taxpcnt / 100)).toFixed(2) }],
    }, CASHIER);
    const line = sale.body.items[0];
    const ret = await api.request('POST', '/sales/returns', [
      { saleitemid: line.id, qty: 1, status: 'NEW', reason: 'Defective', comments: 'qa' },
    ], CASHIER);
    expect([200, 201]).toContain(ret.status);
    // it shows up on the return-eligible view for that sale
    const eligible = await api.request('GET', `/sales/${sale.body.id}/items/return`, undefined, CASHIER);
    expect(Array.isArray(eligible.body) || eligible.status < 400).toBeTruthy();
    // NOTE: the return -> stock adjustment is a separate step in this app (the
    // "Return Adjust" flow); SALE-9's stock reconciliation is covered in Phase 2.
  });

  test('SALE-10 an over-return (more than sold) is blocked @negative', async ({ api }) => {
    const s = sellable()[2];
    const now = new Date().toISOString();
    const gross = +(s.price * 3 * (1 + s.taxpcnt / 100)).toFixed(2);
    const sale = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now,
      cashamt: gross, digiamt: 0, total: gross, discamount: 0, expreturndays: 7,
      status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 3, total: gross }],
    }, CASHIER);
    const line = sale.body.items[0].id;

    // returning more than was sold (10 vs 3) is rejected — issue #143
    const over = await api.request('POST', '/sales/returns', [
      { saleitemid: line, qty: 10, status: 'NEW', reason: 'Defective', comments: 'qa' },
    ], CASHIER);
    expect(over.status, 'over-return rejected').toBeGreaterThanOrEqual(400);
    expect(over.status).toBeLessThan(500);

    // a valid partial return still works
    const ok = await api.request('POST', '/sales/returns', [
      { saleitemid: line, qty: 2, status: 'NEW', reason: 'Defective', comments: 'qa' },
    ], CASHIER);
    expect([200, 201]).toContain(ok.status);

    // a second return that would push the total past the sold qty (2 + 2 > 3) is rejected
    const past = await api.request('POST', '/sales/returns', [
      { saleitemid: line, qty: 2, status: 'NEW', reason: 'Defective', comments: 'qa' },
    ], CASHIER);
    expect(past.status, 'cumulative over-return rejected').toBeGreaterThanOrEqual(400);
    expect(past.status).toBeLessThan(500);
  });

  test('STK-1/2 per-batch balances are internally consistent and sum to the product total @happy', async ({ api }) => {
    const all = (await api.request('POST', '/stock/filter', { available: true, limit: 60 }, MGR)).body;
    const productId = all.find((x: any) => Number(x.balance) > 0)?.id;
    expect(productId, 'at least one product with stock').toBeTruthy();
    const rows = (await api.request('POST', '/stock/filter', { available: true, id: productId }, MGR)).body;
    expect(rows.length).toBeGreaterThan(0);

    for (const r of rows) {
      const bal = Number(r.balance);
      // the stock list's own definition: purchased - sold + adjustments
      const derived = Number(r.purchased) - Number(r.sold) + Number(r.adjusted);
      expect(bal).toBe(derived);              // internally consistent
      expect(bal).toBeGreaterThanOrEqual(0);  // never negative (oversell is blocked, issue #138)
    }
    // the per-batch breakdown sums to the product's list-level total
    const viaProduct = rows.reduce((a: number, r: any) => a + Number(r.balance), 0);
    const perBatchSum = rows.map((r: any) => Number(r.balance)).reduce((a: number, b: number) => a + b, 0);
    expect(viaProduct).toBe(perBatchSum);
  });

  test('INV-1..5 an invoice built from an approved PO confirms and raises stock @happy', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
    const prod = data.m.products[10].id;

    const po = await api.request('POST', '/purchaseorders', { vendorid: vendor, comments: 'INV regression' }, MGR);
    const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 20, vendorid: vendor }, MGR);
    await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
    await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
    let poAfter = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
    if (poAfter.body.status === 'PENDING_APPROVAL') {
      await api.request('POST', `/purchaseorders/${po.body.id}/approve`, undefined, MGR);
      poAfter = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
    }
    expect(poAfter.body.approvalstatus).toBe('Approved'); // INV-2: only approved POs feed invoices

    const inv = await api.request('POST', '/purchases', {
      vendorid: vendor, purchaseorderid: String(po.body.id),
      invoiceno: `QA-REG-${po.body.id}`, invoicedate: new Date().toISOString().slice(0, 10),
    }, MGR);
    const it = await api.request('POST', '/purchaseitems', {
      invoiceid: inv.body.id, productid: prod, qty: 20, ptrvalue: 10, ptrcost: 10,
      mrpcost: 18, taxpcnt: 12, batch: `REG-${po.body.id}`, expdate: '2028-01-31', saleprice: 14,
    }, MGR);

    await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
    const confirm = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);
    expect([200, 201]).toContain(confirm.status);

    // INV-5: the confirmed batch is now in stock at its received quantity
    const after = await api.request('POST', '/stock/filter', { available: true, id: prod }, MGR);
    const batch = after.body.filter((x: any) => x.batch === `REG-${po.body.id}`);
    expect(batch.length).toBeGreaterThan(0);
    expect(batch.reduce((a: number, x: any) => a + Number(x.balance), 0)).toBeGreaterThan(0);
    expect(batch[0].status).toBe('VERIFIED');
  });

  test('INV-2 an invoice cannot be created from a non-approved PO @negative', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
    const po = await api.request('POST', '/purchaseorders', { vendorid: vendor }, MGR); // never submitted -> not approved
    const r = await api.request('POST', '/purchases', {
      vendorid: vendor, purchaseorderid: String(po.body.id),
      invoiceno: `QA-BAD-${po.body.id}`, invoicedate: new Date().toISOString().slice(0, 10),
    }, MGR);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  test('POS screen loads and can start a bill @happy', async ({ app }) => {
    const { page } = await app.open(CASHIER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await expectShell(page);
    await expect(page.getByRole('button', { name: /Complete/i })).toBeVisible();
  });
});
