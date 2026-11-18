/**
 * The vault count after the day closes — VCNT-1..4
 * When a store with a vault ends its day (a shift closed as end of day), a vault count is owed. A manager or the person who closed the day may do it;
 * a count that differs from the books needs a reason; nothing else about the vault changes.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const notes = (n: number) => [{ d: 500, n }];

/** a store with a vault holding 20 x 500, and two cashiers assigned to it */
async function vaultStore(api: any) {
  const location = `VCNT ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`;
  const s = await api.request('POST', '/stores', { location, depositthreshold: 5000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  const on = await api.request('PUT', `/stores/${s.body.id}`, { location, depositthreshold: 5000, vaultenabled: true, isActive: true }, MGR);
  expect(on.status, JSON.stringify(on.body)).toBeLessThan(300);
  expect((await api.request('POST', `/store-vault/${s.body.id}/opening`, { denominations: notes(20) }, MGR)).status).toBeLessThan(300);
  const cashier = async (tag: string) => {
    const email = `vc${tag[0]}${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(2, 4)}@local.test`;
    const u = await api.request('POST', '/users', { fullname: `QA Vault ${tag}`, email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid: 2, storeids: [s.body.id] }, MGR);
    expect(u.status, JSON.stringify(u.body)).toBeLessThan(300);
    return email;
  };
  return { id: s.body.id as number, closer: await cashier('closer'), other: await cashier('other') };
}

/** the cashier opens a shift with 2 x 500 and closes it counted the same, as the end of the day */
async function endTheDay(api: any, storeid: number, email: string) {
  const open = await api.request('POST', '/store-cash/shifts', { storeid, name: 'vcnt', openingdenominations: notes(2) }, email);
  expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);
  const close = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, { counteddenominations: notes(2), closetype: 'END_OF_DAY', vaultdropskipreason: 'qa: the key is with the owner' }, email);
  expect(close.status, JSON.stringify(close.body)).toBeLessThan(300);
}

const due = async (api: any, storeid: number, email: string) => (await api.request('GET', `/store-vault/${storeid}/count-due`, undefined, email));

test.describe('Vault count after the day closes @p1', () => {
  test('VCNT-1 nothing is owed until the day closes; then the person who closed it, and a manager, may count @happy', async ({ api }) => {
    const s = await vaultStore(api);
    expect((await due(api, s.id, MGR)).body).toMatchObject({ enabled: true, due: false });

    await endTheDay(api, s.id, s.closer);
    const mine = (await due(api, s.id, s.closer)).body;
    expect(mine.due).toBe(true);
    expect(mine.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mine.maycount).toBe(true);                                            // the closing cashier
    expect((await due(api, s.id, MGR)).body.maycount).toBe(true);                // a manager
    const other = (await due(api, s.id, s.other)).body;
    expect(other.due).toBe(true);
    expect(other.maycount).toBe(false);                                           // another cashier of the store did not close the day
    expect((await api.request('POST', `/store-vault/${s.id}/count`, { denominations: notes(20) }, s.other)).status).toBe(403);
  });

  test('VCNT-2 the closing cashier counts; a count that matches the books needs no reason and settles it @happy', async ({ api }) => {
    const s = await vaultStore(api);
    await endTheDay(api, s.id, s.closer);
    const done = await api.request('POST', `/store-vault/${s.id}/count`, { denominations: notes(20) }, s.closer);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    expect(done.body.variance).toBe(0);
    expect(done.body.reason).toBeNull();
    expect((await due(api, s.id, s.closer)).body.due).toBe(false);
  });

  test('VCNT-3 a count that differs from the books needs a reason, which is kept and shown @edge', async ({ api }) => {
    const s = await vaultStore(api);
    await endTheDay(api, s.id, s.closer);
    const short = await api.request('POST', `/store-vault/${s.id}/count`, { denominations: notes(19) }, s.closer);
    expect(short.status).toBe(400);
    expect(short.body.needsreason).toBe(true);
    expect(short.body.variance).toBe(-500);
    expect(JSON.stringify(short.body)).toContain('short of the books');
    expect((await api.request('POST', `/store-vault/${s.id}/count`, { denominations: notes(19), reason: 'no' }, s.closer)).status).toBe(400);   // too short to be a reason
    expect((await due(api, s.id, s.closer)).body.due).toBe(true);                // a refused count settles nothing

    const ok = await api.request('POST', `/store-vault/${s.id}/count`, { denominations: notes(19), reason: 'one note was banked and not entered' }, s.closer);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body).toMatchObject({ variance: -500, reason: 'one note was banked and not entered' });
    const state = (await api.request('GET', `/store-vault/${s.id}`, undefined, MGR)).body;
    expect(state.lastcount.reason).toBe('one note was banked and not entered');
    expect((await due(api, s.id, s.closer)).body.due).toBe(false);
  });

  test('VCNT-4 the day closed as a handover does not owe a count, and a cashier cannot count when no day was closed @negative', async ({ api }) => {
    const s = await vaultStore(api);
    // a cashier who never closed a day may not count (and the vault stays hidden from them)
    expect((await api.request('POST', `/store-vault/${s.id}/count`, { denominations: notes(20) }, s.closer)).status).toBe(403);
    expect((await api.request('GET', `/store-vault/${s.id}`, undefined, s.closer)).status).toBe(403);

    // a handover ends a shift, not the day
    const open = await api.request('POST', '/store-cash/shifts', { storeid: s.id, name: 'vcnt-h', openingdenominations: notes(2) }, s.closer);
    expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);
    const handed = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, { counteddenominations: notes(2), closetype: 'HANDOVER', handovertoid: (await api.request('GET', '/auth/me', undefined, s.other)).body.id, vaultdropskipreason: 'qa' }, s.closer);
    expect(handed.status, JSON.stringify(handed.body)).toBeLessThan(300);
    expect((await due(api, s.id, MGR)).body.due).toBe(false);
  });
});
