/**
 * Out-pass for goods that leave the shop as waste — DISP-1..5
 * Source: docs/planning/EXPIRY_REVAMP.md (step 1)
 * A pass is made, approved by a Store Head or Business Head (the quantity is then held: on the books, not saleable), and confirmed when the goods are handed
 * over or destroyed: that is when the stock drops. Schedule H / H1 / X lines go in the disposal register. A vendor says whether it takes expired goods back.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';
const CASHIER = 'sales1@local.test';
const run = Date.now().toString().slice(-7);

const thisMonth = () => { const d = new Date(); d.setUTCDate(1); return d.toISOString().slice(0, 10); };   // good until the end of this month: within 30 days
const lastMonth = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 1, 1); return d.toISOString().slice(0, 10); };

let lastLocation = '';
async function freshStore(api: any) {
  const location = `Disp ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`;
  const s = await api.request('POST', '/stores', { location, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  lastLocation = location;
  return s.body.id as number;
}
async function vendor(api: any) {
  return (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
}
/** a new product received into the store in one completed batch of `qty` units, expiring on `exp` */
async function batch(api: any, storeid: number, qty: number, exp: string, extra: Record<string, any> = {}) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const prod = await api.request('POST', '/products', { title: `QA DISP ${stamp}`, taxpcnt: 12, category: 'Analgesic', code: `DP${stamp}`, ...extra }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const v = await vendor(api);
  const inv = await api.request('POST', '/purchases', { vendorid: v.id, storeid, invoiceno: `QA-DISP-${stamp}`, invoicedate: '2026-09-01' }, MGR);
  expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: 100, ptrcost: 112, mrpcost: 200, taxpcnt: 12, total: qty * 100,
    batch: `DP-${stamp}`.slice(0, 20), expdate: exp, saleprice: 190,
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  return { itemid: it.body.id as number, productid: prod.body.id as number, vendorid: v.id as number, title: prod.body.title as string };
}
const expiryOf = async (api: any, storeid: number, who = MGR) => (await api.request('GET', `/disposal/expiry?storeid=${storeid}`, undefined, who)).body;
const row = (list: any, itemid: number) => list.items.find((i: any) => i.itemid === itemid);

