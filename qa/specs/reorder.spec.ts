/**
 * Reorder suggestions - RE-1..4
 * What to buy from what sold and what is on the shelf: a minimum stock per product, one store at a time, slow movers kept in view,
 * and demand scaled by how the same stretch of the year went in earlier years.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

const suggest = async (api: any, q: Record<string, any> = {}) =>
  (await api.request('GET', `/purchase-suggestions?includezero=true&${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()}`, undefined, MGR)).body as any[];

async function bigStock(api: any, minBalance: number, skip: number[] = []) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) >= minBalance && Number(x.sale_price) > 0 && !skip.includes(x.id));
  return rows[0];
}

async function sellAt(api: any, line: any, qty: number, daysAgo: number) {
  const when = new Date(Date.now() - daysAgo * 86400000).toISOString();
  const r = await api.request('POST', '/sales', {
    billdate: when, orderdate: when, cashamt: qty * 10, digiamt: 0, total: qty * 10, discamount: 0, expreturndays: 7, status: 'COMPLETE',
    ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: line.item_id, productid: line.id, batch: line.batch, price: 10, mrpcost: line.mrp_cost, taxpcnt: line.tax_pcnt, qty, total: qty * 10, status: 'Complete' }],
  }, COUNTER);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
}


/** a product of its own, with 200 units in a verified batch, so what it sold and when is the only history it has */
async function freshStocked(api: any) {
  const tag = `${Date.now()}`.slice(-8);
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const prod = await api.request('POST', '/products', { title: `QA REORDER ${tag}`, taxpcnt: 12, category: 'Analgesic', code: `RO${tag}`, pack: 1 }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-RO-${tag}`, invoicedate: new Date().toISOString().slice(0, 10) }, MGR);
  const total = +(200 * 20).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty: 200, ptrvalue: 20, ptrcost: 20, mrpcost: 30, saleprice: 25, taxpcnt: 12, total, batch: `RO-${tag}`, expdate: '2028-06-30',
  }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total } }, MGR);
  const rows = (await api.request('POST', '/stock/filter', { available: true, title: `QA REORDER ${tag}`, limit: 5 }, COUNTER)).body;
  const line = rows.find((r: any) => r.id === prod.body.id);
  expect(line, 'the new batch can be sold').toBeTruthy();
  return line;
}

const setMin = (api: any, id: number, minstock: number | null) => api.request('PUT', `/products/${id}`, { minstock }, MGR);

test.describe('Reorder suggestions @p1', () => {
  test('RE-1 a minimum stock is kept on top of what the cover period needs, and a product at or above it is not flagged @happy', async ({ api }) => {
    const line = await bigStock(api, 50);
    test.skip(!line, 'no product with stock');
    try {
      const before = (await suggest(api)).find((r) => r.product_id === line.id);
      const stock = before ? before.available_stock : Number(line.balance);
      const forecast = before ? before.forecast_qty : 0;
      const M = Math.ceil(stock) + 1000;
      expect((await setMin(api, line.id, M)).status).toBeLessThan(300);
      const after = (await suggest(api)).find((r) => r.product_id === line.id);
      expect(after, 'a product below its minimum is listed even with no demand').toBeTruthy();
      expect(after.min_stock).toBe(M);
      expect(after.trend_qty).toBe(forecast + M - Math.ceil(stock));
      expect(after.reasons).toContain('Below Minimum');
      // a minimum the stock already meets does not add anything
      expect((await setMin(api, line.id, 1)).status).toBeLessThan(300);
      const low = (await suggest(api)).find((r) => r.product_id === line.id);
      expect(low?.reasons ?? []).not.toContain('Below Minimum');
      expect((await setMin(api, line.id, -3)).status).toBe(400);                                // a minimum is not negative
    } finally { await setMin(api, line.id, null); }
  });

  test('RE-2 a store sees its own stock and sales; a store with no stock needs the whole minimum @happy', async ({ api }) => {
    const line = await bigStock(api, 50);
    test.skip(!line, 'no product with stock');
    const stores = (await api.request('POST', '/stores', { location: `RE Empty ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR));
    test.skip(stores.status >= 300, 'cannot create a store here');
    const empty = stores.body.id;
    try {
      expect((await setMin(api, line.id, 40)).status).toBeLessThan(300);
      const all = (await suggest(api)).find((r) => r.product_id === line.id);
      const there = (await suggest(api, { storeid: empty })).find((r) => r.product_id === line.id);
      expect(all?.available_stock ?? Number(line.balance)).toBeGreaterThan(0);
      expect(there, 'the empty store lists it: nothing on its shelf').toBeTruthy();
      expect(there.available_stock).toBe(0);
      expect(there.sales_qty).toBe(0);
      expect(there.trend_qty).toBe(40);                                                          // no demand there, so just the minimum (open requests are the business's, not a store's)
    } finally { await setMin(api, line.id, null); }
  });

  test('RE-3 a slow mover is listed when the longer look-back is wide enough, not otherwise @edge', async ({ api }) => {
    const line = await freshStocked(api);
    await sellAt(api, line, 10, 45);                                                             // sold 45 days ago: not in the last 30
    const narrow = (await suggest(api, { days: 30, slowdays: 30 })).find((r) => r.product_id === line.id);
    expect(narrow, 'a 30-day look-back does not see it').toBeUndefined();
    const wide = (await suggest(api, { days: 30, slowdays: 90 })).find((r) => r.product_id === line.id);
    expect(wide, 'a 90-day look-back does').toBeTruthy();
    expect(wide.sales_qty).toBe(0);
    expect(wide.long_qty).toBe(10);
    expect(wide.reasons).toContain('Slow Mover');
    expect(wide.avg_daily_sales).toBeCloseTo(10 / 90, 1);                                        // the longer window sets the pace
  });

  test('RE-4 demand is scaled by how this stretch of the year went last year, and the box turns it off @happy', async ({ api }) => {
    const line = await freshStocked(api);
    await sellAt(api, line, 12, 365 + 10);                                                       // last year, in the 30 days leading up to today
    await sellAt(api, line, 60, 365 - 8);                                                        // last year, in the stretch ahead
    await sellAt(api, line, 6, 3);                                                               // and something lately, so there is a pace to scale
    const on = (await suggest(api, { days: 30, targetdays: 21 })).find((r) => r.product_id === line.id);
    expect(on.season_factor).toBe(2.5);                                                          // (60/21) / (12/30) is far above the cap
    expect(on.reasons).toContain('Season Rising');
    const off = (await suggest(api, { days: 30, targetdays: 21, seasonal: 'false' })).find((r) => r.product_id === line.id);
    expect(off.season_factor).toBe(1);
    expect(on.forecast_qty).toBe(Math.ceil((6 / 30) * 2.5 * 21));                                // 6 sold in 30 days, times 2.5, over 21 days
    expect(off.forecast_qty).toBe(Math.ceil((6 / 30) * 21));
  });

  test('RE-4b a product that sold nothing lately but sold in this stretch last year is brought back by last year @edge', async ({ api }) => {
    const line = await freshStocked(api);
    await sellAt(api, line, 40, 365 - 8);                                                        // last year, in the stretch ahead
    const row = (await suggest(api, { days: 30, targetdays: 21 })).find((r) => r.product_id === line.id);
    expect(row, 'listed from last year alone').toBeTruthy();
    expect(row.sales_qty).toBe(0);
    expect(row.forecast_qty).toBe(40);
    expect(row.reasons).toContain('Sold Now Last Year');
    const off = (await suggest(api, { days: 30, targetdays: 21, seasonal: 'false' })).find((r) => r.product_id === line.id);
    expect(off, 'with seasonal off it is not').toBeUndefined();
  });

  test('RE-5 the Reorder page follows the store chosen at the top and shows season and minimum @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/purchases/suggestions');
    await expect(page.getByTestId('reo-store')).toContainText('All stores');
    await expect(page.getByTestId('reo-slow')).toBeVisible();
    await expect(page.getByTestId('reo-seasonal')).toBeChecked();
    const head = page.getByRole('tabpanel', { name: 'Reorder' }).locator('thead');
    await expect(head).toContainText('Season');
    await expect(head).toContainText('Min');
  });
});
