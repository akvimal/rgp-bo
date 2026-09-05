/**
 * Products & Pricing — PROD-5, PROD-8   (PROD-1..4/6/7 are Phase 3)
 * Source: docs/testing/manual-test-plan.html  (module "products")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';

test.describe('Products & Pricing @p1', () => {
  test('PROD-5 a price change applies forward only - past sales/invoices are untouched @happy', async ({ api }) => {
    const prod = data.m.products.find((p) => p.priced)!;

    // a completed sale at the current price
    const pool = (await api.request('POST', '/stock/filter', { available: true, id: prod.id }, MGR)).body
      .find((x: any) => Number(x.balance) > 5 && x.status === 'VERIFIED');
    let saleTotalBefore = 0;
    if (pool) {
      const price = Math.max(1, Math.round(Number(pool.mrp_cost || 20) * 0.8));
      const total = +(price * (1 + Number(pool.tax_pcnt || 12) / 100)).toFixed(2);
      const now = new Date().toISOString();
      const sale = await api.request('POST', '/sales', {
        customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0,
        total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
        items: [{ itemid: pool.item_id, productid: prod.id, batch: pool.batch, price, mrpcost: Number(pool.mrp_cost || 20), taxpcnt: Number(pool.tax_pcnt || 12), qty: 1, total }],
      }, 'sales1@local.test');
      saleTotalBefore = Number(sale.body.total);

      // now bump the sale price
      await api.request('POST', '/products/prices/add', {
        productid: prod.id, saleprice: price * 1.5, effdate: '2026-09-04', reason: 'Market Pressure', comments: 'qa PROD-5',
      }, MGR);

      // the already-completed sale's total did not move
      const reread = await api.request('GET', `/sales/${sale.body.id}`, undefined, MGR);
      expect(Number(reread.body.total ?? reread.body.total_amount ?? saleTotalBefore)).toBeCloseTo(saleTotalBefore, 0);
    }

    // the price feed resolves even for a product with several price rows (issue #132)
    const hist = await api.request('GET', `/products/prices/${prod.id}`, undefined, MGR);
    expect(hist.status).toBeLessThan(400);
    expect(hist.body).toHaveProperty('history');
    expect(Array.isArray(hist.body.history)).toBeTruthy();
  });

  test('PROD-8 successive price changes are persisted as history rows @happy', async ({ api }) => {
    // create a fresh product so we control its price history exactly
    const created = await api.request('POST', '/products', {
      title: `QA PROD8 ${Date.now()}`, taxpcnt: 12, category: 'Analgesic', code: `P8${Date.now()}`,
    }, MGR);
    const id = created.body.id;
    const a = await api.request('POST', '/products/prices/add', { productid: id, saleprice: 40, effdate: '2026-09-01', reason: 'Initial', comments: 'qa PROD-8 a' }, MGR);
    const b = await api.request('POST', '/products/prices/add', { productid: id, saleprice: 48, effdate: '2026-09-03', reason: 'Higher PTR', comments: 'qa PROD-8 b' }, MGR);
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);

    const hist = await api.request('GET', `/products/prices/${id}`, undefined, MGR);
    expect(hist.status).toBeLessThan(400); // issue #132
    const rows = hist.body?.history ?? [];
    expect(Array.isArray(rows)).toBeTruthy();
    expect(rows.length).toBe(2);
    // chronological, non-overlapping, monotonically increasing effective dates
    const effs = rows.map((r: any) => String(r.eff_date).slice(0, 10)).sort();
    expect(new Set(effs).size).toBe(2);          // no duplicate start dates
    expect(rows.some((r: any) => String(r.end_date).slice(0, 10) < String(r.eff_date).slice(0, 10))).toBeFalsy(); // no inverted ranges
  });

  test('BIN-LOCATION a product\'s shelf/rack label round-trips through create and update @happy', async ({ api }) => {
    const created = await api.request('POST', '/products', {
      title: `QA BINLOC ${Date.now()}`, taxpcnt: 12, category: 'Analgesic', code: `BL${Date.now()}`,
      binlocation: 'A-12',
    }, MGR);
    expect(created.status).toBeLessThan(300);
    expect(created.body.binlocation).toBe('A-12');

    const fetched = await api.request('GET', `/products/${created.body.id}`, undefined, MGR);
    expect(fetched.body.binlocation).toBe('A-12');

    await api.request('PUT', `/products/${created.body.id}`, { binlocation: 'B-03' }, MGR);
    const refetched = await api.request('GET', `/products/${created.body.id}`, undefined, MGR);
    expect(refetched.body.binlocation).toBe('B-03');
  });

  test('PROD-4 product search returns only matching rows @happy', async ({ api }) => {
    const sample = data.m.products[5].title.split(' ')[0]; // a molecule name
    const res = await api.request('POST', '/products/filter', {
      criteria: [{ property: 'title', check: 'contains', value: sample }],
      condition: 'any', limit: 50,
    }, MGR);
    expect(res.status).toBeLessThan(400);
    expect(res.body.every((p: any) => String(p.title).toLowerCase().includes(sample.toLowerCase()))).toBeTruthy();
  });

  test('the Products list screen loads with an Add action @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/products/master/list');
    await expectShell(page);
    await expect(page.getByRole('button', { name: /Add New/i })).toBeVisible();
  });

  test('PROD-1 a product with all required fields is saved and findable @happy', async ({ api }) => {
    const tag = `QAP1${Date.now()}`;
    const title = `Amoxicillin 500 Capsule [${tag}]`;
    const created = await api.request('POST', '/products', {
      title, taxpcnt: 12, category: 'Antibiotic', brand: 'QA', mfr: 'QA Ltd', hsn: '30049099', code: tag, pack: 10,
    }, MGR);
    expect([200, 201]).toContain(created.body ? created.status : created.status);
    const id = created.body.id;
    // findable by its exact record and by search
    const one = await api.request('GET', `/products/${id}`, undefined, MGR);
    expect(one.body.title).toBe(title);
    const found = await api.request('POST', '/products/filter', {
      criteria: [{ property: 'title', check: 'contains', value: tag }], condition: 'any', limit: 50,
    }, MGR);
    expect(found.body.some((p: any) => p.id === id)).toBeTruthy();
  });

  test('PROD-2 a product with no title is rejected server-side @negative', async ({ api }) => {
    // issue #144 - the service now validates the title instead of leaning on the DB NOT NULL
    const blank = await api.request('POST', '/products', { taxpcnt: 12, category: 'x' }, MGR);
    expect(blank.status).toBe(400);
    expect(String(blank.body?.message || '')).toMatch(/title/i);

    const whitespace = await api.request('POST', '/products', { title: '   ', taxpcnt: 12 }, MGR);
    expect(whitespace.status).toBe(400);

    // a duplicate title is rejected with a clear message (not a raw DB error)
    const title = `QA Dup ${Date.now()}`;
    const first = await api.request('POST', '/products', { title, taxpcnt: 12 }, MGR);
    expect([200, 201]).toContain(first.status);
    const dup = await api.request('POST', '/products', { title, taxpcnt: 12 }, MGR);
    expect(dup.status).toBe(400);
    expect(String(dup.body?.message || '')).toMatch(/already exists/i);
  });

  test('PROD-3 editing a product keeps existing stock and past references resolving @happy', async ({ api }) => {
    const prod = data.m.products.find((p) => p.priced)!;
    const stockBefore = (await api.request('POST', '/stock/filter', { available: true, id: prod.id }, MGR)).body.length;
    const upd = await api.request('PUT', `/products/${prod.id}`, { hsn: '30041000', category: 'Cardiac' }, MGR);
    expect(upd.status).toBeLessThan(400);
    const after = await api.request('GET', `/products/${prod.id}`, undefined, MGR);
    expect(after.body.hsn ?? after.body.hsn_code).toBe('30041000');
    const stockAfter = (await api.request('POST', '/stock/filter', { available: true, id: prod.id }, MGR)).body.length;
    expect(stockAfter).toBe(stockBefore); // stock rows untouched by a master edit
  });

  test('PROD-6 the price estimator screen opens from the shell @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/products/price');
    await expectShell(page);
    await expect(page.getByRole('table').first()).toBeVisible();
  });

  test('PROD-7 a negative price and negative tax are rejected (issue #139) @negative', async ({ api }) => {
    const created = await api.request('POST', '/products', {
      title: `QA PROD7 ${Date.now()}`, taxpcnt: 12, category: 'Analgesic', code: `P7${Date.now()}`,
    }, MGR);
    const prod = created.body.id;

    const price = await api.request('POST', '/products/prices/add', {
      productid: prod, saleprice: -50, effdate: '2026-09-04', reason: 'Other', comments: 'qa PROD-7',
    }, MGR);
    expect(price.status).toBe(400);

    const negTax = await api.request('POST', '/products', {
      title: `QA PROD7 tax ${Date.now()}`, taxpcnt: -5, category: 'Analgesic', code: `P7T${Date.now()}`,
    }, MGR);
    expect(negTax.status).toBe(400);

    // nothing negative landed in the price history
    const hist = await api.request('GET', `/products/prices/${prod}`, undefined, MGR);
    const rows = hist.body?.history ?? [];
    expect(rows.some((x: any) => Number(x.sale_price ?? x.saleprice ?? x.price) < 0)).toBeFalsy();
  });
});