test.describe('Out-pass and the expiry list @p1', () => {
  test('DISP-1 the expiry list shows a batch with what is on the books; a vendor takes it back only when its setting says so @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 10, thisMonth());
    let r = row(await expiryOf(api, sid), b.itemid);
    expect(r).toMatchObject({ balance: 10, held: 0, sellable: 10, band: 'D30', takesback: 'NONE', canreturn: false });

    const before = (await api.request('GET', `/vendors/${b.vendorid}`, undefined, MGR)).body;
    try {
      const set = await api.request('PUT', `/vendors/${b.vendorid}`, { takesback: 'NEAR_EXPIRY', takebackdays: 60 }, MGR);
      expect(set.status, JSON.stringify(set.body)).toBeLessThan(300);
      r = row(await expiryOf(api, sid), b.itemid);
      expect(r).toMatchObject({ takesback: 'NEAR_EXPIRY', takebackdays: 60, canreturn: true });
      expect((await api.request('PUT', `/vendors/${b.vendorid}`, { takesback: 'SOMETIMES' }, MGR)).status).toBe(400);   // only the known choices
    } finally {
      await api.request('PUT', `/vendors/${b.vendorid}`, { takesback: before.takesback || 'NONE', takebackdays: before.takebackdays ?? null }, MGR);
    }
  });

  test('DISP-2 a pass: made, approved (the quantity is held), confirmed (the stock drops); the lines and the numbers are kept @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 10, lastMonth());
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ band: 'EXPIRED', balance: 10 });

    const made = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'DESTROYED', notes: 'qa', lines: [{ itemid: b.itemid, qty: 4 }] }, MGR);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    expect(made.body).toMatchObject({ status: 'DRAFT', reason: 'EXPIRED', method: 'DESTROYED' });
    expect(made.body.pass_no).toMatch(/^OP-\d{4}-\d{4,}$/);
    expect(made.body.totals.qty).toBe(4);
    expect(made.body.totals.cost).toBe(400);                                                    // 4 units at 100
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ balance: 10, held: 0 });   // waiting: nothing held yet

    const ok = await api.request('POST', `/disposal/${made.body.id}/approve`, undefined, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body.status).toBe('APPROVED');
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ balance: 10, held: 4, sellable: 6 });   // on the books, not saleable

    const over = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'DESTROYED', lines: [{ itemid: b.itemid, qty: 7 }] }, MGR);
    expect(over.status).toBe(400);                                                              // only 6 can still go
    expect(JSON.stringify(over.body)).toMatch(/only 6/);

    const conf = await api.request('POST', `/disposal/${made.body.id}/confirm`, { handed_on: new Date().toISOString().slice(0, 10) }, MGR);
    expect(conf.status, JSON.stringify(conf.body)).toBeLessThan(300);
    expect(conf.body.status).toBe('CONFIRMED');
    expect(conf.body.lines[0].qtychange_id).toBeTruthy();
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ balance: 6, held: 0 });     // the stock dropped when the goods were confirmed gone

    expect((await api.request('POST', `/disposal/${made.body.id}/confirm`, {}, MGR)).status).toBe(400);   // not twice
    const list = (await api.request('GET', `/disposal?storeid=${sid}&status=CONFIRMED`, undefined, MGR)).body.rows;
    expect(list.map((p: any) => p.id)).toContain(made.body.id);
  });

  test('DISP-3 who approves: not an ordinary staff member; a rejected or cancelled pass holds nothing @negative', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 5, lastMonth());
    // sales staff are not assigned to this store, so they cannot even raise one here
    const staff = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'DESTROYED', lines: [{ itemid: b.itemid, qty: 1 }] }, CASHIER);
    expect(staff.status).toBe(403);

    const made = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'DESTROYED', lines: [{ itemid: b.itemid, qty: 2 }] }, MGR);
    expect((await api.request('POST', `/disposal/${made.body.id}/approve`, undefined, CASHIER)).status).toBe(403);
    const noWhy = await api.request('POST', `/disposal/${made.body.id}/reject`, { note: '' }, MGR);
    expect(noWhy.status).toBe(400);
    const rej = await api.request('POST', `/disposal/${made.body.id}/reject`, { note: 'qa: not these' }, MGR);
    expect(rej.body.status).toBe('REJECTED');

    const second = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'DESTROYED', lines: [{ itemid: b.itemid, qty: 3 }] }, MGR);
    await api.request('POST', `/disposal/${second.body.id}/approve`, undefined, MGR);
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ held: 3 });
    const cancelled = await api.request('POST', `/disposal/${second.body.id}/cancel`, { note: 'qa' }, MGR);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ held: 0, balance: 5 });     // the hold is released
    expect((await api.request('POST', `/disposal/${second.body.id}/confirm`, {}, MGR)).status).toBe(400);   // a cancelled pass cannot be confirmed
  });

  test('DISP-4 a scheduled drug goes in the disposal register at confirmation; a method needs its detail @edge', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 6, lastMonth(), { props: { schedule: 'H1' } });
    const noAgency = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'AGENCY', lines: [{ itemid: b.itemid, qty: 2 }] }, MGR);
    expect(noAgency.status).toBe(400);                                                          // an agency is named for an agency
    const made = await api.request('POST', '/disposal', { storeid: sid, reason: 'EXPIRED', method: 'AGENCY', agency: 'QA Disposal Co', lines: [{ itemid: b.itemid, qty: 2 }] }, MGR);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    expect(made.body.lines[0].schedule).toBe('H1');
    await api.request('POST', `/disposal/${made.body.id}/approve`, undefined, MGR);
    const conf = await api.request('POST', `/disposal/${made.body.id}/confirm`, {}, MGR);        // a Business Head confirming needs no second witness
    expect(conf.status, JSON.stringify(conf.body)).toBeLessThan(300);
    expect(conf.body.lines[0]).toMatchObject({ reg_schedule: 'H1' });
    expect(conf.body.lines[0].reg_serial).toBeGreaterThan(0);
  });

  test('DISP-5 the printed out-pass downloads as a PDF @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 3, lastMonth());
    const made = await api.request('POST', '/disposal', { storeid: sid, reason: 'DAMAGED', method: 'DESTROYED', lines: [{ itemid: b.itemid, qty: 1 }] }, MGR);
    const API = process.env.QA_API_URL as string;
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123', scope: 'business' }) });
    const token = (await login.json()).token;
    const r = await fetch(`${API}/disposal/${made.body.id}/pdf`, { headers: { authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/pdf');
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(1500);
  });

  test('DISP-6 a held quantity cannot be sold; a scheduled drug confirmed by a non-manager needs a witness @edge', async ({ api }) => {
    const sid = 1;                                                                               // the seeded store: sales staff work here
    const b = await batch(api, sid, 10, thisMonth(), { props: { schedule: 'H1' } });
    const bill = (qty: number) => {
      const now = new Date().toISOString();
      const total = +(150 * qty).toFixed(2);
      return api.request('POST', '/sales', {
        customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7,
        status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
        items: [{ itemid: b.itemid, productid: b.productid, batch: 'x', price: 150, mrpcost: 200, taxpcnt: 0, qty, total }],
      }, CASHIER);
    };
    const made = await api.request('POST', '/disposal', { storeid: sid, reason: 'NEAR_EXPIRY', method: 'DESTROYED', lines: [{ itemid: b.itemid, qty: 6 }] }, MGR);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    await api.request('POST', `/disposal/${made.body.id}/approve`, undefined, MGR);
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ balance: 10, held: 6, sellable: 4 });

    const refused = await bill(5);
    expect(refused.status, JSON.stringify(refused.body)).toBeGreaterThanOrEqual(400);            // 10 on the books, 6 held: only 4 can be sold
    expect(JSON.stringify(refused.body)).toMatch(/available 4/);

    // a Sales Staff member confirms: a scheduled drug needs a witness, who is another staff member of the store
    const noWitness = await api.request('POST', `/disposal/${made.body.id}/confirm`, {}, CASHIER);
    expect(noWitness.status, JSON.stringify(noWitness.body)).toBe(400);
    expect(JSON.stringify(noWitness.body)).toMatch(/witness/i);
    const staff = (await api.request('GET', `/disposal/witnesses?storeid=${sid}`, undefined, CASHIER)).body;
    expect(staff.length).toBeGreaterThan(0);
    const conf = await api.request('POST', `/disposal/${made.body.id}/confirm`, { witness_id: staff[0].id }, CASHIER);
    expect(conf.status, JSON.stringify(conf.body)).toBeLessThan(300);
    expect(conf.body.witness_id).toBe(staff[0].id);
    expect(conf.body.lines[0].reg_serial).toBeGreaterThan(0);
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ balance: 4, held: 0 });
  });

  test('DISP-7 the Expiry screen: bands with counts, Discard makes an out-pass, approve then confirm on the pass; the Held column shows in between @happy', async ({ app, api }) => {
    const sid = await freshStore(api);
    const b = await batch(api, sid, 8, lastMonth());
    const location = lastLocation;
    const { page } = await app.open(MGR, '/secure/store/stock/expiry');
    await expect(page.getByTestId('expiry-need-store')).toBeVisible();                           // a Business Head starts on "All stores": the list needs one
    const picker = page.getByRole('combobox', { name: 'Select store' });
    await picker.selectOption(String(sid));
    await expect(page.getByTestId('expiry-screen')).toBeVisible();
    await expect(page.getByTestId('expiry-band-EXPIRED')).toContainText('1');
    const line = page.getByTestId('expiry-row').filter({ hasText: b.title });
    await expect(line).toHaveCount(1);
    await expect(line.getByTestId('expiry-return')).toHaveCount(0);                               // this vendor does not take expired goods back

    await line.getByTestId('expiry-discard').click();
    await expect(page.getByTestId('pass-form')).toBeVisible();
    await page.getByTestId('pass-qty').fill('3');
    await page.getByTestId('pass-save').click();

    await expect(page.getByTestId('pass-detail')).toBeVisible();
    await expect(page.getByTestId('pass-status')).toContainText('Waiting for approval');
    await page.getByTestId('pass-approve').click();
    await expect(page.getByTestId('pass-status')).toContainText('goods not handed over');
    await expect(page.getByTestId('pass-confirm-box')).toBeVisible();

    // approved: held 3, still 8 on the books
    await page.getByRole('link', { name: 'Expiry', exact: true }).click();
    await expect(page.getByTestId('expiry-row').filter({ hasText: b.title }).getByTestId('expiry-held')).toHaveText('3');
    await page.goBack();
    await page.getByTestId('pass-confirm').click();
    await expect(page.getByTestId('pass-status')).toContainText('Handed over');
    expect(row(await expiryOf(api, sid), b.itemid)).toMatchObject({ balance: 5, held: 0 });
  });
});
