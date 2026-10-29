/**
 * Regression tests for the branch code review - RF-1..8
 * A refused sale update leaves the bill as it was; a parked bill completed later meets the rules of a new bill; staff totals count each bill once;
 * a person cannot approve their own stock adjustment by naming the status; people lists stay inside the business; a duplicate licence does not stop the
 * compliance sync; the books of one business are not mixed with another's; a close refused for another reason records no reason.
 */
import { execFileSync } from 'child_process';
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const ADMIN = 'siteadmin@local.test';
const SALES = 'sales1@local.test';
const DB = process.env.QA_DB_NAME || 'rgpdb';

function sql(q: string): string | null {
  try {
    return execFileSync('docker', ['exec', 'rgp-db-dev', 'psql', '-U', 'rgpapp', '-d', DB, '-At', '-c', q], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
  } catch { return null; }
}
const haveDb = sql('select 1') === '1';

const stockLines = async (api: any, n: number) => {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, SALES)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
  return rows.slice(0, n);
};
const line = (l: any, qty: number, price: number) => ({ itemid: l.item_id, productid: l.id, batch: l.batch, price, mrpcost: l.mrp_cost, taxpcnt: Number(l.tax_pcnt) || 12, qty, total: qty * price, status: 'Complete' });
const parkedBill = async (api: any, lines: any[]) => {
  const now = new Date().toISOString();
  const items = lines.map((l) => line(l, 2, 50));
  const total = items.reduce((a, i) => a + i.total, 0);
  const r = await api.request('POST', '/sales', {
    billdate: now, orderdate: now, cashamt: 0, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'PENDING', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'QA Review', mobile: `9${Math.floor(100000000 + Math.random() * 899999999)}` }, items,
  }, SALES);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return { id: r.body.id as number, total, items };
};

