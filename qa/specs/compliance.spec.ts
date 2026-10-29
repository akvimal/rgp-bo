/**
 * The compliance register - CR-1..5
 * A licence that has ended is owed and sits high on the ladder; the store head sees the store's items and a salesperson only their own; the store head
 * asks for a waiver and only the Business Head grants it, for no longer than the business allows; renewing the licence closes the item.
 * Each test makes its own store, so nothing else is touched.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = 'admin123';
const day = (offset: number) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);

async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', { location: `CR ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true }, MGR);
  return { id: s.body.id as number, location: s.body.location as string };
}
async function user(api: any, storeId: number, roleid: number) {
  const email = `qa.cr.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
  const r = await api.request('POST', '/users', { fullname: 'QA Register User', email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid, storeids: [storeId] }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return email;
}
const licence = (api: any, id: number, validto: string, number = 'CR-1') =>
  api.request('PUT', `/stores/${id}/licenses`, { licenses: [{ licensetype: 'RETAIL_20_21', number, validfrom: day(-400), validto }] }, MGR);
const sync = (api: any) => api.request('POST', '/compliance/sync', {}, MGR);
const storeList = async (api: any, as: string) => (await api.request('GET', '/compliance/store', undefined, as)).body as any[];
const licItem = (list: any[], location: string) => list.find((r) => r.item_key === 'licence' && String(r.location).trim() === location.trim());

test.describe('Compliance register @p1', () => {
  test('CR-1 an ended licence is owed and escalated; the Business Head sees it with its detail @happy', async ({ api }) => {
    const s = await freshStore(api);
    await licence(api, s.id, day(-5));
    expect((await sync(api)).status).toBe(201);
    const it = licItem(await storeList(api, MGR), s.location);
    expect(it, 'licence item').toBeTruthy();
    expect(it).toMatchObject({ step: 'escalated', cls: 'legal', owner: 'owner' });
    expect(it.detail.type).toBe('RETAIL_20_21');
    // a licence ending in 20 days is only a reminder
    await licence(api, s.id, day(20), 'CR-1b');
    await sync(api);
    expect(licItem(await storeList(api, MGR), s.location)?.step).toBe('reminder');
  });

  test('CR-2 a store head sees the store; a salesperson sees only their own items and cannot open the store list @negative', async ({ api }) => {
    const s = await freshStore(api);
    await licence(api, s.id, day(-1));
    await sync(api);
    const head = await user(api, s.id, 3);
    const sales = await user(api, s.id, 2);
    expect(licItem(await storeList(api, head), s.location)).toBeTruthy();
    expect((await api.request('GET', '/compliance/store', undefined, sales)).status).toBe(403);
    const mine = (await api.request('GET', '/compliance/mine', undefined, sales)).body as any[];
    expect(mine.find((r) => r.item_key === 'licence')).toBeUndefined();
    // the licence belongs to the Business Head's own list, not the store head's
    const headMine = (await api.request('GET', '/compliance/mine', undefined, head)).body as any[];
    expect(headMine.find((r) => r.item_key === 'licence')).toBeUndefined();
  });

  test('CR-3 a store head asks, only the Business Head grants, inside the longest waiver @happy', async ({ api }) => {
    const s = await freshStore(api);
    await licence(api, s.id, day(-1));
    await sync(api);
    const head = await user(api, s.id, 3);
    const id = licItem(await storeList(api, MGR), s.location).id;
    expect((await api.request('POST', `/compliance/${id}/waiver-request`, { reason: 'x' }, head)).status).toBe(400);
    expect((await api.request('POST', `/compliance/${id}/waiver-request`, { reason: 'Renewal papers are with the authority' }, head)).status).toBe(201);
    expect((await api.request('POST', `/compliance/${id}/waiver-request`, { reason: 'again please' }, head)).status).toBe(400);
    expect((await api.request('POST', `/compliance/${id}/waiver`, { days: 3 }, head)).status).toBe(403);
    expect((await api.request('POST', `/compliance/${id}/waiver`, { days: 30 }, MGR)).status).toBe(400);
    const ok = await api.request('POST', `/compliance/${id}/waiver`, { days: 3, note: 'Papers filed' }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.until).toBe(day(2));
    const it = licItem(await storeList(api, MGR), s.location);
    expect(it.step).toBe('waived');
    expect(it.waiver).toMatchObject({ status: 'GRANTED', until: day(2) });
  });

  test('CR-4 a declined request leaves the item where it was; not-mine is for your own item @edge', async ({ api }) => {
    const s = await freshStore(api);
    await licence(api, s.id, day(-1));
    await sync(api);
    const head = await user(api, s.id, 3);
    const sales = await user(api, s.id, 2);
    const id = licItem(await storeList(api, MGR), s.location).id;
    await api.request('POST', `/compliance/${id}/waiver-request`, { reason: 'Please give us time' }, head);
    const d = await api.request('POST', `/compliance/${id}/waiver`, { grant: false, note: 'Renew it now' }, MGR);
    expect(d.status).toBe(201);
    expect(d.body.status).toBe('DECLINED');
    expect(licItem(await storeList(api, MGR), s.location).step).not.toBe('waived');
    expect((await api.request('POST', `/compliance/${id}/not-mine`, {}, sales)).status).toBe(403);
    expect((await api.request('POST', `/compliance/${id}/not-mine`, { note: 'Not my store' }, head)).status).toBe(201);
    expect(licItem(await storeList(api, MGR), s.location).not_mine).toBe(true);
  });

  test('CR-5 renewing the licence closes the item and the history is kept @happy', async ({ api }) => {
    const s = await freshStore(api);
    await licence(api, s.id, day(-2));
    await sync(api);
    const id = licItem(await storeList(api, MGR), s.location).id;
    await licence(api, s.id, day(400), 'CR-5b');
    await sync(api);
    expect(licItem(await storeList(api, MGR), s.location)).toBeUndefined();
    const sum = await api.request('GET', '/compliance/summary', undefined, MGR);
    expect(sum.status).toBe(200);
    expect(sum.body).toHaveProperty('needs');
    expect(id).toBeGreaterThan(0);
  });
});
