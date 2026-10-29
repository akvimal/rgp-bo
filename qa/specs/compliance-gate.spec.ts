/**
 * "Do this to continue" - GATE-1..3
 * Before a shift is opened, an unclosed shift of an earlier day is closed or a reason is given; before a shift is closed, a stock count far enough overdue
 * is done or a reason is given. A reason is recorded; nothing blocks without a way through. The drug licence block is off unless the Business Head turns it on.
 * Past dates cannot be made through the API, so the facts are backdated in the local QA database (the spec skips when docker is not there).
 */
import { execFileSync } from 'child_process';
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const DB = process.env.QA_DB_NAME || 'rgpdb';

function sql(q: string): string | null {
  try {
    return execFileSync('docker', ['exec', 'rgp-db-dev', 'psql', '-U', 'rgpapp', '-d', DB, '-At', '-c', q], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
  } catch { return null; }
}
const haveDb = sql('select 1') === '1';

const freshStore = async (api: any) => {
  const s = await api.request('POST', '/stores', { location: `GATE ${Date.now()}${Math.floor(Math.random() * 90 + 10)}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return s.body.id as number;
};
const me = async (api: any) => (await api.request('GET', '/auth/me', undefined, MGR)).body;
const open = (api: any, storeid: number, extra: any = {}) =>
  api.request('POST', '/store-cash/shifts', { storeid, openingcash: 400, name: 'gate', openingchecklist: ['float_counted'], ...extra }, MGR);
const close = (api: any, id: number, userId: number, extra: any = {}) =>
  api.request('PUT', `/store-cash/shifts/${id}/close`, { countedcash: 400, closedoperatorid: userId, closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted', 'cash_secured'], ...extra }, MGR);
const sync = (api: any) => api.request('POST', '/compliance/sync', {}, MGR);

test.describe.serial('Compliance gate @p1', () => {
  test.skip(!haveDb, 'needs the local docker database to backdate facts');

  // shifts other specs left open on earlier days would each be asked for here; start from a tidy ledger
  test.beforeAll(async ({ api }) => {
    sql(`update store_shifts set status = 'CLOSED', closed_on = now() where status = 'OPEN' and shift_date < current_date`);
    await sync(api);
  });

  test('GATE-1 an unclosed shift of an earlier day must be closed, or a reason given, before another is opened @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const user = await me(api);
    const first = await open(api, sid);
    expect(first.status, JSON.stringify(first.body)).toBeLessThan(300);
    sql(`update store_shifts set shift_date = current_date - 2, accountable_user_id = ${user.id} where id = ${first.body.id}`);
    expect((await sync(api)).status).toBe(201);

    const gate = await api.request('GET', `/compliance/gate?storeid=${sid}&phase=open`, undefined, MGR);
    expect(gate.body.map((i: any) => i.item_key)).toContain('shift_close');

    const refused = await open(api, sid, { name: 'second' });
    expect(refused.status).toBe(409);
    expect(refused.body.required.map((i: any) => i.item_key)).toContain('shift_close');
    expect(refused.body.message).toContain('Close the shift and count the cash');

    // a reason lets it go past the gate; the store's own rule (one open shift) then speaks
    const id = refused.body.required.find((i: any) => i.item_key === 'shift_close').id;
    const withReason = await open(api, sid, { name: 'second', compliancereasons: { [id]: 'The drawer key is with the owner who is away' } });
    expect(withReason.status).toBe(409);
    expect(withReason.body.required).toBeUndefined();
    expect(String(withReason.body.message)).toMatch(/open shift/i);
    const events = await api.request('GET', `/compliance/${id}/events`, undefined, MGR);
    expect(events.body.map((e: any) => e.kind)).toContain('reason');
    // having given a reason today, the gate is out of the way until tomorrow
    expect((await api.request('GET', `/compliance/gate?storeid=${sid}&phase=open`, undefined, MGR)).body).toEqual([]);

    // closing the old shift resolves the item for good
    expect((await close(api, first.body.id, user.id)).status).toBeLessThan(300);
    await sync(api);
    expect((await api.request('GET', '/compliance/store', undefined, MGR)).body.find((r: any) => r.id === id)).toBeUndefined();
  });

  test('GATE-2 a stock count far overdue must be done, or a reason given, before the shift is closed @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const user = await me(api);
    // the store has traded lately and last counted 20 days ago
    sql(`insert into sale (store_id, status, bill_date, total, created_on) values (${sid}, 'COMPLETE', now(), 100, now())`);
    sql(`insert into stock_count (status, category, store_id, started_by, started_on, completed_by, completed_on) values ('COMPLETED', 'QA', ${sid}, ${user.id}, now() - interval '20 days', ${user.id}, now() - interval '20 days')`);
    const shift = await open(api, sid);
    expect(shift.status, JSON.stringify(shift.body)).toBeLessThan(300);
    await sync(api);

    const refused = await close(api, shift.body.id, user.id);
    expect(refused.status).toBe(409);
    const item = refused.body.required.find((i: any) => i.item_key === 'stock_count');
    expect(item).toBeTruthy();
    expect(refused.body.message).toContain('Stock count');

    const ok = await close(api, shift.body.id, user.id, { compliancereasons: { [item.id]: 'Half the shelves are being moved this week' } });
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const ev = await api.request('GET', `/compliance/${item.id}/events`, undefined, MGR);
    expect(ev.body.find((e: any) => e.kind === 'reason')?.note).toContain('shelves');
  });

  test('GATE-3 a reason too short is refused, and a waiver clears the gate @edge', async ({ api }) => {
    const sid = await freshStore(api);
    const user = await me(api);
    sql(`insert into sale (store_id, status, bill_date, total, created_on) values (${sid}, 'COMPLETE', now(), 100, now())`);
    sql(`insert into stock_count (status, category, store_id, started_by, started_on, completed_by, completed_on) values ('COMPLETED', 'QA', ${sid}, ${user.id}, now() - interval '20 days', ${user.id}, now() - interval '20 days')`);
    const shift = await open(api, sid);
    await sync(api);
    const refused = await close(api, shift.body.id, user.id, { compliancereasons: { 0: 'no' } });
    expect(refused.status).toBe(409);
    const item = refused.body.required.find((i: any) => i.item_key === 'stock_count');
    expect((await close(api, shift.body.id, user.id, { compliancereasons: { [item.id]: 'x' } })).status).toBe(409);
    expect((await api.request('POST', `/compliance/${item.id}/waiver`, { days: 2, note: 'Stock arrives on Thursday' }, MGR)).status).toBe(201);
    expect((await api.request('GET', `/compliance/gate?storeid=${sid}&phase=close`, undefined, MGR)).body).toEqual([]);
    expect((await close(api, shift.body.id, user.id)).status).toBeLessThan(300);
  });

  test('GATE-4 the drug licence block is off until switched on, and a waiver lifts it @edge', async ({ api }) => {
    const COUNTER = 'sales1@local.test';
    const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    const ensureShift = async () => {
      const mineNow = await api.request('GET', '/store-cash/shifts/mine', undefined, COUNTER);
      if (mineNow.status < 300 && mineNow.body && (mineNow.body.id || mineNow.body.length)) return;
      await api.request('POST', '/store-cash/shifts', { storeid: 1, openingcash: 400, name: 'gate-4', openingchecklist: ['float_counted'] }, COUNTER);
    };
    const bill = async () => {
      await ensureShift();
      const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
        .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
      const l = rows[0];
      const now = new Date().toISOString();
      const total = 100;
      return api.request('POST', '/sales', {
        billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE',
        ordertype: 'Walk-in', deliverytype: 'Counter', customer: { name: 'QA Gate', mobile: `9${Math.floor(100000000 + Math.random() * 899999999)}` },
        items: [{ itemid: l.item_id, productid: l.id, batch: l.batch, price: 50, mrpcost: l.mrp_cost, taxpcnt: Number(l.tax_pcnt) || 12, qty: 2, total, status: 'Complete' }],
      }, COUNTER);
    };
    const wipe = () => sql(`delete from compliance_instance where store_id = 1 and item_key = 'licence'`);   // cascades its events and waivers
    wipe();
    sql(`insert into store_license (store_id, license_type, number, valid_to) values (1, 'RETAIL_20_21', 'GATE-BLOCK', current_date - 5)`);
    try {
      expect((await bill()).status).toBeLessThan(300);                      // off by default: nothing stops the till
      expect((await api.request('PUT', '/config/compliance', { values: { block_expired_licence: true }, effectiveFrom: today }, MGR)).status).toBe(200);
      const blocked = await bill();
      expect(blocked.status).toBe(403);
      expect(String(blocked.body.message)).toContain('drug licence has ended');
      await sync(api);
      const item = (await api.request('GET', '/compliance/store', undefined, MGR)).body.find((r: any) => r.item_key === 'licence' && r.detail?.number === 'GATE-BLOCK');
      expect(item, 'licence item').toBeTruthy();
      expect((await api.request('POST', `/compliance/${item.id}/waiver`, { days: 1, note: 'Renewal certificate is on its way' }, MGR)).status).toBe(201);
      expect((await bill()).status).toBeLessThan(300);                      // the waiver lifts it
    } finally {
      sql(`delete from store_license where number = 'GATE-BLOCK'`);
      wipe();
      await api.request('DELETE', '/config/compliance/block_expired_licence', undefined, MGR);
    }
  });
});
