/**
 * Weekly review — REVIEW-1..4
 * Discounts, items billed below the list price, held bills discarded, bills edited after billing and returns for one week, beside the week before, and the sign-off that the
 * people who run the store looked at them. Open to the Business Head, Owner-operator and Store Head.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';
const COUNTER = 'sales1@local.test';

const ist = () => new Date(Date.now() + 5.5 * 3600000);
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const mondayOf = (d: string) => addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7));
const thisMonday = () => mondayOf(ist().toISOString().slice(0, 10));

async function stockLine(api: any) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
  expect(rows.length).toBeGreaterThan(0);
  return rows[Math.floor(Math.random() * Math.min(rows.length, 20))];
}

async function bill(api: any, over: Record<string, any> = {}, price = 100, qty = 2) {
  const l = await stockLine(api);
  const now = new Date().toISOString();
  const m = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  const total = Math.round(price * qty * 100) / 100;
  const sale = await api.request('POST', '/sales', {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE',
    ordertype: 'Walk-in', deliverytype: 'Counter', customer: { name: 'QA Review', mobile: m },
    items: [{ itemid: l.item_id, productid: l.id, batch: l.batch, price, mrpcost: l.mrp_cost, taxpcnt: Number(l.tax_pcnt) || 12, qty, total, status: 'Complete' }],
    ...over,
  }, COUNTER);
  expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);
  return sale.body;
}

const week = async (api: any, who = MGR, start = thisMonday(), store?: number) =>
  api.request('GET', `/review/week?weekstart=${start}${store ? `&storeid=${store}` : ''}`, undefined, who);

test.describe('Weekly review @p1', () => {
  test('REVIEW-1 discounts, items below list, discarded held bills, edited bills and returns each show up in the week @happy', async ({ api }) => {
    const before = (await week(api)).body;
    expect(before.week.start).toBe(thisMonday());

    const disc = await bill(api, { discamount: 20, total: 180, cashamt: 180 });
    const below = await bill(api, {}, 0.01, 1);
    const gone = await bill(api, { status: 'PENDING', cashamt: 0, total: 0 }, 100, 1);
    expect((await api.request('DELETE', `/sales/${gone.id}`, undefined, COUNTER)).status).toBeLessThan(300);
    const kept = await bill(api, {}, 100, 2);
    const full = (await api.request('GET', `/sales/${kept.id}`, undefined, MGR)).body;
    const edit = await api.request('PUT', '/sales', { ...full, total: 150, cashamt: 150, items: full.items.map((i: any) => ({ ...i, price: 75, total: 150 })) }, COUNTER);
    expect(edit.status, JSON.stringify(edit.body)).toBeLessThan(300);
    const ret = await api.request('POST', '/sales/returns', [{ saleitemid: kept.items[0].id, qty: 1, status: 'NEW', reason: 'Defective' }], COUNTER);
    expect(ret.status, JSON.stringify(ret.body)).toBeLessThan(300);

    const after = (await week(api)).body;
    expect(after.summary.discountBills).toBe(before.summary.discountBills + 1);
    expect(after.summary.belowList).toBeGreaterThanOrEqual(before.summary.belowList + 1);
    expect(after.summary.voids).toBe(before.summary.voids + 1);
    expect(after.summary.edits).toBe(before.summary.edits + 1);
    expect(after.summary.returns).toBe(before.summary.returns + 1);
    expect(after.summary.bills).toBeGreaterThanOrEqual(before.summary.bills + 3);

    const d = after.discounts.find((r: any) => r.id === disc.id);
    expect(d.disc).toBe(20);
    expect(d.pct).toBeCloseTo(10, 1);                                    // 20 of 200 before the discount: marked for a closer look
    expect(after.marked.bigDiscounts).toBeGreaterThanOrEqual(1);
    expect(after.below.find((r: any) => r.sale_id === below.id).pct).toBeGreaterThan(90);
    const v = after.voids.find((r: any) => r.id === gone.id);
    expect(v.voided_name).toBeTruthy();
    const e = after.edits.find((r: any) => r.sale_id === kept.id);
    expect(e.flagged).toBe(true);                                         // the total was lowered
    expect(e.reduced).toBe(50);
    expect(after.marked.flaggedEdits).toBeGreaterThanOrEqual(1);
    expect(after.returns.find((r: any) => r.reason === 'Defective')).toBeTruthy();
    expect(after.returnsByReason.find((g: any) => g.name === 'Defective').count).toBeGreaterThanOrEqual(1);
  });

  test('REVIEW-2 a finished week is signed once, with a note, and the sign-off is recorded @happy', async ({ api }) => {
    const wk = addDays(thisMonday(), -7 * (30 + Math.floor(Math.random() * 400)));
    const open = (await week(api, STORE_HEAD, wk)).body;
    expect(open.over).toBe(true);
    const store = open.stores[0].id;
    const alone = (await week(api, STORE_HEAD, wk, store)).body;
    expect(alone.canSign).toBe(true);

    const signed = await api.request('POST', '/review/signoff', { storeid: store, weekstart: wk, note: 'nothing to report' }, STORE_HEAD);
    expect(signed.status, JSON.stringify(signed.body)).toBeLessThan(300);
    const after = (await week(api, STORE_HEAD, wk, store)).body;
    expect(after.canSign).toBe(false);
    expect(after.signoffs[0].by).toBeTruthy();
    expect(after.signoffs[0].note).toBe('nothing to report');
    expect((await api.request('POST', '/review/signoff', { storeid: store, weekstart: wk }, STORE_HEAD)).status).toBe(400);   // once
  });

  test('REVIEW-3 a week that is not over, not a Monday, or another store cannot be signed @edge', async ({ api }) => {
    const store = (await week(api, STORE_HEAD)).body.stores[0].id;
    expect((await api.request('POST', '/review/signoff', { storeid: store, weekstart: thisMonday() }, STORE_HEAD)).status).toBe(400);
    expect((await api.request('POST', '/review/signoff', { storeid: store, weekstart: addDays(thisMonday(), -6 - 7 * 500) }, STORE_HEAD)).status).toBe(400);
    expect((await api.request('POST', '/review/signoff', { weekstart: addDays(thisMonday(), -7 * 600) }, STORE_HEAD)).status).toBe(400);
    expect((await week(api, MGR, addDays(thisMonday(), 1))).status).toBe(400);
    const other = (await api.request('POST', '/stores', { location: `QA-REV-${Date.now()}` }, MGR)).body.id;
    expect((await api.request('POST', '/review/signoff', { storeid: other, weekstart: addDays(thisMonday(), -7 * 601) }, STORE_HEAD)).status).toBe(400);
    expect((await week(api, STORE_HEAD, thisMonday(), other)).status).toBe(400);
  });

  test('REVIEW-4 the review is for the people who run the shop, and the alert is available @negative', async ({ api }) => {
    expect((await week(api, COUNTER)).status).toBe(403);
    expect((await api.request('POST', '/review/signoff', { storeid: 1, weekstart: addDays(thisMonday(), -7 * 602) }, COUNTER)).status).toBe(403);
    const kinds = (await api.request('GET', '/alerts/rules', undefined, MGR)).body.map((r: any) => r.kind);
    expect(kinds).toContain('weekly_review');
  });
});
