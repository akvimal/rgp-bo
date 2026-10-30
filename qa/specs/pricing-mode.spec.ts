/**
 * How a business prices - PM-1..5
 * At the MRP, a discount off the MRP, or smart groups; prices shown with GST included or before GST. The choice changes what every price check
 * judges, so a price below the MRP under "At the MRP" is out of policy and is brought up in one step, with no stepping.
 * Product: cost 100 per pack, MRP 200, batch GST 12%, so the till bills 5% GST and the ceiling is 190.47.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

// the pricing mode is one setting for the whole business: these tests change it, so they run one after another
test.describe.configure({ mode: 'serial' });

let original: any = null;
const getMode = async (api: any) => (await api.request('GET', '/pricing/mode', undefined, MGR)).body.settings;
const putMode = (api: any, body: any) => api.request('PUT', '/pricing/mode', body, MGR);

test.beforeEach(async ({ api }) => { original = await getMode(api); });
test.afterEach(async ({ api }) => { if (original) await putMode(api, original); });

let lastInvoice = 0;                                                                      // the invoice the last bought product arrived on
async function boughtProduct(api: any) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const prod = await api.request('POST', '/products', { title: `QA PMODE ${stamp}`, taxpcnt: 12, category: 'Analgesic', code: `PM${stamp}` }, MGR);
  expect(prod.status).toBeLessThan(300);
  const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
  const inv = await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA-PM-${stamp}`, invoicedate: '2026-09-01' }, MGR);
  expect(inv.status).toBeLessThan(300);
  lastInvoice = inv.body.id;
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty: 5, ptrvalue: 100, ptrcost: 100, mrpcost: 200, taxpcnt: 12, total: 560, batch: `PM-${stamp}`, expdate: '2028-06-30', saleprice: 170,
  }, MGR);
  expect(it.status).toBeLessThan(300);
  expect((await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: 560 } }, MGR)).status).toBeLessThan(300);
  return prod.body.id as number;
}
const setPrice = (api: any, productid: number, saleprice: number, extra: any = {}) => api.request('POST', '/products/prices/add', { productid, saleprice, reason: 'Market', ...extra }, MGR);
const queueRow = async (api: any, productid: number) => ((await api.request('GET', '/pricing/review', undefined, MGR)).body.items || []).find((i: any) => i.productid === productid);

test('PM-1 the owner reads and changes how the business prices; nobody else can, and a bad choice is refused', async ({ api }) => {
  expect(original).toMatchObject({ mode: 'SMART', basis: 'excl' });                       // a business that already prices keeps how it worked
  expect((await putMode(api, { mode: 'MRP', basis: 'incl' })).status).toBeLessThan(300);
  expect(await getMode(api)).toMatchObject({ mode: 'MRP', basis: 'incl' });
  expect((await api.request('PUT', '/pricing/mode', { mode: 'MRP' }, SALES)).status).toBe(403);
  expect((await api.request('PUT', '/pricing/mode', { mode: 'MRP' }, 'storehead@local.test')).status).toBe(403);
  const bad = await putMode(api, { mode: 'SOMETIMES' });
  expect(bad.status).toBe(400);
  expect(JSON.stringify(bad.body)).toContain('how you price');
  expect((await putMode(api, { mode: 'DISCOUNT', discountPct: 30, maxDiscountPct: 20 })).status).toBe(400);
  expect(await getMode(api)).toMatchObject({ mode: 'MRP' });                              // the refused ones changed nothing
});

test('PM-2 at the MRP a price below the MRP is out of policy and is raised to the MRP in one step, not held', async ({ api }) => {
  const id = await boughtProduct(api);
  await setPrice(api, id, 170);                                                           // fine in smart groups
  expect((await putMode(api, { mode: 'MRP' })).status).toBeLessThan(300);

  const row = await queueRow(api, id);
  expect(row).toBeTruthy();
  expect(row.action).toBe('RAISE');
  expect(row.target).toBe(190.47);                                                        // the MRP less the GST the till bills
  expect(row.next).toBe(190.47);                                                          // straight there: no steps
  expect(row.waituntil).toBeNull();                                                       // and not held, though the price was just set

  const check = await api.request('GET', `/pricing/product/${id}/check?price=150`, undefined, MGR);
  expect(check.body.check.violations.length).toBeGreaterThan(0);
  const applied = await api.request('POST', '/pricing/apply', { productid: id }, MGR);
  expect(applied.status).toBeLessThan(300);
  expect(applied.body.to).toBe(190.47);
  expect(await queueRow(api, id)).toBeUndefined();                                        // now at the MRP, nothing out of policy
});

test('PM-3 with a discount off the MRP, a price inside the deepest discount is fine and a deeper one needs a reason', async ({ api }) => {
  const id = await boughtProduct(api);
  expect((await putMode(api, { mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 15, minMarginPct: 0 })).status).toBeLessThan(300);
  expect((await setPrice(api, id, 175)).status).toBeLessThan(300);                         // 175 + 5% GST = 183.75: 8% off
  const deep = await setPrice(api, id, 150);                                               // 150 + 5% GST = 157.50: 21% off
  expect(deep.status).toBe(400);
  expect(JSON.stringify(deep.body)).toContain('overridereason');
  expect((await setPrice(api, id, 150, { overridereason: 'clearing the batch' })).status).toBeLessThan(300);
});

test('PM-4 a worked example shows what a setting does before it is saved, and saves nothing', async ({ api }) => {
  const mrp = await api.request('POST', '/pricing/mode/preview', { mode: 'MRP', mrp: 100, cost: 70, tax: 5 }, MGR);
  expect(mrp.body.preview).toMatchObject({ priceIncl: 100, price: 95.23 });
  expect(mrp.body.preview.summary).toContain('Sells at the MRP: 100.00 with GST');
  const d = await api.request('POST', '/pricing/mode/preview', { mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 15, mrp: 100, cost: 70, tax: 5 }, MGR);
  expect(d.body.preview.priceIncl).toBeCloseTo(90, 1);
  expect(d.body.preview.lowestIncl).toBeCloseTo(85, 1);
  expect((await api.request('POST', '/pricing/mode/preview', { mode: 'SMART', mrp: 100, cost: 70, tax: 5 }, MGR)).body.preview).toBeNull();
  expect(await getMode(api)).toMatchObject(original);                                      // nothing was saved
});

test('PM-5 the screens: choose how to price with a worked example, see it on the policy page, and prices show with GST when the business says so', async ({ app, api }) => {
  const { page } = await app.open(MGR, '/secure/products/pricing-rules');
  await expect(page.getByTestId('mode-cards')).toBeVisible();
  await page.getByTestId('mode-card-MRP').click();
  await expect(page.getByTestId('mode-example-summary')).toContainText('Sells at the MRP');
  await page.getByTestId('mode-basis-incl').check();
  await page.getByTestId('mode-save').click();
  await expect(page.getByTestId('mode-message')).toBeVisible();
  expect(await getMode(api)).toMatchObject({ mode: 'MRP', basis: 'incl' });

  await page.getByTestId('mode-card-DISCOUNT').click();
  await expect(page.getByTestId('mode-max-discount')).toBeVisible();
  await expect(page.getByTestId('mode-example-summary')).toContainText('% off the MRP');

  const policy = await app.open(MGR, '/secure/products/pricing-policy');
  await expect(policy.page.getByTestId('policy-mode-text')).toContainText('You sell at the MRP');
  await expect(policy.page.getByTestId('policy-basis-note')).toBeVisible();

  const list = await app.open(MGR, '/secure/products/price');
  await expect(list.page.getByRole('columnheader', { name: /Price with GST/ })).toBeVisible();
});

test('PM-6 with GST included the price dialog takes what the customer pays, caps it at the MRP, and stores the price before GST', async ({ app, api }) => {
  expect((await putMode(api, { mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 15, basis: 'incl' })).status).toBeLessThan(300);
  const id = await boughtProduct(api);
  const title = (await api.request('GET', `/products/prices/${id}`, undefined, MGR)).body?.price?.title as string;
  const { page } = await app.open(MGR, '/secure/products/price');
  await page.getByPlaceholder('Product').fill(title);
  const row = page.locator('tbody tr', { hasText: title });
  await expect(page.locator('tbody tr')).toHaveCount(1);                                    // the list has finished filtering, so the row will not move under the click
  await expect(row).toHaveCount(1);
  await row.locator('i.bi-pencil-square').click();
  await expect(page.getByTestId('price-basis-note')).toContainText('include GST');
  await page.getByTestId('price-reason').selectOption('Initial');
  await page.getByTestId('price-dialog-price').fill('250');                                // more than the 200 MRP
  await expect(page.getByTestId('price-note-over-mrp')).toBeVisible();
  await page.getByTestId('price-dialog-price').fill('175');                                // what the customer pays: 166.67 before the 5% GST (a cut, so it is not held)
  await expect(page.getByTestId('price-note-over-mrp')).toHaveCount(0);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/products/prices/add')),
    page.getByTestId('price-save').click(),
  ]);
  expect(resp.status()).toBeLessThan(300);
  expect(Number((await resp.json()).saleprice)).toBeCloseTo(166.67, 2);
});

test('PM-7 the group limits are a grid of plain-named groups with product counts; one group opens an editor with a worked example', async ({ app, api }) => {
  const before = (await api.request('GET', '/pricing/policy', undefined, MGR)).body;
  expect(Object.keys(before.counts).length).toBeGreaterThan(0);                           // the server says how many products sit in each group
  const start = before.classes.find((c: any) => c.class_key === 'HIGH_A');
  const { page } = await app.open(MGR, '/secure/products/pricing-rules');
  const adv = page.getByTestId('rules-advanced');                                         // open by itself when the business uses smart groups
  if (!(await adv.evaluate((d: any) => d.open))) await adv.locator('summary').click();
  await expect(page.getByTestId('rules-classes')).toBeVisible();
  await expect(page.getByTestId('rules-classes').getByText('Top earners')).toBeVisible();
  await expect(page.getByTestId('rules-classes').getByText('Wide margin')).toBeVisible();
  await expect(page.getByTestId('group-editor')).toHaveCount(0);
  await page.getByTestId('group-HIGH_A').click();
  await expect(page.getByTestId('group-editor')).toContainText('Top earners, wide margin');
  await page.getByTestId('rules-cap-HIGH_A').first().fill('25');
  await expect(page.getByTestId('group-example')).toContainText('the lowest price you may charge');
  await expect(page.getByTestId('group-HIGH_A')).toContainText(/off MRP|only at the MRP/);
  try {
    await page.getByTestId('rules-save-HIGH_A').click();
    await expect.poll(async () => (await api.request('GET', '/pricing/policy', undefined, MGR)).body.classes.find((c: any) => c.class_key === 'HIGH_A').max_discount_pct).toBe(25);
  } finally {
    await api.request('PUT', '/pricing/policy/HIGH_A', { floor: start.floor_markup_pct, cap: start.max_discount_pct, usual: start.usual_discount_pct }, MGR);
  }
});

test('PM-8 a new product from a purchase gets its first price: at once at the MRP, and from a prefilled box otherwise', async ({ api }) => {
  // at the MRP nobody has to decide: completing the invoice prices the product at the MRP less GST
  expect((await putMode(api, { mode: 'MRP', basis: 'excl' })).status).toBeLessThan(300);
  const a = await boughtProduct(api);
  const priced = await api.request('GET', `/pricing/product/${a}/check`, undefined, MGR);
  expect(priced.body.curprice).toBe(190.47);
  expect((await api.request('GET', `/pricing/invoice/${lastInvoice}/new-prices`, undefined, MGR)).body.products).toHaveLength(0);

  // with a discount the receiver sees the suggested price and may change it before it is set
  expect((await putMode(api, { mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 15, minMarginPct: 0, basis: 'excl' })).status).toBeLessThan(300);
  const b = await boughtProduct(api);
  expect((await api.request('GET', `/pricing/product/${b}/check`, undefined, MGR)).body.curprice).toBeNull();   // nothing was set for it
  const list = (await api.request('GET', `/pricing/invoice/${lastInvoice}/new-prices`, undefined, MGR)).body;
  expect(list.products).toHaveLength(1);
  expect(list.products[0]).toMatchObject({ productid: b, shown: 171.43 });                                        // 10% off 200 less 5% GST
  const set = await api.request('POST', `/pricing/invoice/${lastInvoice}/price-new`, { prices: { [b]: 175 } }, MGR);
  expect(set.body).toMatchObject({ applied: 1, failed: [] });
  expect((await api.request('GET', `/pricing/product/${b}/check`, undefined, MGR)).body.curprice).toBe(175);
  expect((await api.request('GET', `/pricing/invoice/${lastInvoice}/new-prices`, undefined, MGR)).body.products).toHaveLength(0);
});

test('PM-9 the received invoice lists the products that need a price, with the suggested price in a box', async ({ app, api }) => {
  expect((await putMode(api, { mode: 'DISCOUNT', discountPct: 10, maxDiscountPct: 15, minMarginPct: 0, basis: 'incl' })).status).toBeLessThan(300);
  const id = await boughtProduct(api);
  const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${lastInvoice}`);
  await expect(page.getByTestId('new-prices')).toBeVisible();
  await expect(page.getByTestId(`new-price-${id}`)).toHaveValue('180');                                      // 10% off the 200 MRP, GST included
  await page.getByTestId(`new-price-${id}`).fill('185');
  await page.getByTestId('new-prices-set').click();
  await expect(page.getByTestId('new-prices-message')).toContainText('1 product priced');
  await expect(page.getByTestId('new-prices')).toHaveCount(0);
  expect((await api.request('GET', `/pricing/product/${id}/check`, undefined, MGR)).body.curprice).toBe(176.19);   // 185 with GST, before the 5% GST
});

test('PM-10 a business that already has prices can look at them first: bands, what is wrong, and which way of pricing fits; nothing is changed', async ({ app, api }) => {
  const r = (await api.request('GET', '/pricing/check', undefined, MGR)).body;
  expect(r.products).toBeGreaterThan(0);
  expect(r.bands).toHaveLength(6);
  expect(r.bands.reduce((n: number, b: any) => n + b.count, 0) + r.aboveCeiling).toBeLessThanOrEqual(r.products);
  expect(['MRP', 'DISCOUNT', 'SMART']).toContain(r.recommendation.mode);
  expect(r.recommendation.reason.length).toBeGreaterThan(10);
  expect((await api.request('GET', '/pricing/check', undefined, SALES)).status).toBe(403);       // it shows cost: for those who may see cost

  const { page } = await app.open(MGR, '/secure/products/pricing-rules');
  await page.getByTestId('price-check-run').click();
  await expect(page.getByTestId('price-check-summary')).toContainText('priced product');
  await expect(page.getByTestId('price-check-advice')).toContainText('Suggested:');
  await page.getByTestId('price-check-use').click();
  await expect(page.getByTestId('price-check-message')).toContainText('Save how I price');
  expect(await getMode(api)).toMatchObject(original);                                              // choosing is not saving
});
