/**
 * Recognition - RC-1..4
 * A person sees their own badges and how close they are; the heads see the people of their stores in name order with no ranking; a store head or the
 * Business Head can send a line of thanks to a person of their stores, who sees it once; only the Business Head runs recognition by hand.
 * Each test makes its own store and people.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = 'admin123';

async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', { location: `RC ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true }, MGR);
  return s.body.id as number;
}
async function user(api: any, storeId: number, roleid: number, name = 'QA Recog User') {
  const email = `qa.rc.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
  const r = await api.request('POST', '/users', { fullname: name, email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid, storeids: [storeId] }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return { email, id: r.body.id as number };
}

test.describe('Recognition @p1', () => {
  test('RC-1 a person sees their own progress toward each habit badge, including the pharmacy one @happy', async ({ api }) => {
    const r = await api.request('GET', '/recognition/mine', undefined, 'sales1@local.test');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const rules = r.body.progress.map((p: any) => p.rule);
    expect(rules).toEqual(expect.arrayContaining(['till', 'capture', 'refill', 'beat', 'clean']));
    for (const p of r.body.progress) { expect(p.target).toBeGreaterThan(0); expect(p.value).toBeGreaterThanOrEqual(0); }
    expect(typeof r.body.paused).toBe('boolean');
    expect(Array.isArray(r.body.awards)).toBe(true);
  });

  test('RC-2 the store head thanks a person of the store, who sees it once; others cannot @happy', async ({ api }) => {
    const store = await freshStore(api);
    const head = await user(api, store, 3, 'QA Head');
    const sales = await user(api, store, 2, 'QA Seller');
    const other = await user(api, await freshStore(api), 2, 'QA Elsewhere');
    expect((await api.request('POST', '/recognition/thanks', { to: sales.id, text: 'x' }, head.email)).status).toBe(400);
    expect((await api.request('POST', '/recognition/thanks', { to: sales.id, text: 'Thank you for the calm Saturday rush' }, head.email)).status).toBe(201);
    expect((await api.request('POST', '/recognition/thanks', { to: other.id, text: 'Thank you for staying late' }, head.email)).status).toBe(403);
    expect((await api.request('POST', '/recognition/thanks', { to: sales.id, text: 'Thanks from a colleague' }, sales.email)).status).toBe(403);
    const mine = await api.request('GET', '/recognition/mine', undefined, sales.email);
    expect(mine.body.notes[0]).toMatchObject({ text: 'Thank you for the calm Saturday rush', seen: false });
    expect(mine.body.unseen).toBeGreaterThanOrEqual(1);
    expect((await api.request('POST', '/recognition/seen', {}, sales.email)).status).toBe(201);
    const after = await api.request('GET', '/recognition/mine', undefined, sales.email);
    expect(after.body.unseen).toBe(0);
  });

  test('RC-3 the team page is for the heads, in name order, with no ranking or points @negative', async ({ api }) => {
    const store = await freshStore(api);
    const head = await user(api, store, 3, 'QA Head');
    await user(api, store, 2, 'Zed Seller');
    await user(api, store, 2, 'Abe Seller');
    expect((await api.request('GET', '/recognition/team', undefined, 'sales1@local.test')).status).toBe(403);
    const t = await api.request('GET', '/recognition/team', undefined, head.email);
    expect(t.status).toBe(200);
    const names = t.body.map((p: any) => p.name);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)));
    expect(names).toEqual(expect.arrayContaining(['Abe Seller', 'Zed Seller']));
    const text = JSON.stringify(t.body).toLowerCase();
    for (const bad of ['rank', 'score', 'points', 'leaderboard']) expect(text).not.toContain(bad);
  });

  test('RC-4 only the Business Head runs recognition by hand @negative', async ({ api }) => {
    const store = await freshStore(api);
    const head = await user(api, store, 3, 'QA Head');
    expect((await api.request('POST', '/recognition/run', {}, head.email)).status).toBe(403);
    const ok = await api.request('POST', '/recognition/run', {}, MGR);
    expect(ok.status).toBe(201);
    expect(ok.body).toHaveProperty('awarded');
  });
});
