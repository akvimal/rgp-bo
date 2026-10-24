/**
 * What may be returned and how a return is settled - RR-1..5
 * A refrigerated (or any barred) product is not taken back; some products are inspected first; a store caps cash refunds and
 * sends the rest to store credit; stock moves with the refund and what is discarded is flagged.
 */
import { test, expect } from '../fixtures/index.js';

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
    itemid: x.item_id, productid: x.id, batch: x.batch, category: x.category,
    mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

const mobile = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

function bill(s: any, over: Record<string, any> = {}, qty = 2) {
  const now = new Date().toISOString();
  return {
    billdate: now, orderdate: now, cashamt: 100 * qty, digiamt: 0, total: 100 * qty, discamount: 0, expreturndays: 7,
    status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'QA Return Rules', mobile: mobile() },
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: 100, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty, total: 100 * qty }],
    ...over,
  };
}

/** sells `qty` of a pool product and returns the sale line */
async function sell(api: any, s: any, qty = 2) {
  const sale = await api.request('POST', '/sales', bill(s, {}, qty), COUNTER);
  expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);
  return { sale: sale.body, line: sale.body.items[0] };
}
const setRule = (api: any, id: number, returnrule: string | null) => api.request('PUT', `/products/${id}`, { returnrule }, MGR);
const raise = (api: any, line: any, qty = 1, extra: any = {}) => api.request('POST', '/sales/returns', [{ saleitemid: line.id, qty, status: 'NEW', reason: 'Defective', ...extra }], COUNTER);
const settle = (api: any, id: number, b: any) => api.request('PUT', '/sales/returns', { id, status: 'ADJUSTED', ...b }, COUNTER);
const storeOf = async (api: any, sale: any) => (await api.request('GET', `/sales/${sale.id}`, undefined, MGR)).body.storeid;

