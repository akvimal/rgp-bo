/**
 * The GST on a sale line is the rate in force today for the product, not the rate of the batch it came from — GSTS-1..4
 * (the dev database carries the GST 2.0 change: every product capped at 5% from 22 Sep 2025, so a batch bought at 12% bills at 5%).
 * The server refuses a completed bill whose lines carry another rate and sends back the right one; a held bill reopened is billed at today's
 * rate; the till says when the batches of a product still bill at different rates.
 * The suite normally runs with pricing/sale_gst_guard off (like sale_mrp_guard): these cases switch it on for themselves and put it back.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const OPERATOR = { operatorId: 3, operatorName: 'Sale Staff One' };
const run = Date.now().toString().slice(-7);

/** a product with one received, priced batch per GST rate given (the first expires soonest, so it is the one the till offers first) */
async function product(api: any, tag: string, taxes: number[]) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-GST-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA GSTRATE ${tag}`, taxpcnt: taxes[0], category: 'Analgesic', code: `GR${tag}`, pack: 1, props: {} }, MGR);
  const ids: number[] = [];
  let total = 0;
  for (let n = 0; n < taxes.length; n++) {
    const t = 50 * 70;
    total += t;
    const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: 70, ptrcost: 70, mrpcost: 150, saleprice: 100, taxpcnt: taxes[n], total: t, batch: `GR-${tag}-${n}`, expdate: `${2027 + n}-06-30` }, MGR);
    expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
    ids.push(it.body.id);
  }
  await api.request('PUT', '/purchaseitems', { ids, values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  expect((await api.request('POST', '/products/prices/add', { productid: prod.body.id, saleprice: 100, reason: 'Market' }, MGR)).status).toBeLessThan(300);
  return { productid: prod.body.id as number, itemids: ids, title: `QA GSTRATE ${tag}` };
}

function bill(p: { productid: number; itemids: number[] }, taxpcnt: number, extra: any = {}) {
  const now = new Date().toISOString();
  const total = +(80 * (1 + taxpcnt / 100)).toFixed(2);
  return {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: p.itemids[0], productid: p.productid, batch: 'x', price: 80, mrpcost: 150, taxpcnt, qty: 1, total, status: 'Complete' }],
    ...extra,
  };
}

async function setting(api: any, key: string, value: string) {
  const s = (await api.request('GET', `/settings?key=${key}`, undefined, MGR)).body[0];
  expect(s, `the setting ${key} exists`).toBeTruthy();
  expect((await api.request('PUT', `/settings/${s.id}`, { value }, MGR)).status).toBeLessThan(300);
  return String(s.value ?? s.setting_value ?? '');
}

async function guardValue(api: any) {
  const s = (await api.request('GET', '/settings?key=sale_gst_guard', undefined, MGR)).body[0];
  return String(s?.value ?? s?.setting_value ?? 'on');
}

test.describe('GST on a sale line @p1', () => {
  let before = 'off';
  test.beforeEach(async ({ api }) => { before = await guardValue(api); await setting(api, 'sale_gst_guard', 'on'); });
  test.afterEach(async ({ api }) => { await setting(api, 'sale_gst_guard', before); });

  test('GSTS-1 a completed bill at the old batch rate is sent back with today\'s rate; the right rate is accepted and saved @happy', async ({ api }) => {
    const p = await product(api, `a-${run}`, [12]);
    const stale = await api.request('POST', '/sales', bill(p, 12), COUNTER);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('GST_RATE_CHANGED');
    expect(stale.body.lines).toEqual([{ itemid: p.itemids[0], title: p.title, sent: 12, current: 5 }]);
    expect(stale.body.message).toContain('12% on the bill, 5% today');

    const ok = await api.request('POST', '/sales', bill(p, 5), COUNTER);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const saved = (await api.request('GET', `/sales/${ok.body.id}`, undefined, MGR)).body;
    expect(Number(saved.items[0].taxpcnt)).toBe(5);

    // a held bill is not checked: it is only a bill being built
    expect((await api.request('POST', '/sales', bill(p, 12, { status: 'PENDING', cashamt: 0, items: [{ ...bill(p, 12).items[0], status: 'Pending' }] }), COUNTER)).status).toBeLessThan(300);

    // the kill switch lets a bill through as it was sent
    await setting(api, 'sale_gst_guard', 'off');
    expect((await api.request('POST', '/sales', bill(p, 12), COUNTER)).status).toBeLessThan(300);
  });

  test('GSTS-2 a held bill reopened is billed at today\'s rate, and completes @happy', async ({ app, api }) => {
    const p = await product(api, `b-${run}`, [12]);
    const held = await api.request('POST', '/sales', bill(p, 12, { status: 'PENDING', cashamt: 0, items: [{ ...bill(p, 12).items[0], status: 'Pending' }] }), COUNTER);
    expect(held.status, JSON.stringify(held.body)).toBeLessThan(300);
    const lines = (await api.request('GET', `/sales/${held.body.id}/availableitems`, undefined, COUNTER)).body as any[];
    expect(Number(lines[0].tax_pcnt)).toBe(12);                 // what the line was saved at
    expect(Number(lines[0].product_taxpcnt)).toBe(12);          // the batch's own
    expect(Number(lines[0].sale_tax)).toBe(5);                  // what is billed today

    const { page } = await app.open(COUNTER, `/secure/sales/pos/edit/${held.body.id}`, OPERATOR);
    const line = page.getByTestId('sale-line').first();
    await expect(line).toContainText('5%');
    await expect(line).not.toContainText('12%');
    await expect(page.getByTestId('sale-total')).toContainText('84');          // 80 + 5%, not 80 + 12% = 90

    const posted = page.waitForResponse((r) => /\/sales$/.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()));
    await page.getByTestId('pos-pay-cash').click();                            // no way of paying is chosen until one is pressed
    await page.getByTestId('sale-complete').click();
    const res = await posted;
    expect(res.status(), await res.text()).toBeLessThan(300);
    const saved = (await api.request('GET', `/sales/${held.body.id}`, undefined, MGR)).body;
    expect(Number(saved.items[0].taxpcnt)).toBe(5);
  });

  test('GSTS-3 a bill the server sends back is corrected on the screen: the rate and the total change, and it completes on the second try @edge', async ({ app, api }) => {
    const p = await product(api, `c-${run}`, [12]);
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.locator('[data-testid=sale-add-item] input').first().fill(p.title);
    await page.locator('.p-autocomplete-panel li').filter({ hasText: p.title }).first().click();
    const units = page.getByTestId('sale-line').first().locator('input[aria-label="Units"]');
    await units.fill('1');
    await units.press('Tab');
    await expect(page.getByTestId('sale-line').first()).toContainText('5%');

    // the first request goes out with the old batch rate on its line, as a stale screen or an old client would send it
    let tampered = false;
    await page.route('**/sales', async (route) => {
      const req = route.request();
      if (req.method() === 'POST' && !tampered) {
        tampered = true;
        const body = JSON.parse(req.postData() || '{}');
        body.items = (body.items || []).map((i: any) => ({ ...i, taxpcnt: 12 }));
        return route.continue({ postData: JSON.stringify(body) });
      }
      return route.continue();
    });
    await page.getByTestId('pos-pay-cash').click();
    await page.getByTestId('sale-complete').click();
    await expect(page.getByTestId('sale-chronic-mobile')).toContainText('GST rate has changed');
    await expect(page.getByTestId('sale-line').first()).toContainText('5%');

    const posted = page.waitForResponse((r) => /\/sales$/.test(r.url()) && r.request().method() === 'POST');
    await page.getByTestId('pos-pay-cash').click();
    await page.getByTestId('sale-complete').click();
    const res = await posted;
    expect(res.status(), await res.text()).toBeLessThan(300);
  });

  test('GSTS-4 the till says when the batches of a product still bill at different rates, and not when the rate brings them together @edge', async ({ app, api }) => {
    const mixed = await product(api, `d-${run}`, [0, 12]);       // 0% stays 0%, 12% is capped to 5%: different rates today
    const together = await product(api, `e-${run}`, [12, 18]);   // both are capped to 5%
    const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400, id: mixed.productid }, COUNTER)).body as any[];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((r) => r.gst_mixed === true)).toBe(true);
    const rows2 = (await api.request('POST', '/stock/filter', { available: true, limit: 400, id: together.productid }, COUNTER)).body as any[];
    expect(rows2.length).toBeGreaterThan(1);
    expect(rows2.every((r) => r.gst_mixed === false)).toBe(true);

    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.locator('[data-testid=sale-add-item] input').first().fill(together.title);
    await page.locator('.p-autocomplete-panel li').filter({ hasText: together.title }).first().click();
    await expect(page.getByTestId('sale-line')).toHaveCount(1);
    await expect(page.getByTestId('sale-gst-mixed')).toHaveCount(0);

    await page.keyboard.press('Tab');                                                            // from the units back to the product search
    const search = page.locator('[data-testid=sale-add-item] input').first();
    await search.click();
    await search.pressSequentially(mixed.title, { delay: 15 });
    await page.locator('.p-autocomplete-panel li').filter({ hasText: mixed.title }).first().click();
    await expect(page.getByTestId('sale-gst-mixed')).toContainText(mixed.title);
    await expect(page.getByTestId('sale-gst-mixed')).toContainText('Rate changes');
  });
});
