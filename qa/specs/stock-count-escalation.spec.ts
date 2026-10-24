/**
 * Stock count escalation — COUNTESC-1..3
 * A count that finds a product out by more than the limit (500 rupees at cost, per product) can only be approved by the Business Head.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';

async function ownBatch(api: any, tag: string, qty = 50, mrpcost = 1000) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', {
    vendorid: v, invoiceno: `QA-ADJ-${tag}`, invoicedate: '2026-07-01',
  }, MGR);
  const prod = await api.request('POST', '/products', {
    title: `QA-ADJ-PROD-${tag}`, taxpcnt: 12, category: 'Analgesic', code: `ADJ${tag}`, pack: 1,
  }, MGR);
  const productid = prod.body.id;
  const lineTotal = +(qty * mrpcost).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid, qty, ptrvalue: mrpcost * 0.7, ptrcost: mrpcost * 0.7,
    mrpcost, saleprice: mrpcost, taxpcnt: 12, total: lineTotal, batch: `ADJ-${tag}`, expdate: '2028-06-30',
  }, MGR);
  return { itemid: it.body.id, batch: `ADJ-${tag}` };
}

async function countOne(api: any, tag: string, mrpcost: number, counted: number) {
  const b = await ownBatch(api, tag, 50, mrpcost);
  const started = await api.request('POST', '/stock/counts', { category: null }, MGR);
  const submitted = await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, { items: [{ itemid: b.itemid, bookqty: 50, countedqty: counted }] }, MGR);
  expect(submitted.status).toBeLessThan(300);
  return submitted.body.adjustments[0];
}

test.describe('Stock count escalation @p1', () => {
  test('COUNTESC-1 a large difference is for the Business Head to settle, not the Store Head @happy', async ({ api }) => {
    const adj = await countOne(api, `esc-big-${Date.now()}`, 1000, 47);          // 3 units x 700 = 2,100 at cost
    expect(adj.escalated).toBe(true);
    const row = (await api.request('GET', '/stock/adjust/qty', undefined, MGR)).body.find((a: any) => a.id === adj.id);
    expect(row.escalated).toBe(true);

    const no = await api.request('PUT', `/stock/audit/${adj.id}/approve`, undefined, STORE_HEAD);
    expect(no.status).toBe(403);
    expect((await api.request('PUT', `/stock/audit/${adj.id}/reject`, undefined, STORE_HEAD)).status).toBe(403);
    expect((await api.request('PUT', `/stock/audit/${adj.id}/approve`, undefined, MGR)).status).toBeLessThan(300);
  });

  test('COUNTESC-2 a small difference is settled by the Store Head as before @happy', async ({ api }) => {
    const adj = await countOne(api, `esc-small-${Date.now()}`, 300, 49);         // 1 unit x 210 = 210 at cost
    expect(adj.escalated).toBe(false);
    expect((await api.request('PUT', `/stock/audit/${adj.id}/approve`, undefined, STORE_HEAD)).status).toBeLessThan(300);
  });

  test('COUNTESC-3 the stock audit alerts are available and run @happy', async ({ api }) => {
    const kinds = (await api.request('GET', '/alerts/rules', undefined, MGR)).body.map((r: any) => r.kind);
    for (const k of ['stock_count_overdue', 'negative_stock', 'expired_stock', 'adjustment_other']) expect(kinds).toContain(k);
    expect((await api.request('POST', '/alerts/run', {}, MGR)).status).toBeLessThan(300);
  });
});
