/**
 * An expiry date is the whole month - EXPM-1..2
 * Batches carry it as the 1st of the month (11/2026 is stored 2026-11-01) and are good until its last day, so the POS list
 * hides a batch only when fewer than 30 days remain to the LAST day of the month (it used to count from the 1st).
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const run = Date.now().toString().slice(-7);
let n = 0;

const day = (d: Date) => d.toISOString().slice(0, 10);
const firstOfMonth = (offset: number) => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth() + offset, 1)); };
const lastOfMonth = (offset: number) => new Date(Date.UTC(firstOfMonth(offset).getUTCFullYear(), firstOfMonth(offset).getUTCMonth() + 1, 0));
/** what the till should say about a batch stored as the 1st of the month `offset` from now */
const sellable = (offset: number) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 30));
  return lastOfMonth(offset).getTime() >= limit.getTime();
};

async function batches(api: any, offsets: number[]) {
  const tag = `${run}${++n}`;
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-EXPM-${tag}`, invoicedate: day(new Date()) }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA EXPMONTH ${tag}`, taxpcnt: 12, category: 'Analgesic', code: `EM${tag}`, pack: 1, props: {} }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const ids: number[] = [];
  for (const o of offsets) {
    const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 20, ptrvalue: 70, ptrcost: 70, mrpcost: 150, saleprice: 100, taxpcnt: 12, total: 1400, batch: `EM-${tag}-${o}`, expdate: day(firstOfMonth(o)) }, MGR);
    expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
    ids.push(it.body.id);
  }
  await api.request('PUT', '/purchaseitems', { ids, values: { status: 'VERIFIED' } }, MGR);
  expect((await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: 1400 * offsets.length } }, MGR)).status).toBeLessThan(300);
  await api.request('POST', '/products/prices/add', { productid: prod.body.id, saleprice: 100, reason: 'Market' }, MGR);
  return { productid: prod.body.id as number, offsets, tag };
}

test.describe('Expiry is the whole month @p1', () => {
  test('EXPM-1 the POS list counts the 30 days from the last day of the expiry month, not the 1st @happy', async ({ api }) => {
    const p = await batches(api, [0, 1, 2, 3]);
    const listed = ((await api.request('POST', '/stock/filter', { available: true, expired: false, limit: 400, id: p.productid }, COUNTER)).body as any[]).map((r) => r.batch);
    for (const o of p.offsets) {
      expect(listed.includes(`EM-${p.tag}-${o}`), `batch expiring in month +${o}: ${sellable(o) ? 'listed' : 'hidden'}`).toBe(sellable(o));
    }
    // the month after next is always far enough away, and the current month is the one that used to be cut off first
    expect(listed).toContain(`EM-${p.tag}-3`);
  });

  test('EXPM-2 the same batches are flagged expired by the same rule in the stock list @edge', async ({ api }) => {
    const p = await batches(api, [0, 1, 2]);
    const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400, id: p.productid }, MGR)).body as any[];
    for (const o of p.offsets) {
      const r = rows.find((x) => x.batch === `EM-${p.tag}-${o}`);
      expect(r, `batch +${o} is in the stock list`).toBeTruthy();
      expect(r.expired).toBe(!sellable(o));
    }
  });
});
