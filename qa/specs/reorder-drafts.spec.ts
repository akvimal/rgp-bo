/**
 * Reorder -> draft orders - RD-1..5
 * An item put on an order shows as such on Reorder (and is not suggested again), a vendor's open draft can take more items instead of
 * a second draft being started, several drafts of one vendor can be merged, and deleting a draft frees what was on it.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const run = Date.now().toString().slice(-7);
let n = 0;

async function vendors(api: any) { return (await api.request('GET', '/vendors', undefined, MGR)).body.map((v: any) => v.id) as number[]; }

/** a product with an open Urgent request for `qty` from `vendor`: it is on Reorder, first in the list */
async function wanted(api: any, vendorid: number, qty = 12) {
  const tag = `${run}${++n}`;
  const prod = await api.request('POST', '/products', { title: `QA RDRAFT ${tag}`, taxpcnt: 12, category: 'Analgesic', code: `RD${tag}`, pack: 1, props: {} }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const req = await api.request('POST', '/purchaserequests', { productid: prod.body.id, qty, vendorid, priority: 'Urgent' }, MGR);
  expect(req.status, JSON.stringify(req.body)).toBeLessThan(300);
  return { productid: prod.body.id as number, requestid: req.body.id as number, vendorid, title: `QA RDRAFT ${tag}`, qty };
}
const suggestion = async (api: any, productid: number) =>
  ((await api.request('GET', '/purchase-suggestions?includezero=true', undefined, MGR)).body as any[]).find((s) => s.product_id === productid);
async function orderIt(api: any, w: { productid: number; vendorid: number; requestid: number; qty: number }, extra: any = {}) {
  const s = await suggestion(api, w.productid);
  expect(s, 'the product is on Reorder').toBeTruthy();
  const r = await api.request('POST', '/purchase-suggestions/create-orders', {
    ...extra,
    items: [{ productid: w.productid, vendorid: w.vendorid, finalqty: s.final_qty, trendqty: s.trend_qty, adhocqty: s.adhoc_qty, requestids: s.request_ids, reasonsummary: s.reason_summary }],
  }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return r.body.orders[0] as { id: number; reused: boolean };
}
const request = async (api: any, id: number) => (await api.request('GET', `/purchaserequests/${id}`, undefined, MGR)).body;

test.describe('Reorder and draft orders @p1', () => {
  test('RD-1 a product put on a draft order says so on Reorder and is not suggested again @happy', async ({ api }) => {
    const [v] = await vendors(api);
    const w = await wanted(api, v);
    const before = await suggestion(api, w.productid);
    expect(before.on_order_qty).toBe(0);
    expect(before.final_qty).toBeGreaterThanOrEqual(w.qty);

    const order = await orderIt(api, w);
    const after = await suggestion(api, w.productid);
    expect(after.on_order_qty).toBe(before.final_qty);
    expect(after.order_ids).toEqual([order.id]);
    expect(after.on_order_draft).toBe(true);
    expect(after.final_qty).toBe(0);                                    // what is on the order is no longer suggested
    expect((await request(api, w.requestid)).status).toBe('Ordered');
  });

  test('RD-2 "add to the vendor\'s open draft" puts the items on it; without it a second draft is started @happy', async ({ api }) => {
    const [v] = await vendors(api);
    const a = await wanted(api, v), b = await wanted(api, v), c = await wanted(api, v);
    const first = await orderIt(api, a);
    const second = await orderIt(api, b, { adddraft: true });
    expect(second.id).toBe(first.id);
    expect(second.reused).toBe(true);
    const lines = (await api.request('GET', `/purchaseorders/${first.id}`, undefined, MGR)).body.requests.map((r: any) => r.productid ?? r.product?.id);
    expect(lines).toEqual(expect.arrayContaining([a.productid, b.productid]));
    const third = await orderIt(api, c);                                // no flag: a draft of its own
    expect(third.id).not.toBe(first.id);
    expect(third.reused).toBe(false);
  });

  test('RD-3 drafts of one vendor merge into one; other vendors and submitted orders are refused @edge', async ({ api }) => {
    const ids = await vendors(api);
    const [v, other] = [ids[0], ids[1]];
    const a = await wanted(api, v), b = await wanted(api, v), x = await wanted(api, other);
    const d1 = await orderIt(api, a), d2 = await orderIt(api, b), dx = await orderIt(api, x);
    expect(new Set([d1.id, d2.id]).size).toBe(2);

    const wrong = await api.request('POST', '/purchaseorders/merge', { targetid: d1.id, sourceids: [dx.id] }, MGR);
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toContain('another vendor');

    const ok = await api.request('POST', '/purchaseorders/merge', { targetid: d1.id, sourceids: [d2.id] }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body.moved).toBeGreaterThanOrEqual(1);
    const merged = (await api.request('GET', `/purchaseorders/${d1.id}`, undefined, MGR)).body;
    expect(merged.requests.map((r: any) => r.productid ?? r.product?.id)).toEqual(expect.arrayContaining([a.productid, b.productid]));
    expect((await request(api, b.requestid)).orderid).toBe(d1.id);       // the item follows the order
    const list = (await api.request('GET', '/purchaseorders', undefined, MGR)).body as any[];
    expect(list.some((o) => o.id === d2.id)).toBe(false);                // the folded draft is gone from the list

    const sent = await orderIt(api, await wanted(api, v));
    await api.request('PUT', `/purchaseorders/${sent.id}`, { status: 'SUBMITTED' }, MGR);
    const refused = await api.request('POST', '/purchaseorders/merge', { targetid: d1.id, sourceids: [sent.id] }, MGR);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toContain('not a draft');
  });

  test('RD-4 deleting a draft frees its items: the request is Open again and the product is back on Reorder @edge', async ({ api }) => {
    const [v] = await vendors(api);
    const w = await wanted(api, v);
    const order = await orderIt(api, w);
    expect((await suggestion(api, w.productid)).on_order_qty).toBeGreaterThan(0);
    expect((await api.request('DELETE', `/purchaseorders/${order.id}`, undefined, MGR)).status).toBeLessThan(300);
    const r = await request(api, w.requestid);
    expect(r.status).toBe('Open');
    expect(r.orderid ?? null).toBeNull();
    const back = await suggestion(api, w.productid);
    expect(back.on_order_qty).toBe(0);
    expect(back.final_qty).toBeGreaterThanOrEqual(w.qty);
  });

  test('RD-5 on screen: Create Orders links to the new draft and the Orders tab shows it without a reload; the request says "on draft" @happy', async ({ app, api }) => {
    const [v] = await vendors(api);
    const w = await wanted(api, v);
    const { page } = await app.open(MGR, '/secure/purchases/suggestions');
    const row = page.getByRole('row').filter({ hasText: w.title });
    await expect(row).toBeVisible();
    const create = page.getByRole('button', { name: /Create Orders From Selected/ });
    // the list is still loading when the page opens and can be rebuilt under the click: tick again until it holds
    await expect(async () => {
      await row.locator('input[type=checkbox]').check();
      await expect(create).toContainText('(1)', { timeout: 1500 });
    }).toPass({ timeout: 15000 });
    const made = page.waitForResponse((r) => /create-orders/.test(r.url()));
    await create.click();
    const res = await made;
    expect(res.status(), await res.text()).toBeLessThan(300);
    const link = page.getByTestId('reo-created-link').first();
    await expect(link).toBeVisible();
    await expect(page.getByTestId('reo-created')).toContainText('draft');
    // an ordered item is no longer urgent or short, so it sinks down the list: page on until it is found
    const ordered = page.getByRole('row').filter({ hasText: w.title }).getByTestId('reo-on-order');
    for (let i = 0; i < 90 && !(await ordered.count()); i++) {
      const next = page.getByRole('tabpanel', { name: 'Reorder' }).locator('.p-paginator-next').first();
      if (await next.isDisabled()) break;
      await next.click();
    }
    await expect(ordered).toContainText('On draft');

    const id = Number((await link.innerText()).match(/#(\d+)/)![1]);
    await page.getByRole('tab', { name: 'Orders' }).click();
    await expect(page.locator(`[data-testid=po-row][data-po-id="${id}"]`)).toBeVisible();   // no reload

    await page.getByRole('tab', { name: 'Requests' }).click();
    await expect(page.getByTestId('req-on-draft').filter({ hasText: `#${id}` }).first()).toBeVisible();
  });
  test('RD-6 the Reorder list can be searched, narrowed by what needs doing, and sorted by a column @happy', async ({ app, api }) => {
    const [v] = await vendors(api);
    const a = await wanted(api, v, 5), b = await wanted(api, v, 9);
    await orderIt(api, b);                                             // b is on a draft, a still needs ordering
    const { page } = await app.open(MGR, '/secure/purchases/suggestions');
    const panel = page.getByRole('tabpanel', { name: 'Reorder' });
    const rows = panel.locator('tbody tr');

    await panel.getByTestId('reo-search').fill(`QA RDRAFT ${a.title.split(' ').pop()}`);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(a.title);
    await expect(panel.getByTestId('reo-count')).toContainText('1 of');

    // both products, narrowed by what needs doing (the search keeps each on the first page)
    await panel.getByTestId('reo-search').fill(b.title);
    await panel.getByTestId('reo-show').selectOption('onorder');
    await expect(rows.filter({ hasText: b.title })).toHaveCount(1);
    await panel.getByTestId('reo-show').selectOption('toorder');
    await expect(rows.filter({ hasText: b.title })).toHaveCount(0);       // b is already on a draft
    await panel.getByTestId('reo-search').fill(a.title);
    await expect(rows.filter({ hasText: a.title })).toHaveCount(1);       // a still needs ordering
    await panel.getByTestId('reo-show').selectOption('onorder');
    await expect(rows.filter({ hasText: a.title })).toHaveCount(0);

    await panel.getByTestId('reo-show').selectOption('all');
    await panel.getByRole('columnheader', { name: /^Product/ }).click();
    const firstLine = (xs: string[]) => xs.map((x) => x.trim().split(String.fromCharCode(10))[0].trim());
    const asc = firstLine(await rows.locator('td:nth-child(2)').allInnerTexts());
    expect(asc).toEqual([...asc].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' })));
    await panel.getByRole('columnheader', { name: /^Product/ }).click();
    const desc = firstLine(await rows.locator('td:nth-child(2)').allInnerTexts());
    expect(desc).toEqual([...desc].sort((x, y) => y.localeCompare(x, undefined, { sensitivity: 'base' })));
  });
});
