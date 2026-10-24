/**
 * Price policy — POLICY-1..4
 * A price below the class floor needs an approver and a reason; a raise is stepped and held between steps; a price above the legal
 * ceiling (MRP less the GST billed, 5%) is brought down; only the Business Head edits the class table. Product: cost 100 per pack,
 * MRP 200, batch GST 12%, no sales yet, so class MID_C: floor markup 25% (125.00), ceiling 190.47.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

let lastInvoice = 0;
async function boughtProduct(api: any, complete = true) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const prod = await api.request('POST', '/products', { title: `QA POLICY ${stamp}`, taxpcnt: 12, category: 'Analgesic', code: `PO${stamp}` }, MGR);
  expect(prod.status).toBeLessThan(300);
  const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
  const inv = await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA-POL-${stamp}`, invoicedate: '2026-09-01' }, MGR);
  expect(inv.status).toBeLessThan(300);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty: 5, ptrvalue: 100, ptrcost: 100, mrpcost: 200,
    taxpcnt: 12, total: 560, batch: `PO-${stamp}`, expdate: '2028-06-30', saleprice: 200,
  }, MGR);
  expect(it.status).toBeLessThan(300);
  lastInvoice = inv.body.id;
  // the policy takes cost from completed purchases only
  if (complete) {
    const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: 560 } }, MGR);
    expect(done.status).toBeLessThan(300);
  }
  return prod.body.id as number;
}

const setPrice = (api: any, productid: number, saleprice: number, extra: any = {}) =>
  api.request('POST', '/products/prices/add', { productid, saleprice, reason: 'Market', ...extra }, MGR);

const queueRow = async (api: any, productid: number) =>
  ((await api.request('GET', '/pricing/review', undefined, MGR)).body.items || []).find((i: any) => i.productid === productid);

test.describe('Price policy @p1', () => {
  test('POLICY-1 a price below the class floor needs a reason, and is recorded @edge', async ({ api }) => {
    const id = await boughtProduct(api);
    expect((await setPrice(api, id, 170)).status).toBeLessThan(300);               // in bounds: no reason needed
    const refused = await setPrice(api, id, 110);
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toContain('overridereason');
    const ok = await setPrice(api, id, 110, { overridereason: 'clearing the batch' });
    expect(ok.status).toBeLessThan(300);
    expect(String(ok.body.comments)).toContain('Policy override: clearing the batch');
  });

  test('POLICY-2 the queue proposes one step, held until the price has been in force long enough @happy', async ({ api }) => {
    const id = await boughtProduct(api);
    await setPrice(api, id, 170);
    await setPrice(api, id, 110, { overridereason: 'clearing the batch' });
    const row = await queueRow(api, id);
    expect(row).toBeTruthy();
    expect(row.action).toBe('RAISE');
    expect(row.target).toBe(125);
    expect(row.next).toBe(119.52);                                                   // a step: the smaller of 10% of 110 and 5% of 190.47
    expect(row.waituntil).toBeTruthy();                                              // it was changed today
    const held = await api.request('POST', '/pricing/apply', { productid: id }, MGR);
    expect(held.status).toBe(400);
    expect(JSON.stringify(held.body)).toContain('held until');
  });

  test('POLICY-3 only managers apply a step and only the Business Head edits the class table @negative', async ({ api }) => {
    const id = await boughtProduct(api);
    const sales = await api.request('POST', '/pricing/apply', { productid: id }, SALES);
    expect(sales.status).toBe(403);
    const edit = await api.request('PUT', '/pricing/policy/MID_C', { floor: 25, cap: 60 }, SALES);
    expect(edit.status).toBe(403);
    const bad = await api.request('PUT', '/pricing/policy/MID_C', { floor: 25, cap: 99 }, MGR);
    expect(bad.status).toBe(400);
  });

  test('POLICY-5 the server refuses a completed bill that charges more than the MRP @edge', async ({ api }) => {
    const COUNTER = 'sales1@local.test';
    const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
      .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0 && Number(x.price_ceiling) > 0);
    const r = rows[0];
    expect(r).toBeTruthy();
    const ceiling = Number(r.price_ceiling);                                          // sent to the till (it may not see the MRP): the most a unit may cost before GST
    const m = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
    const c = await api.request('POST', '/customers', { name: 'QA Guard Customer', mobile: m, srctype: 'Walkin' }, MGR);
    const now = new Date().toISOString();
    const bill = (price: number) => {
      const total = +(price * 1.05).toFixed(2);
      return api.request('POST', '/sales', {
        customerid: c.body.id, billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE',
        ordertype: 'Walk-in', deliverytype: 'Counter',
        items: [{ itemid: r.item_id, productid: r.id, batch: r.batch, price, mrpcost: price, taxpcnt: 5, qty: 1, total, status: 'Complete' }],
      }, COUNTER);
    };
    const setting = (await api.request('GET', '/settings?key=sale_mrp_guard', undefined, MGR)).body[0];
    expect(setting).toBeTruthy();
    const put = (value: string) => api.request('PUT', `/settings/${setting.id}`, { value }, MGR);
    try {
      expect((await put('on')).status).toBeLessThan(300);
      const over = await bill(+(ceiling + 1).toFixed(2));                                // price + 5% GST is above the MRP
      expect(over.status).toBe(400);
      expect(JSON.stringify(over.body)).toContain('cannot charge more than the MRP');
      const ok = await bill(ceiling);                                                    // exactly the highest allowed price
      expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    } finally {
      await put('off');
    }
  });

  test('POLICY-6 a price above the legal ceiling cannot be accepted as an exception @negative', async ({ api }) => {
    const queue = (await api.request('GET', '/pricing/review', undefined, MGR)).body;
    const cut = (queue.items || []).find((i: any) => i.action === 'CUT');
    test.skip(!cut, 'no price above the legal ceiling in this data');
    const r = await api.request('POST', '/pricing/exceptions', { productid: cut.productid, reason: 'qa try', until: '2099-01-01' }, MGR);
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('legal ceiling');
  });

  test('POLICY-7 the pricing rules can be read and changed by the Business Head only, within limits @negative', async ({ api }) => {
    const read = await api.request('GET', '/pricing/rules', undefined, MGR);
    expect(read.status).toBe(200);
    expect(read.body.canedit).toBe(true);
    const keys = read.body.rules.map((r: any) => r.key);
    expect(keys).toEqual(expect.arrayContaining(['price_step_pct', 'price_step_days', 'sale_mrp_guard', 'price_tolerance_pct']));
    const original = read.body.rules.find((r: any) => r.key === 'price_step_pct').value;

    expect((await api.request('PUT', '/pricing/rules', { values: { price_step_pct: 12 } }, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/pricing/rules', { values: { price_step_pct: 80 } }, MGR)).status).toBe(400);      // over the limit
    expect((await api.request('PUT', '/pricing/rules', { values: { nonsense: 1 } }, MGR)).status).toBe(400);              // unknown rule
    expect((await api.request('PUT', '/pricing/rules', { values: { sale_gst_cap_pct: 12 } }, MGR)).status).toBe(400);    // fixed rule
    expect((await api.request('PUT', '/pricing/rules', { values: { price_tolerance_pct: 6 } }, MGR)).status).toBe(400);  // would reach the approval level (5)
    try {
      const ok = await api.request('PUT', '/pricing/rules', { values: { price_step_pct: 12 } }, MGR);
      expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
      expect(ok.body.changed).toEqual(['price_step_pct']);
      const after = (await api.request('GET', '/pricing/review', undefined, MGR)).body;
      expect(after.settings.stepPricePct).toBe(12);                                                                     // the queue uses it at once
    } finally {
      await api.request('PUT', '/pricing/rules', { values: { price_step_pct: Number(original) } }, MGR);
    }
  });

  test('POLICY-8 a product with stock and no price is offered a suggested first price @happy', async ({ api }) => {
    const id = await boughtProduct(api);                                             // cost 100, MRP 200: MID_C, usual discount 20%
    const row = ((await api.request('GET', '/pricing/review', undefined, MGR)).body.unpriced || []).find((u: any) => u.productid === id);
    expect(row).toBeTruthy();
    expect(row.suggestion.price).toBe(152.38);                                       // 200 x 0.8 / 1.05, between the lowest price 125 and the ceiling 190.47
    expect(row.canapply).toBe(true);
    expect((await api.request('POST', '/pricing/price-new', { productid: id }, SALES)).status).toBe(403);
    const ok = await api.request('POST', '/pricing/price-new', { productid: id }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body.price).toBe(152.38);
    const after = ((await api.request('GET', '/pricing/review', undefined, MGR)).body.unpriced || []).find((u: any) => u.productid === id);
    expect(after).toBeUndefined();
    expect((await api.request('POST', '/pricing/price-new', { productid: id }, MGR)).status).toBe(400);   // already priced
    const hist = (await api.request('GET', `/products/prices/${id}`, undefined, MGR)).body.history;
    expect(hist[0].reason).toBe('Initial');
    expect(String(hist[0].comments)).toContain('pricing policy');
  });

  test('POLICY-9 an invoice line shows what its cost and MRP mean for the product price @happy', async ({ api }) => {
    const id = await boughtProduct(api, false);                                      // the invoice is still a draft
    const first = (await api.request('GET', `/pricing/invoice/${lastInvoice}/impact`, undefined, MGR)).body;
    expect(first.lines).toHaveLength(1);
    expect(first.lines[0].status).toBe('NO_PRICE');
    expect(first.lines[0].suggestion.price).toBe(152.38);
    expect(first.needsprice).toBe(1);
    await api.request('PUT', '/purchases/confirm', { ids: [lastInvoice], values: { status: 'COMPLETE', total: 560 } }, MGR);
    expect((await api.request('POST', '/pricing/price-new', { productid: id }, MGR)).status).toBeLessThan(300);
    const priced = (await api.request('GET', `/pricing/invoice/${lastInvoice}/impact`, undefined, MGR)).body;
    expect(priced.lines[0].status).toBe('OK');
    expect(priced.lines[0].curprice).toBe(152.38);
    expect(priced.lines[0].markuppct).toBeCloseTo(52.38, 1);
  });

  test('POLICY-4 the review queue reports totals and the class counts @happy', async ({ api }) => {
    const r = await api.request('GET', '/pricing/review', undefined, MGR);
    expect(r.status).toBe(200);
    expect(r.body.summary.products).toBeGreaterThan(0);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(r.body.settings.stepDays).toBeGreaterThan(0);
    const policy = await api.request('GET', '/pricing/policy', undefined, MGR);
    expect(policy.body.classes.length).toBe(9);
  });
});