test.describe('Return rules @p1', () => {
  test('RR-1 a product that is not taken back cannot be returned, and the list says so @happy', async ({ api }) => {
    test.skip(POOL.length < 3, 'no stock to sell');
    const s = POOL[0];
    const { sale, line } = await sell(api, s);
    try {
      expect((await setRule(api, s.productid, 'NONE')).status).toBeLessThan(300);
      const el = (await api.request('GET', `/sales/returns/${sale.id}/eligible`, undefined, COUNTER)).body.items.find((i: any) => i.id === line.id);
      expect(el.return_rule).toBe('NONE');
      const r = await raise(api, line);
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toContain('cannot be returned');
      expect((await setRule(api, s.productid, 'WHATEVER')).status).toBeGreaterThanOrEqual(400);   // only the three rules
      expect((await setRule(api, s.productid, null)).status).toBeLessThan(300);                   // back to following the category
      expect((await raise(api, line)).status).toBeLessThan(300);
    } finally { await setRule(api, s.productid, null); }
  });

  test('RR-2 a category can be set to inspect first, and only the owner sets it; a product can override it @happy', async ({ api }) => {
    test.skip(POOL.length < 3, 'no stock to sell');
    const s = POOL[1];
    s.category = ((await api.request('GET', '/products', undefined, MGR)).body as any[]).find((p) => p.id === s.productid)?.category;
    test.skip(!s.category, 'product has no category');
    const { sale, line } = await sell(api, s);
    try {
      expect((await api.request('PUT', '/sales/return-rules', { category: s.category, rule: 'INSPECT' }, COUNTER)).status).toBe(403);
      expect((await api.request('PUT', '/sales/return-rules', { category: s.category, rule: 'MAYBE' }, MGR)).status).toBe(400);
      expect((await api.request('PUT', '/sales/return-rules', { category: s.category, rule: 'INSPECT' }, MGR)).status).toBeLessThan(300);
      const list = (await api.request('GET', '/sales/return-rules', undefined, MGR)).body;
      expect(list.find((r: any) => r.category === s.category)).toMatchObject({ rule: 'INSPECT' });

      const r = await raise(api, line);
      expect(r.status).toBeLessThan(300);
      const row = r.body[0];
      expect(row.needsinspection).toBe(true);
      // not settled without saying what was found; then once it is
      const no = await settle(api, row.id, { refundmode: 'CASH', acceptedqty: 1 });
      expect(no.status).toBe(400);
      expect(JSON.stringify(no.body)).toContain('inspected');
      const ok = await settle(api, row.id, { refundmode: 'CASH', acceptedqty: 1, inspectionnote: 'Seal intact, 14 months to expiry' });
      expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
      const listed = (await api.request('GET', '/sales/returns', undefined, MGR)).body.find((x: any) => x.id === row.id);
      expect(listed).toMatchObject({ needs_inspection: true, accepted_qty: 1, discarded_qty: 0, inspection_note: 'Seal intact, 14 months to expiry' });
      expect(listed.settled_by_name).toBeTruthy();

      // a product's own rule wins over the category's
      expect((await setRule(api, s.productid, 'FREE')).status).toBeLessThan(300);
      const second = await raise(api, line);
      expect(second.body[0].needsinspection).toBe(false);
    } finally {
      await setRule(api, s.productid, null);
      await api.request('PUT', '/sales/return-rules', { category: s.category, rule: null }, MGR);
    }
  });

  test('RR-3 the store caps a cash refund; over the cap, or with no cash allowed, the refund goes to store credit @edge', async ({ api }) => {
    test.skip(POOL.length < 3, 'no stock to sell');
    const s = POOL[2];
    const { sale, line } = await sell(api, s, 3);
    const storeid = await storeOf(api, sale);
    const limit = (v: number | null) => api.request('PUT', `/stores/${storeid}/profile`, { cashrefundlimit: v }, MGR);
    try {
      expect((await limit(150)).status).toBeLessThan(300);
      expect((await api.request('GET', `/store-cash/profile?storeid=${storeid}`, undefined, MGR)).body.cashrefundlimit).toBe(150);
      expect((await limit(-5)).status).toBe(400);

      const big = (await raise(api, line, 2)).body[0];                                          // 200 of refund
      const over = await settle(api, big.id, { refundmode: 'CASH', acceptedqty: 2 });
      expect(over.status).toBe(400);
      expect(JSON.stringify(over.body)).toContain('store credit');
      const small = (await raise(api, line, 1)).body[0];                                        // 100 of refund
      expect((await settle(api, small.id, { refundmode: 'CASH', acceptedqty: 1 })).status).toBeLessThan(300);

      // no cash at all: credit works, cash does not
      expect((await limit(0)).status).toBeLessThan(300);
      const none = await settle(api, big.id, { refundmode: 'CASH', acceptedqty: 2 });
      expect(none.status).toBe(400);
      expect(JSON.stringify(none.body)).toContain('does not refund in cash');
      expect((await settle(api, big.id, { refundmode: 'CREDIT', acceptedqty: 2 })).status).toBeLessThan(300);
    } finally { await limit(null); }
  });

  test('RR-4 settling puts the accepted quantity back in stock and flags what is discarded @happy', async ({ api }) => {
    test.skip(POOL.length < 4, 'no stock to sell');
    const s = POOL[3];
    const { line } = await sell(api, s, 3);
    const movements = async () => (await api.request('GET', '/stock/adjust/qty', undefined, MGR)).body
      .filter((m: any) => m.itemid === s.itemid && ['RETURNED', 'RETURN_DISCARD'].includes(m.reasoncode));
    const before = (await movements()).length;
    const r = (await raise(api, line, 2)).body[0];
    expect((await movements()).length).toBe(before);                                            // nothing moves until it is settled
    const ok = await settle(api, r.id, { refundmode: 'TRANSFER', acceptedqty: 1, inspectionnote: 'One strip torn' });
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const now = await movements();
    expect(now.length).toBe(before + 2);
    const back = now.find((m: any) => m.reasoncode === 'RETURNED' && m.qty === 2);
    const gone = now.find((m: any) => m.reasoncode === 'RETURN_DISCARD' && m.qty === -1);
    expect(back, JSON.stringify(now)).toBeTruthy();
    expect(gone).toMatchObject({ discarded: true, comments: 'One strip torn' });
    expect(back.discarded).toBe(false);
    expect((await settle(api, r.id, { refundmode: 'TRANSFER', acceptedqty: 1 })).status).toBe(400);   // once only: no second posting
    expect((await movements()).length).toBe(before + 2);

    // an expired or damaged write-off is flagged too
    const exp = await api.request('POST', '/stock/adjust/qty', { itemid: s.itemid, qty: -1, price: 1, reasoncode: 'EXPIRED', comments: 'RR-4 expiry' }, MGR);
    expect(exp.status, JSON.stringify(exp.body)).toBeLessThan(300);
    const flagged = (await api.request('GET', '/stock/adjust/qty', undefined, MGR)).body.find((m: any) => m.comments === 'RR-4 expiry');
    expect(flagged.discarded).toBe(true);
  });

  test('RR-5 the returns list shows status, what was discarded, and a labelled Settle action; the dialog keeps accepted and discarded adding up @happy', async ({ api, app }) => {
    test.skip(POOL.length < 5, 'no stock to sell');
    const s = POOL[4];
    const { sale, line } = await sell(api, s, 2);
    try {
      const open = (await raise(api, line, 1)).body[0];
      const done = (await raise(api, line, 1)).body[0];
      expect((await settle(api, done.id, { refundmode: 'TRANSFER', acceptedqty: 0, inspectionnote: 'Melted' })).status).toBeLessThan(300);
      const { page } = await app.open(MGR, '/secure/sales/returns');
      const rows = page.locator('tbody tr', { hasText: 'QA Return Rules' });
      await expect(rows.first()).toBeVisible();
      await expect(page.getByTestId('ret-status').first()).toBeVisible();
      await expect(page.getByTestId('ret-discarded').first()).toContainText('1 discarded');
      await expect(page.getByTestId('ret-settle').first()).toBeVisible();                         // the open one has a labelled action
      await page.locator('[data-testid=ret-status-badge]', { hasText: 'To settle' }).first().click();   // the status label opens the dialog too
      await expect(page.getByTestId('adj-amount')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.getByTestId('ret-settle').first().click();
      await expect(page.getByTestId('adj-amount')).toBeVisible();
      await page.getByTestId('adj-discard').fill('1');
      await expect(page.getByTestId('adj-accept')).toHaveValue('0');                              // the two always add up to what came back
      await expect(page.getByTestId('adj-amount')).toContainText('0.00');
      expect(open.id).toBeTruthy();

    } finally { await setRule(api, s.productid, null); }
  });

  test('RR-6 Settings > Store has a Returns tab for the categories and a cash refund limit; the product form has its own Returns choice @happy', async ({ api, app }) => {
    const stores = (await api.request('GET', '/stores', undefined, MGR)).body as any[];
    const mine = stores.find((x) => x.isActive !== false) || stores[0];
    const { page } = await app.open(MGR, '/secure/settings/store');
    await page.getByTestId('store-s-select').selectOption({ label: `${mine.business?.name} - ${mine.location}` });
    try {
      await page.getByTestId('store-s-tab-returns').click();
      await expect(page.getByTestId('store-rr-panel')).toBeVisible();
      await expect(page.getByTestId('store-rr-row-0')).toBeVisible();
      const cat = (await page.getByTestId('store-rr-row-0').locator('td').first().innerText()).trim();
      await page.getByTestId('store-rr-rule-0').selectOption('INSPECT');
      await expect.poll(async () => ((await api.request('GET', '/sales/return-rules', undefined, MGR)).body as any[]).find((r) => r.category === cat)?.rule).toBe('INSPECT');
      await page.getByTestId('store-rr-rule-0').selectOption({ label: 'Taken back' });
      await expect.poll(async () => ((await api.request('GET', '/sales/return-rules', undefined, MGR)).body as any[]).find((r) => r.category === cat)?.rule).toBeNull();

      await page.getByTestId('store-s-tab-cash').click();
      await page.getByTestId('store-profile-cashrefund').fill('250');
      await page.getByTestId('store-profile-save').click();
      await expect(page.getByTestId('store-profile-message')).toHaveText('Saved.');
      expect((await api.request('GET', `/store-cash/profile?storeid=${mine.id}`, undefined, MGR)).body.cashrefundlimit).toBe(250);
    } finally { await api.request('PUT', `/stores/${mine.id}/profile`, { cashrefundlimit: null }, MGR); }

    await page.goto(page.url().replace(/\/settings\/store.*/, '/products/master/new'));
    await expect(page.getByTestId('prod-returnrule')).toBeVisible();
  });

  test('RR-7 the Returns page explains where a return starts and how it is settled @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/sales/returns');
    const help = page.getByTestId('ret-help');
    await expect(help).toBeVisible();
    await help.locator('summary').click();
    await expect(page.getByTestId('ret-flow')).toContainText('click');
    await expect(page.getByTestId('ret-flow')).toContainText('Settle');
    await page.getByTestId('ret-flow').getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/\/secure\/sales\/list/);
  });
});
