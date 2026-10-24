/**
 * Product prices and the product master — PRICE-1..5
 * A sale price is capped at the MRP, a runaway margin is refused, and only managers change the master.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

/** a fresh product whose latest purchase has the given cost (PTR) and MRP */
async function boughtProduct(api: any, ptr: number, mrp: number) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const prod = await api.request('POST', '/products', { title: `QA PRICE ${stamp}`, taxpcnt: 12, category: 'Analgesic', code: `PR${stamp}` }, MGR);
  expect(prod.status).toBeLessThan(300);
  const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
  const inv = await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA-PRICE-${stamp}`, invoicedate: '2026-09-01' }, MGR);
  expect(inv.status).toBeLessThan(300);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty: 5, ptrvalue: ptr, ptrcost: ptr, mrpcost: mrp,
    taxpcnt: 12, total: +(5 * ptr * 1.12).toFixed(2), batch: `PR-${stamp}`, expdate: '2028-06-30', saleprice: mrp,
  }, MGR);
  expect(it.status).toBeLessThan(300);
  return { id: prod.body.id as number, title: prod.body.title as string };
}

const addPrice = (api: any, productid: number, saleprice: number, who = MGR) =>
  api.request('POST', '/products/prices/add', { productid, saleprice, effdate: '2026-09-02', reason: 'Initial', comments: 'qa price', overridereason: 'qa spec' }, who);

test.describe('Product prices @p1', () => {
  test('PRICE-1 a price above the MRP is capped at the MRP @edge', async ({ api }) => {
    const p = await boughtProduct(api, 100, 200);
    const r = await addPrice(api, p.id, 250);
    expect(r.status).toBeLessThan(300);
    expect(r.body.capped).toBe(true);
    expect(Number(r.body.saleprice)).toBe(190.47);                // MRP 200 less the 5% GST the till bills (GST 2.0): the customer pays at most the MRP
    expect(r.body.mrp).toBe(200);
    // an ordinary price is untouched
    const ok = await api.request('POST', '/products/prices/add', { productid: p.id, saleprice: 150, effdate: '2026-09-05', reason: 'Market', overridereason: 'qa spec' }, MGR);
    expect(ok.body.capped).toBe(false);
    expect(Number(ok.body.saleprice)).toBe(150);
    expect(ok.body.warnings).toEqual([]);
    // a price edit goes through the same rule
    const upd = await api.request('PUT', `/products/prices/${ok.body.id}`, { saleprice: 999, overridereason: 'qa spec' }, MGR);
    expect(upd.status).toBeLessThan(300);
    const hist = (await api.request('GET', `/products/prices/${p.id}`, undefined, MGR)).body.history;
    expect(hist.every((h: any) => Number(h.sale_price) <= 200)).toBe(true);
  });

  test('PRICE-2 a margin over 300% is saved with a warning, over 1,000% is refused, below cost warns @negative', async ({ api }) => {
    const p = await boughtProduct(api, 40, 600);
    const warn = await addPrice(api, p.id, 180);                 // 350%
    expect(warn.status).toBeLessThan(300);
    expect(warn.body.warnings.join(' ')).toContain('High margin');
    const refused = await api.request('POST', '/products/prices/add', { productid: p.id, saleprice: 500, effdate: '2026-09-09', reason: 'Initial' }, MGR);   // 1150%
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toContain('typing mistake');

    const q = await boughtProduct(api, 100, 200);
    const below = await api.request('POST', '/products/prices/add', { productid: q.id, saleprice: 90, effdate: '2026-09-09', reason: 'Market', overridereason: 'qa spec' }, MGR);
    expect(below.status).toBeLessThan(300);
    expect(below.body.warnings.join(' ')).toContain('below the purchase cost');

    expect((await addPrice(api, q.id, 0)).status).toBe(400);
    expect((await addPrice(api, q.id, -5)).status).toBe(400);
  });

  test('PRICE-3 only managers change the product master @negative', async ({ api }) => {
    const p = await boughtProduct(api, 10, 30);
    const asSales = (m: string, path: string, body?: any) => api.request(m, path, body, SALES);
    expect((await asSales('POST', '/products', { title: `QA SALES ${Date.now()}`, taxpcnt: 12, category: 'Analgesic' })).status).toBe(403);
    expect((await asSales('PUT', `/products/${p.id}`, { binlocation: 'Z-9' })).status).toBe(403);
    expect((await asSales('DELETE', `/products/${p.id}`)).status).toBe(403);
    expect((await asSales('POST', '/products/prices/add', { productid: p.id, saleprice: 20, reason: 'Initial' })).status).toBe(403);
    // the counter still reads products
    expect((await asSales('POST', '/products/filter2', { active: true, title: '' })).status).toBeLessThan(300);
    // the manager can
    expect((await api.request('PUT', `/products/${p.id}`, { binlocation: 'Z-9' }, MGR)).status).toBeLessThan(300);
  });

  test('PRICE-4 the price list takes the title as data, not as SQL @negative', async ({ api }) => {
    const p = await boughtProduct(api, 10, 30);
    const find = (criteria: any) => api.request('POST', '/products/prices', criteria, MGR);
    const byTitle = await find({ active: true, title: p.title.slice(0, 14) });
    expect(byTitle.status).toBeLessThan(300);
    expect(byTitle.body.some((r: any) => r.id === p.id)).toBe(true);
    const inject = await find({ active: true, title: "x' or '1'='1" });
    expect(inject.status).toBeLessThan(300);
    expect(inject.body).toEqual([]);                                     // not "every product"
    const wild = await find({ active: true, title: '%' });
    expect(wild.status).toBeLessThan(300);
    expect(wild.body).toEqual([]);                                       // % is a character, not a wildcard
    expect((await find({ active: '1; drop table product', title: '' })).status).toBeLessThan(300);
    expect((await find({ active: true, title: '' })).body.length).toBeGreaterThan(0);
  });

  test('PRICE-5 the price page flags problem rows and the dialog explains the cap @happy', async ({ app, api }) => {
    const p = await boughtProduct(api, 100, 200);
    const { page } = await app.open(MGR, '/secure/products/price');
    await expectShell(page);
    await expect(page.getByTestId('price-flag-filter')).toBeVisible();
    await page.getByPlaceholder('Product').fill(p.title);
    const row = page.locator('tbody tr', { hasText: p.title });
    await expect(row).toHaveCount(1);
    await row.locator('i.bi-pencil-square').click();
    await expect(page.getByTestId('price-mrp')).toContainText('200');
    await page.getByTestId('price-reason').selectOption('Initial');
    await page.getByTestId('price-dialog-price').fill('250');
    await expect(page.getByTestId('price-note-cap')).toBeVisible();
    await page.getByTestId('price-dialog-price').fill('60');
    await expect(page.getByTestId('price-note-below')).toBeVisible();
    await page.getByTestId('price-dialog-price').fill('1500');                       // capped to 200: 100% margin, fine
    await expect(page.getByTestId('price-note-cap')).toBeVisible();
    await page.getByTestId('price-dialog-price').fill('170');
    await expect(page.getByTestId('price-note-cap')).toHaveCount(0);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/products/prices/add')),
      page.getByTestId('price-save').click(),
    ]);
    expect(resp.status()).toBeLessThan(300);
    await expect(page.getByTestId('price-message')).toContainText('Price saved at 170');
  });

  test('PRICE-7 the price calculator is a panel on the Price page, not a menu popup @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/products/price');
    await expectShell(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await expect(page.locator('#sidebar-nav').getByText('Pricing', { exact: true })).toHaveCount(0);   // no longer in the left menu
    const panel = page.getByTestId('price-calc-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('input[type=number]')).toHaveCount(2);

    // typing a cost before a category is picked must not break anything
    await panel.locator('input[type=number]').nth(0).fill('100');
    await panel.locator('input[type=number]').nth(1).fill('300');
    // Generic: at least 50% on cost, at most 80% off MRP -> 150
    await panel.locator('select').selectOption('Generic');
    await expect(panel).toContainText('150');
    expect(errors).toEqual([]);

    // hide and show; the choice is remembered
    await page.getByTestId('price-calc-toggle').click();
    await expect(panel.locator('input[type=number]')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('price-calc-panel').locator('input[type=number]')).toHaveCount(0);
    await page.getByTestId('price-calc-toggle').click();
    await expect(page.getByTestId('price-calc-panel').locator('input[type=number]')).toHaveCount(2);
  });
});