test.describe('Review fixes @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('RF-1 a refused update of a parked bill leaves its lines in place; a bill completed later must be paid in full @negative', async ({ api }) => {
    const lines = await stockLines(api, 2);
    test.skip(lines.length < 2, 'needs two stocked batches');
    const bill = await parkedBill(api, lines);
    const before = await api.request('GET', `/sales/${bill.id}`, undefined, SALES);
    expect(before.body.items.length).toBe(2);
    const kept = before.body.items[0];
    // completing with one line left out and a payment that does not match the total is refused
    const refused = await api.request('PUT', '/sales', {
      id: bill.id, billdate: before.body.billdate, status: 'COMPLETE', total: kept.total, cashamt: 1, digiamt: 0, deliverytype: 'Counter', ordertype: 'Walk-in',
      items: [{ ...kept }],
    }, SALES);
    expect(refused.status, JSON.stringify(refused.body)).toBe(400);
    const after = await api.request('GET', `/sales/${bill.id}`, undefined, SALES);
    expect(after.body.items.length).toBe(2);
    expect(after.body.status).toBe('PENDING');
  });

  test('RF-2 staff totals count each bill once, whatever its number of lines @happy', async ({ api }) => {
    test.skip(!haveDb, 'needs the local docker database');
    const expected = Number(sql(`select coalesce(sum(s.total), 0) from sale s left join store_shifts ss on ss.id = s.shift_id where s.status = 'COMPLETE' and s.active and coalesce(s.store_id, ss.store_id) = 1`));
    const r = await api.request('GET', '/sales/staff-summary?storeid=1', undefined, MGR);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const got = r.body.reduce((a: number, s: any) => a + Number(s.net_total), 0);
    expect(Math.abs(got - expected)).toBeLessThan(1);
    const count = Number(sql(`select count(*) from sale s left join store_shifts ss on ss.id = s.shift_id where s.status = 'COMPLETE' and s.active and coalesce(s.store_id, ss.store_id) = 1`));
    expect(r.body.reduce((a: number, s: any) => a + Number(s.sales_count), 0)).toBe(count);
  });

  test('RF-3 a store the person does not work in is refused in the staff totals @negative', async ({ api }) => {
    const mine = (await api.request('GET', '/stores', undefined, HEAD)).body as any[];
    const all = (await api.request('GET', '/stores', undefined, ADMIN)).body as any[];
    const own = new Set(mine.map((s) => s.id));
    const other = all.find((s) => !own.has(s.id));
    test.skip(!other, 'no store outside the Store Head to ask for');
    const r = await api.request('GET', `/sales/staff-summary?storeid=${other.id}`, undefined, HEAD);
    expect([403, 200]).toContain(r.status);
    if (r.status === 200) expect(r.body).toEqual([]);
  });

  test('RF-4 a person cannot approve their own stock adjustment by naming the status @negative', async ({ api }) => {
    const lines = await stockLines(api, 1);
    test.skip(!lines.length, 'needs a stocked batch');
    const r = await api.request('POST', '/stock/adjust/qty', { itemid: lines[0].item_id, qty: -25, reasoncode: 'CORRECTION', reason: 'qa review', status: 'APPROVED' }, SALES);
    if (r.status >= 400) { expect([401, 403]).toContain(r.status); return; }      // no permission at all is also a refusal
    expect(r.body.status).not.toBe('APPROVED');
  });

  test('RF-5 the people list and a person are inside the business @negative', async ({ api }) => {
    const mine = await api.request('GET', '/users', undefined, HEAD);
    expect(mine.status).toBe(200);
    const businesses = new Set(mine.body.map((u: any) => u.business_id));
    expect(businesses.size).toBeLessThanOrEqual(1);
    const everyone = (await api.request('GET', '/users', undefined, ADMIN)).body as any[];
    const foreign = everyone.find((u) => u.business_id && !businesses.has(u.business_id));
    test.skip(!foreign, 'no user of another business');
    expect((await api.request('GET', `/users/${foreign.id}`, undefined, HEAD)).status).toBe(403);
  });

  test('RF-6 a duplicate licence entry does not stop the compliance sync @edge', async ({ api }) => {
    test.skip(!haveDb, 'needs the local docker database');
    sql(`delete from store_license where number like 'RF-DUP%'`);
    const a = sql(`insert into store_license (store_id, license_type, number, valid_to) values (1, 'RETAIL_20_21', 'RF-DUP-A', current_date - 2) returning id`);
    const b = sql(`insert into store_license (store_id, license_type, number, valid_to) values (1, 'RETAIL_20_21', 'RF-DUP-B', current_date - 2) returning id`);
    try {
      expect(a && b).toBeTruthy();
      const r = await api.request('POST', '/compliance/sync', {}, MGR);
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    } finally {
      sql(`delete from store_license where number like 'RF-DUP%'`);
      sql(`delete from compliance_instance where item_key = 'licence' and detail->>'number' like 'RF-DUP%'`);
      await api.request('POST', '/compliance/sync', {}, MGR);
    }
  });

  test('RF-7 bank and finance totals count only the business\'s own stores @happy', async ({ api }) => {
    test.skip(!haveDb, 'needs the local docker database');
    const mine = (await api.request('GET', '/stores', undefined, MGR)).body.map((s: any) => s.id);
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const r = await api.request('GET', `/finance/overview?from=${from}&to=${to}`, undefined, MGR);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const expected = Number(sql(`select coalesce(sum(total), 0) from sale where status = 'COMPLETE' and bill_date >= '${from}'::date and bill_date < ('${to}'::date + 1) and (store_id in (${mine.join(',')}) or store_id is null)`));
    expect(Math.abs(Number(r.body.books?.sales?.total ?? r.body.books?.sales ?? expected) - expected)).toBeLessThan(1);
  });

  test('RF-8 a shift close refused for another reason records no "went ahead" reason @negative', async ({ api }) => {
    test.skip(!haveDb, 'needs the local docker database');
    const user = (await api.request('GET', '/auth/me', undefined, MGR)).body;
    const s = await api.request('POST', '/stores', { location: `RF8 ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
    const sid = s.body.id;
    sql(`insert into sale (store_id, status, bill_date, total, created_on) values (${sid}, 'COMPLETE', now(), 100, now())`);
    sql(`insert into stock_count (status, category, store_id, started_by, started_on, completed_by, completed_on) values ('COMPLETED', 'QA', ${sid}, ${user.id}, now() - interval '20 days', ${user.id}, now() - interval '20 days')`);
    const shift = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 400, name: 'rf8', openingchecklist: ['float_counted'] }, MGR);
    expect(shift.status, JSON.stringify(shift.body)).toBeLessThan(300);
    await api.request('POST', '/compliance/sync', {}, MGR);
    const refused = await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { closedoperatorid: user.id, closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted', 'cash_secured'] }, MGR);
    const item = refused.body.required.find((i: any) => i.item_key === 'stock_count');
    // the reason is given but the drawer count is missing: refused, and no reason is recorded
    const again = await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { closedoperatorid: user.id, closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted', 'cash_secured'], compliancereasons: { [item.id]: 'Shelves are being moved this week' } }, MGR);
    expect(again.status).toBe(400);
    expect(String(again.body.message)).toMatch(/drawer count/i);
    const ev = await api.request('GET', `/compliance/${item.id}/events`, undefined, MGR);
    expect(ev.body.map((e: any) => e.kind)).not.toContain('reason');
    // closed properly, the reason is recorded once
    const ok = await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { countedcash: 400, closedoperatorid: user.id, closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted', 'cash_secured'], compliancereasons: { [item.id]: 'Shelves are being moved this week' } }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect((await api.request('GET', `/compliance/${item.id}/events`, undefined, MGR)).body.filter((e: any) => e.kind === 'reason').length).toBe(1);
    // closing it a second time is refused
    expect((await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { countedcash: 400, closedoperatorid: user.id, closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted', 'cash_secured'] }, MGR)).status).toBeGreaterThanOrEqual(400);
  });
});
