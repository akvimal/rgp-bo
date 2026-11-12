/**
 * Expiry revamp, step 2: the backlog, the old write-offs and the statement — LEG-1..4
 * Source: docs/planning/EXPIRY_REVAMP.md
 * Expired stock thrown away long ago but still on the books is recorded in one out-pass marked "disposed earlier". Old adjustments made under other reasons that look
 * like expiry write-offs are reviewed and tagged (the adjustment itself never changes). The statement adds them up by month and financial year.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';
const API = process.env.QA_API_URL as string;

const lastMonth = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 1, 1); return d.toISOString().slice(0, 10); };
const longAgo = () => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 2, 0, 1); return d.toISOString().slice(0, 10); };
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', { location: `Leg ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return s.body.id as number;
}
async function batch(api: any, storeid: number, qty: number, exp: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const prod = await api.request('POST', '/products', { title: `QA LEG ${stamp}`, taxpcnt: 12, category: 'Analgesic', code: `LG${stamp}` }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body.find((x: any) => x.isActive !== false && !x.blocked);
  const inv = await api.request('POST', '/purchases', { vendorid: v.id, storeid, invoiceno: `QA-LEG-${stamp}`, invoicedate: '2026-09-01' }, MGR);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: 100, ptrcost: 112, mrpcost: 200, taxpcnt: 12, total: qty * 100, batch: `LG-${stamp}`.slice(0, 20), expdate: exp, saleprice: 190,
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  return { itemid: it.body.id as number, title: prod.body.title as string };
}
const expiryOf = async (api: any, storeid: number) => (await api.request('GET', `/disposal/expiry?storeid=${storeid}`, undefined, MGR)).body;
const legacyOf = async (api: any, storeid: number, status = '') => (await api.request('GET', `/disposal/legacy?storeid=${storeid}${status ? `&status=${status}` : ''}`, undefined, MGR)).body;
const statementOf = async (api: any, storeid: number) => (await api.request('GET', `/disposal/statement?storeid=${storeid}&from=2000-01-01`, undefined, MGR)).body;

test.describe('Expiry: backlog, old write-offs, statement @p1', () => {
  test('LEG-1 expired stock still on the books is recorded in one pass as disposed earlier, by a manager, for a day that is not in the future @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 10, lastMonth());
    const c = await batch(api, sid, 4, lastMonth());
    expect((await expiryOf(api, sid)).counts.EXPIRED).toBe(2);

    const staff = await api.request('POST', '/disposal/backlog', { storeid: sid, handed_on: day(-30) }, CASHIER);
    expect(staff.status).toBe(403);                                                              // not for sales staff
    const future = await api.request('POST', '/disposal/backlog', { storeid: sid, handed_on: day(3) }, MGR);
    expect(future.status).toBe(400);

    const r = await api.request('POST', '/disposal/backlog', { storeid: sid, handed_on: day(-30), notes: 'qa cleared long ago' }, MGR);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(r.body).toMatchObject({ status: 'CONFIRMED', legacy: true, reason: 'EXPIRED' });
    expect(r.body.handed_on).toContain(day(-30));
    expect(r.body.lines.length).toBe(2);
    expect(r.body.lines.every((l: any) => l.qtychange_id)).toBe(true);
    expect(r.body.totals.qty).toBe(14);
    expect(r.body.approved_by_name).toBeTruthy();                                                // made, approved and confirmed in one step

    expect((await expiryOf(api, sid)).counts.EXPIRED).toBe(0);                                   // the books no longer hold it
    const again = await api.request('POST', '/disposal/backlog', { storeid: sid, handed_on: day(-30) }, MGR);
    expect(again.status).toBe(400);                                                              // nothing left to record
    expect(b.itemid).not.toBe(c.itemid);
  });

  test('LEG-2 an old write-off under another reason that looks like expiry is listed with why, and tagged when a manager confirms it @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 10, longAgo());                                              // expired for a long time
    const adj = await api.request('POST', '/stock/adjust/qty', { itemid: b.itemid, qty: -3, storeid: sid, reason: 'Breakage', reasoncode: 'SHRINKAGE', comments: 'old stock cleared' }, MGR);
    expect(adj.status, JSON.stringify(adj.body)).toBeLessThan(300);
    // a transfer and a plain shrinkage of a healthy batch are not candidates
    const healthy = await batch(api, sid, 5, '2099-12-01');
    await api.request('POST', '/stock/adjust/qty', { itemid: healthy.itemid, qty: -1, storeid: sid, reason: 'Lost', reasoncode: 'SHRINKAGE' }, MGR);

    const list = await legacyOf(api, sid);
    const row = list.rows.find((r: any) => r.title === b.title);
    expect(row, JSON.stringify(list)).toBeTruthy();
    expect(row).toMatchObject({ qty: 3, tag: null, cost: 300 });                                 // 3 units at 100
    expect(row.signals).toEqual(expect.arrayContaining(['WAS_EXPIRED', 'WORDS']));
    expect(list.rows.find((r: any) => r.title === healthy.title)).toBeUndefined();               // nothing about it looks like expiry
    expect(list.counts.UNREVIEWED).toBe(1);

    expect((await api.request('POST', '/disposal/legacy/tag', { ids: [row.id], tag: 'EXPIRY' }, CASHIER)).status).toBe(403);
    expect((await api.request('POST', '/disposal/legacy/tag', { ids: [row.id], tag: 'MAYBE' }, MGR)).status).toBe(400);
    const tagged = await api.request('POST', '/disposal/legacy/tag', { ids: [row.id], tag: 'EXPIRY' }, MGR);
    expect(tagged.body.tagged, JSON.stringify(tagged.body)).toBe(1);
    expect((await legacyOf(api, sid, 'EXPIRY')).rows.map((r: any) => r.id)).toContain(row.id);
    expect((await legacyOf(api, sid, 'UNREVIEWED')).rows.map((r: any) => r.id)).not.toContain(row.id);

    // the adjustment itself is untouched: the stock is still 7
    const stock = (await expiryOf(api, sid)).items.find((i: any) => i.itemid === b.itemid);
    expect(stock.balance).toBe(7);
  });

  test('LEG-3 the statement adds out-passes, disposed-earlier passes and confirmed old write-offs by month and financial year, once each @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const old = await batch(api, sid, 6, longAgo());
    const adj = await api.request('POST', '/stock/adjust/qty', { itemid: old.itemid, qty: -2, storeid: sid, reason: 'Breakage', reasoncode: 'SHRINKAGE' }, MGR);
    expect(adj.status, JSON.stringify(adj.body)).toBeLessThan(300);
    const row = (await legacyOf(api, sid)).rows[0];
    await api.request('POST', '/disposal/legacy/tag', { ids: [row.id], tag: 'EXPIRY' }, MGR);

    const next = await batch(api, sid, 10, lastMonth());
    const pass = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'DESTROYED', lines: [{ itemid: next.itemid, qty: 4 }] }, MGR);
    await api.request('POST', `/disposal/${pass.body.id}/approve`, undefined, MGR);
    await api.request('POST', `/disposal/${pass.body.id}/confirm`, {}, MGR);
    const rest = await api.request('POST', '/disposal/backlog', { storeid: sid, handed_on: day(-10) }, MGR);   // what is left of the expired stock: the 4 of `old` and the 6 of `next`
    expect(rest.status, JSON.stringify(rest.body)).toBeLessThan(300);

    const st = await statementOf(api, sid);
    const by = (src: string) => st.rows.filter((r: any) => r.source === src).reduce((t: any, r: any) => ({ qty: t.qty + r.qty, cost: t.cost + r.cost }), { qty: 0, cost: 0 });
    expect(by('PASS')).toEqual({ qty: 4, cost: 400 });
    expect(by('TAGGED')).toEqual({ qty: 2, cost: 200 });
    expect(by('LEGACY_PASS')).toEqual({ qty: 10, cost: 1000 });
    expect(st.total).toMatchObject({ qty: 16, cost: 1600 });
    expect(st.byYear.reduce((t: number, y: any) => t + y.cost, 0)).toBe(1600);
    expect(st.rows[0].fy).toMatch(/^\d{4}-\d{2}$/);

    // not expiry: it leaves the statement
    await api.request('POST', '/disposal/legacy/tag', { ids: [row.id], tag: 'NOT_EXPIRY' }, MGR);
    expect((await statementOf(api, sid)).total).toMatchObject({ qty: 14, cost: 1400 });
  });

  test('LEG-4 the statement downloads as an Excel file @happy', async ({ api }) => {
    const sid = await freshStore(api);
    await batch(api, sid, 3, lastMonth());
    await api.request('POST', '/disposal/backlog', { storeid: sid, handed_on: day(-5) }, MGR);
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123', scope: 'business' }) });
    const token = (await login.json()).token;
    const r = await fetch(`${API}/disposal/statement.xlsx?storeid=${sid}&from=2000-01-01`, { headers: { authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('spreadsheetml');
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(0, 2).toString()).toBe('PK');                                          // an xlsx is a zip
    expect(buf.length).toBeGreaterThan(2000);
  });
});
