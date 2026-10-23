/**
 * Operating modes (docs/planning/OPERATING_MODES.md) - OM-1..
 * Step 1: the store profile (shift mode, accountable role, operator rule) and the shift desk, POS and cash close following it.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

let POOL: any[] = [];
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: PASS }),
  })).json()).token;
  const rows = await (await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
    body: JSON.stringify({ available: true, limit: 200 }),
  })).json();
  POOL = rows.filter((x: any) => Number(x.balance) > 30 && x.status === 'VERIFIED').map((x: any) => ({
    itemid: x.item_id, productid: x.id, batch: x.batch,
    price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)),
    mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

function denoms(amount: number) {
  let left = Math.max(0, Math.round(amount));
  const rows: { d: number; n: number }[] = [];
  for (const d of [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]) {
    const n = Math.floor(left / d);
    if (n > 0) { rows.push({ d, n }); left -= n * d; }
  }
  return rows;
}

async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', {
    location: `OM ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true,
  }, MGR);
  return s.body.id as number;
}
async function staffUser(api: any, storeId: number, roleid = 2) {
  const email = `qa.om.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
  const r = await api.request('POST', '/users', {
    fullname: 'QA OM Staff', email, password: PASS, phone: '9' + String(Date.now()).slice(-9),
    location: 'QA', roleid, storeids: [storeId],
  }, MGR);
  expect(r.status).toBeLessThan(300);
  return { email, id: r.body.id as number };
}
const setProfile = (api: any, id: number, body: any, as = MGR) => api.request('PUT', `/stores/${id}/profile`, body, as);
const openShift = (api: any, storeId: number, as: string, body: any = {}) =>
  api.request('POST', '/store-cash/shifts', { storeid: storeId, openingdenominations: denoms(1000), name: 'om', ...body }, as);
const closeShift = (api: any, id: number, as: string, body: any = {}) =>
  api.request('PUT', `/store-cash/shifts/${id}/close`, { counteddenominations: denoms(1000), ...body }, as);

function bill(total = 40) {
  const s = POOL[POOL.length - 4];
  const now = new Date().toISOString();
  return {
    customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0,
    expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 1, total }],
  };
}

test.describe('Operating modes: store profile @p1', () => {
  test('OM-1 a new store defaults to time-based shifts on a shared till that asks who is serving @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const p = await api.request('GET', `/store-cash/profile?storeid=${sid}`);
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ shiftmode: 'time', till: 'shared', accountablerole: 'auto', operatorrequired: true });
    expect(p.body.operatorholdminutes).toBe(60);
  });

  test('OM-2 only a Business Head edits the profile, and bad values are refused @negative', async ({ api }) => {
    const sid = await freshStore(api);
    const staff = await staffUser(api, sid);
    expect((await setProfile(api, sid, { shiftmode: 'staff' }, staff.email)).status).toBe(403);
    expect((await setProfile(api, sid, { shiftmode: 'rota' })).status).toBe(400);
    expect((await setProfile(api, sid, { operatorholdminutes: -5 })).status).toBe(400);
    expect((await setProfile(api, sid, {})).status).toBe(400);
    const ok = await setProfile(api, sid, { shiftmode: 'staff', operatorrequired: false, operatorholdminutes: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ shiftmode: 'staff', till: 'per_person', operatorrequired: false, operatorholdminutes: 0 });
  });

  test('OM-3 the shift mode cannot change while a shift is open; history is kept @negative', async ({ api }) => {
    const sid = await freshStore(api);
    const open = await openShift(api, sid, MGR);
    expect(open.status).toBeLessThan(300);
    const blocked = await setProfile(api, sid, { shiftmode: 'staff' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/open shift/i);
    // other settings are not held up by an open shift
    expect((await setProfile(api, sid, { operatorholdminutes: 15 })).status).toBe(200);
    expect((await closeShift(api, open.body.id, MGR)).status).toBeLessThan(300);
    expect((await setProfile(api, sid, { shiftmode: 'staff' })).status).toBe(200);
    const past = await api.request('GET', `/store-cash/shifts?storeid=${sid}&shiftid=${open.body.id}`);
    expect(past.body[0].status).toBe('CLOSED');
  });

  test('OM-4 staff-based: each person opens and closes their own drawer @happy', async ({ api }) => {
    const sid = await freshStore(api);
    await setProfile(api, sid, { shiftmode: 'staff', operatorrequired: false });
    const a = await staffUser(api, sid);
    const b = await staffUser(api, sid);
    const sa = await openShift(api, sid, a.email);
    const sb = await openShift(api, sid, b.email);
    expect(sa.status).toBeLessThan(300);
    expect(sb.status).toBeLessThan(300);
    expect(sa.body.assigneduserid).toBe(a.id);
    expect(sb.body.assigneduserid).toBe(b.id);
    // one drawer per person
    expect((await openShift(api, sid, a.email)).status).toBe(409);
    // "mine" shows only their own
    const mineA = (await api.request('GET', `/store-cash/shifts?storeid=${sid}&status=OPEN&mine=true`, undefined, a.email)).body;
    expect(mineA.map((s: any) => s.id)).toEqual([sa.body.id]);
    // a drawer is closed by its owner, not by a colleague; a handover is for a shared till
    expect((await closeShift(api, sa.body.id, b.email)).status).toBe(403);
    expect((await closeShift(api, sa.body.id, a.email, { closetype: 'HANDOVER', handovertoid: b.id })).status).toBe(400);
    const closed = await closeShift(api, sa.body.id, a.email);
    expect(closed.status).toBeLessThan(300);
    expect(closed.body.closedoperatorid).toBe(a.id);
    expect(closed.body.status).toBe('CLOSED');
    // b's drawer is untouched
    const stillOpen = (await api.request('GET', `/store-cash/shifts?storeid=${sid}&status=OPEN`)).body;
    expect(stillOpen.map((s: any) => s.id)).toEqual([sb.body.id]);
    await closeShift(api, sb.body.id, b.email);
  });

  test('OM-5 staff-based: a bill lands on the serving person\'s drawer, and needs one @happy', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const sid = await freshStore(api);
    await setProfile(api, sid, { shiftmode: 'staff', operatorrequired: false });
    const a = await staffUser(api, sid);
    const b = await staffUser(api, sid);
    // stock is held per store: put some of the batch into this store before selling it
    const line = POOL[POOL.length - 4];
    const post = await api.request('POST', '/stock/adjust/qty', { itemid: line.itemid, qty: 20, reasoncode: 'CORRECTION', comments: 'qa operating modes', storeid: sid, status: 'APPROVED' }, MGR);
    expect(post.status).toBeLessThan(300);
    const sa = await openShift(api, sid, a.email);
    const mk = (extra: any = {}) => ({ ...bill(), storeid: sid, ...extra });

    const ok = await api.request('POST', '/sales', mk(), a.email);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body.shiftid).toBe(sa.body.id);
    expect(ok.body.actinguserid).toBe(a.id);

    // b has no drawer open: the store has an open shift, but not theirs
    const none = await api.request('POST', '/sales', mk(), b.email);
    expect(none.status).toBe(400);
    expect(none.body.message).toMatch(/your own shift/i);

    // billing "as" a colleague is not an option where nobody is asked who is serving
    const sb = await openShift(api, sid, b.email);
    const asOther = await api.request('POST', '/sales', mk({ actinguserid: a.id }), b.email);
    expect(asOther.status).toBeLessThan(300);
    expect(asOther.body.actinguserid).toBe(b.id);
    expect(asOther.body.shiftid).toBe(sb.body.id);

    const sum = await api.request('GET', `/store-cash/shifts/${sa.body.id}/summary`, undefined, a.email);
    expect(sum.body.bills).toBe(1);
    await closeShift(api, sa.body.id, a.email, { counteddenominations: denoms(1000 + 40) });
    await closeShift(api, sb.body.id, b.email, { counteddenominations: denoms(1000 + 40) });
  });

  test('OM-6 time-based: one shared till; the business head answers for a difference when the store has no head @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const a = await staffUser(api, sid);
    const first = await openShift(api, sid, a.email);
    expect(first.status).toBeLessThan(300);
    expect((await openShift(api, sid, MGR)).status).toBe(409);
    const closed = await closeShift(api, first.body.id, a.email, { counteddenominations: denoms(900) });
    expect(closed.status).toBeLessThan(300);
    const bh = (await api.request('GET', '/auth/me', undefined, MGR)).body.id;
    expect(closed.body.accountableuserid).toBe(bh);
    expect(closed.body.variance).toBe(-100);
    const report = await api.request('GET', `/store-cash/shifts/${first.body.id}/report`);
    expect(report.body.accountable).toBeTruthy();
  });

  test('OM-7 a store head, when the store has one, answers for the difference @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const roles = (await api.request('GET', '/roles')).body as any[];
    const head = roles.find((r) => r.name === 'Store Head');
    test.skip(!head, 'no Store Head role');
    const sh = await staffUser(api, sid, head.id);
    const a = await staffUser(api, sid);
    const s = await openShift(api, sid, a.email);
    const closed = await closeShift(api, s.body.id, a.email);
    expect(closed.body.accountableuserid).toBe(sh.id);
    // the profile can insist on the business head instead
    const s2 = await openShift(api, sid, a.email);
    await setProfile(api, sid, { accountablerole: 'business_head' });
    const closed2 = await closeShift(api, s2.body.id, a.email);
    expect(closed2.body.accountableuserid).not.toBe(sh.id);
  });
});

test.describe('Operating modes: screens @p1', () => {
  test('OM-8 Settings > Store > Till & shifts saves the profile; an open shift blocks a mode change with the reason @happy', async ({ api, app }) => {
    const sid = await freshStore(api);
    const { page } = await app.open(MGR, '/secure/settings/store');
    const where = (await api.request('GET', `/store-cash/profile?storeid=${sid}`)).body.location;
    await page.getByTestId('store-s-select').selectOption({ label: (await page.locator('[data-testid=store-s-select] option', { hasText: where }).first().textContent())!.trim() });
    await page.getByTestId('store-s-tab-profile').click();
    await expect(page.getByTestId('store-profile-panel')).toContainText('how the till runs');
    await page.getByTestId('store-profile-mode-staff').check();
    await page.getByTestId('store-profile-operator').uncheck();
    await page.getByTestId('store-profile-save').click();
    await expect(page.getByTestId('store-profile-message')).toHaveText('Saved.');
    const p = (await api.request('GET', `/store-cash/profile?storeid=${sid}`)).body;
    expect(p).toMatchObject({ shiftmode: 'staff', operatorrequired: false });

    const open = await openShift(api, sid, MGR);
    expect(open.status).toBeLessThan(300);
    await page.getByTestId('store-profile-mode-time').check();
    await page.getByTestId('store-profile-save').click();
    await expect(page.getByTestId('store-profile-error')).toContainText('open shift');
    await closeShift(api, open.body.id, MGR);
  });

  test('OM-9 staff-based: the shift page speaks of your own shift and offers no handover @happy', async ({ api, app }) => {
    const sid = await freshStore(api);
    await setProfile(api, sid, { shiftmode: 'staff', operatorrequired: false });
    const me = await staffUser(api, sid);
    const { page } = await app.open(me.email, '/secure/shift', { storeId: sid });
    await expect(page.getByTestId('shiftdesk-none')).toContainText('You have no open shift');
    await page.getByTestId('shift-card-open').click();
    await expect(page.getByTestId('shiftdesk-open-form')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();
    const s = await openShift(api, sid, me.email);
    await page.reload();
    await expect(page.getByTestId('shiftdesk-accountable')).toContainText('answered for by');
    await page.getByTestId('shift-card-close').click();
    await expect(page.getByTestId('shiftdesk-close-form')).toBeVisible();
    await expect(page.getByTestId('shiftdesk-type-handover')).toHaveCount(0);
    await closeShift(api, s.body.id, me.email);
  });
});

// ------------------------------------------------------------------ step 2: approval mode
const THRESHOLD_KEY = 'purchase_order_approval_value_threshold';
async function setThreshold(api: any, value: number) {
  const s = (await api.request('GET', `/settings?key=${THRESHOLD_KEY}`, undefined, MGR)).body[0];
  await api.request('PUT', `/settings/${s.id}`, { value: String(value) }, MGR);
}
async function draftPO(api: any) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 60 }, MGR)).body;
  const prod = rows.find((x: any) => x.status === 'VERIFIED').id;
  const po = await api.request('POST', '/purchaseorders', { vendorid: v, comments: 'qa operating modes' }, MGR);
  const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 200, vendorid: v }, MGR);
  await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  return po.body.id as number;
}
async function ownBatch(api: any, tag: string, qty = 50, mrpcost = 1000) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-OM-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA-OM-PROD-${tag}`, taxpcnt: 12, category: 'Analgesic', code: `OM${tag}`, pack: 1 }, MGR);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: mrpcost * 0.7, ptrcost: mrpcost * 0.7,
    mrpcost, saleprice: mrpcost, taxpcnt: 12, total: +(qty * mrpcost).toFixed(2), batch: `OM-${tag}`, expdate: '2028-06-30',
  }, MGR);
  return { itemid: it.body.id as number, batch: `OM-${tag}` };
}

test.describe('Operating modes: approval mode @p1', () => {
  test.afterEach(async ({ api }) => {
    await api.request('PUT', '/businesses/mine', { approvalmode: 'separate' }, MGR);
    await setThreshold(api, 5000);
  });

  test('OM-10 the business head sets the approval mode; a store may override it @happy', async ({ api }) => {
    const biz = await api.request('GET', '/businesses/mine', undefined, MGR);
    expect(biz.body.approvalmode).toBe('separate');
    expect((await api.request('PUT', '/businesses/mine', { approvalmode: 'whenever' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/businesses/mine', { approvalmode: 'self' }, MGR)).body.approvalmode).toBe('self');

    const sid = await freshStore(api);
    let p = (await api.request('GET', `/store-cash/profile?storeid=${sid}`)).body;
    expect(p).toMatchObject({ approvalmodesetting: null, approvalmode: 'self' });          // follows the business
    p = (await setProfile(api, sid, { approvalmode: 'separate' })).body;
    expect(p).toMatchObject({ approvalmodesetting: 'separate', approvalmode: 'separate' });
    p = (await setProfile(api, sid, { approvalmode: null })).body;
    expect(p).toMatchObject({ approvalmodesetting: null, approvalmode: 'self' });
    expect((await setProfile(api, sid, { approvalmode: 'maybe' })).status).toBe(400);
  });

  test('OM-11 a purchase order above the approval value waits for approval, unless the maker may approve their own @happy', async ({ api }) => {
    await setThreshold(api, 1);
    const held = await draftPO(api);
    await api.request('POST', `/purchaseorders/${held}/submit`, undefined, MGR);
    expect((await api.request('GET', `/purchaseorders/${held}`, undefined, MGR)).body.status).toBe('PENDING_APPROVAL');

    await api.request('PUT', '/businesses/mine', { approvalmode: 'self' }, MGR);
    const own = await draftPO(api);
    await api.request('POST', `/purchaseorders/${own}/submit`, undefined, MGR);
    const po = (await api.request('GET', `/purchaseorders/${own}`, undefined, MGR)).body;
    expect(po.status).toBe('SUBMITTED');
    expect(po.approvalstatus).toBe('Approved');
    expect(po.approvalreason).toMatch(/Self-approved/);
    // someone without the right to approve purchase orders is not promoted by the mode
    const sales = 'sales1@local.test';
    const draft = await draftPO(api);
    const sub = await api.request('POST', `/purchaseorders/${draft}/submit`, undefined, sales);
    if (sub.status < 300) expect((await api.request('GET', `/purchaseorders/${draft}`, undefined, MGR)).body.status).toBe('PENDING_APPROVAL');
  });

  test('OM-12 a high-value stock adjustment is held for approval, unless the store lets the maker approve @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const b = await ownBatch(api, `${Date.now()}`);
    const adjust = (storeid: number) => api.request('POST', '/stock/adjust/qty', { itemid: b.itemid, qty: -5, reasoncode: 'SHRINKAGE', comments: 'qa om', storeid }, MGR);

    const held = await adjust(sid);                       // 5 x 1000 is above the 2000 default
    expect(held.body.status).toBe('PENDING');

    await setProfile(api, sid, { approvalmode: 'self' });
    const own = await adjust(sid);
    expect(own.status).toBeLessThan(300);
    expect(own.body.status).toBe('APPROVED');

    await setProfile(api, sid, { approvalmode: null });  // follows the business, which is 'separate'
    expect((await adjust(sid)).body.status).toBe('PENDING');
  });

  test('OM-13 Business details shows the approval mode and saves it @happy', async ({ app, api }) => {
    const { page } = await app.open(MGR, '/secure/settings/business-profile');
    await page.getByTestId('biz-approval-mode').selectOption('self');
    await page.getByTestId('biz-save').click();
    await expect(page.getByTestId('biz-message')).toBeVisible();
    expect((await api.request('GET', '/businesses/mine', undefined, MGR)).body.approvalmode).toBe('self');
  });
});

// ------------------------------------------------------------------ step 3: modules on / off
const SALES = 'sales1@local.test';
const modulesOf = async (api: any) => (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
const setModules = (api: any, body: any, as = MGR) => api.request('PUT', '/businesses/mine/modules', body, as);
const ALL_ON = { hr: true, purchasing: 'full', gst: true, expenses: true, payment_recon: true, stock_audits: true, transfers: true };
const resources = async (api: any, as = MGR) => ((await api.request('GET', '/auth/me', undefined, as)).body.permissions as any[]).map((p) => p.resource);

test.describe('Operating modes: modules @p1', () => {
  test.afterEach(async ({ api }) => { await setModules(api, ALL_ON); });

  test('OM-14 every module is on by default; only the business head changes them, and bad input is refused @happy', async ({ api }) => {
    expect(await modulesOf(api)).toEqual(ALL_ON);
    expect((await setModules(api, { hr: false }, SALES)).status).toBe(403);
    expect((await setModules(api, { rockets: true })).status).toBe(400);
    expect((await setModules(api, { hr: 'maybe' })).status).toBe(400);
    expect((await setModules(api, { purchasing: 'some' })).status).toBe(400);
    expect((await setModules(api, {})).status).toBe(400);
    const r = await setModules(api, { hr: false });
    expect(r.status).toBe(200);
    expect(r.body.hr).toBe(false);
    const audit = await api.request('GET', '/audit?action=business.modules_updated&limit=1', undefined, MGR);
    expect(audit.body.rows[0].summary).toMatch(/HR and attendance/);
  });

  test('OM-15 a switched-off module disappears from the permissions and its endpoints answer 403; switching back restores it @happy', async ({ api }) => {
    expect(await resources(api)).toEqual(expect.arrayContaining(['expenses', 'hr', 'paymentrecon', 'stockaudit']));
    expect((await api.request('GET', '/expenses', undefined, MGR)).status).toBe(200);

    await setModules(api, { expenses: false, hr: false, payment_recon: false, stock_audits: false, transfers: false });
    const res = await resources(api);
    for (const gone of ['expenses', 'hr', 'myhr', 'leaveapprove', 'kpirate', 'mykpi', 'paymentrecon', 'stockaudit']) expect(res).not.toContain(gone);
    const me = (await api.request('GET', '/auth/me', undefined, MGR)).body;
    expect(me.modules).toMatchObject({ expenses: false, hr: false, transfers: false });
    const store = me.permissions.find((p: any) => p.resource === 'store');
    expect(store.path).not.toContain('/secure/store/transfers');
    expect(store.path).toContain('/secure/store/cash');

    for (const [path, what] of [['/expenses', 'Expenses'], ['/hr/staff', 'HR and attendance'], ['/payment-recon', 'Digital payment'], ['/stock-audits', 'Stock audits'], ['/store-stock-transfers', 'Stock transfers']]) {
      const r = await api.request('GET', path, undefined, MGR);
      expect(r.status, path).toBe(403);
      expect(r.body.message).toContain(what);
    }
    // what is not a module keeps working
    expect((await api.request('GET', '/store-cash/profile?storeid=1', undefined, MGR)).status).toBe(200);

    await setModules(api, ALL_ON);
    expect(await resources(api)).toEqual(expect.arrayContaining(['expenses', 'hr', 'paymentrecon', 'stockaudit']));
    expect((await api.request('GET', '/expenses', undefined, MGR)).status).toBe(200);
  });

  test('OM-16 purchasing is off, simple or full; GST reconciliation needs it @happy', async ({ api }) => {
    expect((await api.request('GET', '/purchaseorders', undefined, MGR)).status).toBe(200);

    await setModules(api, { purchasing: 'simple' });
    expect((await api.request('GET', '/purchaseorders', undefined, MGR)).status).toBe(403);
    expect((await api.request('GET', '/purchaserequests', undefined, MGR)).status).toBe(403);
    expect((await api.request('GET', '/purchases', undefined, MGR)).status).toBeLessThan(300);
    const res = await resources(api);
    expect(res).toContain('purchases');
    expect(res).not.toContain('purchaseorders');
    const salesPurchases = ((await api.request('GET', '/auth/me', undefined, SALES)).body.permissions as any[]).find((p) => p.resource === 'purchases');
    expect((salesPurchases?.policies || []).map((x: any) => x.action)).not.toContain('request');

    await setModules(api, { purchasing: 'off' });
    expect((await api.request('GET', '/purchases', undefined, MGR)).status).toBe(403);
    expect((await api.request('GET', '/vendor-issues', undefined, MGR)).status).toBe(403);
    expect(await resources(api)).not.toContain('purchases');
    expect((await modulesOf(api)).gst).toBe(false);                        // GST reconciliation cannot outlive purchasing
    expect((await setModules(api, { gst: true })).status).toBe(400);

    await setModules(api, { purchasing: 'full' });
    expect((await modulesOf(api)).gst).toBe(true);                         // the earlier choice returns with purchasing
    expect((await api.request('GET', '/purchaseorders', undefined, MGR)).status).toBe(200);
  });

  test('OM-17 Business details switches modules and the menu follows @happy', async ({ app, api }) => {
    const { page } = await app.open(MGR, '/secure/settings/business-profile');
    await expect(page.getByTestId('biz-modules')).toBeVisible();
    await page.getByTestId('biz-mod-expenses').uncheck();
    await expect(page.getByTestId('biz-modules-message')).toBeVisible();
    expect((await modulesOf(api)).expenses).toBe(false);

    // a fresh sign-in picks up the narrowed permissions (the harness primes storage on every load, so open a new page)
    const after = (await app.open(MGR, '/secure/dashboard')).page;
    await expect(after.getByTestId('nav-dashboard')).toBeVisible();
    await expect(after.getByTestId('nav-expenses')).toHaveCount(0);
    await expect(after.getByTestId('nav-hr')).toBeVisible();

    await page.getByTestId('biz-mod-expenses').check();
    await expect(page.getByTestId('biz-modules-message')).toBeVisible();
    const back = (await app.open(MGR, '/secure/dashboard')).page;
    await expect(back.getByTestId('nav-expenses')).toBeVisible();
  });

  test('OM-18 simple purchasing hides the Orders tab; switching GST off hides its tab @happy', async ({ app, api }) => {
    await setModules(api, { purchasing: 'simple' });
    const { page } = await app.open(MGR, '/secure/purchases/invoices');
    await expect(page.getByTestId('nav-vendors')).toBeVisible();
    await expect(page.getByTestId('nav-gst')).toHaveCount(1);              // GST stays: it is its own switch
    await expect(page.locator('app-purchase-header').getByText('Orders', { exact: true })).toHaveCount(0);
    await setModules(api, { gst: false });
    const noGst = (await app.open(MGR, '/secure/purchases/invoices')).page;
    await expect(noGst.getByTestId('nav-vendors')).toBeVisible();
    await expect(noGst.getByTestId('nav-gst')).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ step 4: account kinds
const SITE = 'siteadmin@local.test';
const roleId = async (api: any, name: string) => ((await api.request('GET', '/roles', undefined, MGR)).body as any[]).find((r) => r.name === name)?.id as number;
async function userOf(api: any, storeId: number, roleName: string, as = MGR) {
  const email = `qa.ak.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
  const r = await api.request('POST', '/users', {
    fullname: `QA ${roleName}`, email, password: PASS, phone: '9' + String(Date.now()).slice(-9),
    location: 'QA', roleid: await roleId(api, roleName), storeids: [storeId],
  }, as);
  return { email, id: r.body?.id as number, status: r.status, body: r.body };
}
const permsOf = async (api: any, email: string) => ((await api.request('GET', '/auth/me', undefined, email)).body.permissions as any[]);

test.describe('Operating modes: account kinds @p1', () => {
  test('OM-19 the three account kinds exist with the rights the plan gives them @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const counter = await userOf(api, sid, 'Counter');
    const personal = await userOf(api, sid, 'Personal');
    expect(counter.status).toBeLessThan(300);
    expect(personal.status).toBeLessThan(300);

    const c = (await permsOf(api, counter.email)).map((p) => p.resource);
    expect(c).toEqual(expect.arrayContaining(['sales', 'shiftdesk', 'customers']));
    for (const no of ['purchases', 'expenses', 'hr', 'users', 'roles', 'myhr']) expect(c).not.toContain(no);

    const p = await permsOf(api, personal.email);
    expect(p.map((x) => x.resource).sort()).toEqual(['myhr', 'mykpi', 'site']);
    expect(p.find((x) => x.resource === 'site').path).toEqual(['/secure/profile']);

    const o = ((await api.request('GET', '/roles', undefined, MGR)).body as any[]).find((r) => r.name === 'Owner-operator');
    const res = (o.permissions as any[]).map((x) => x.resource);
    expect(res).toEqual(expect.arrayContaining(['sales', 'purchases', 'purchaseorders', 'store', 'expenses', 'businessprofile', 'storesettings']));
    for (const no of ['users', 'roles', 'hr', 'audit', 'staffcredit']) expect(res).not.toContain(no);
  });

  test('OM-20 who may create which account; an owner-operator runs the business but not its users @permission', async ({ api }) => {
    const sid = await freshStore(api);
    // a Business Head makes counter / personal / sales / store-head logins, not owners
    expect((await userOf(api, sid, 'Counter')).status).toBeLessThan(300);
    expect((await userOf(api, sid, 'Personal')).status).toBeLessThan(300);
    expect((await userOf(api, sid, 'Owner-operator')).status).toBe(403);
    expect((await userOf(api, sid, 'Business Head')).status).toBe(403);

    // the platform makes the owner-operator, in a business
    const email = `qa.owner.${Date.now()}@local.test`;
    const made = await api.request('POST', '/users', {
      fullname: 'QA Owner', email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA',
      roleid: await roleId(api, 'Owner-operator'), businessid: 1,
    }, SITE);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);

    // what an owner-operator runs: the business details, modules, a store's till rules, expenses (approved on the spot), shifts anywhere
    expect((await api.request('GET', '/businesses/mine', undefined, email)).status).toBe(200);
    expect((await api.request('GET', '/businesses/mine/modules', undefined, email)).status).toBe(200);
    expect((await setProfile(api, sid, { operatorholdminutes: 30 }, email)).status).toBe(200);
    const cat = (await api.request('GET', '/expenses/categories', undefined, email)).body[0].id;
    const exp = await api.request('POST', '/expenses', { expense_date: new Date().toISOString().slice(0, 10), store_id: null, category_id: cat, amount: 700, gst_amount: 0, pay_mode: 'CASH', description: 'QA owner' }, email);
    expect(exp.status).toBeLessThan(300);
    expect(exp.body.status).toBe('APPROVED');
    const shift = await openShift(api, sid, email);
    expect(shift.status).toBeLessThan(300);
    expect((await closeShift(api, shift.body.id, email)).status).toBeLessThan(300);

    // ... and what it does not: users, roles, HR
    expect((await api.request('POST', '/users', { fullname: 'x', email: `x${Date.now()}@x.com`, password: PASS, roleid: await roleId(api, 'Counter') }, email)).status).toBe(403);
    expect((await api.request('GET', '/hr/staff', undefined, email)).status).toBe(403);
    expect((await permsOf(api, email)).map((x) => x.resource)).not.toContain('users');
  });

  test('OM-21 a counter login must name who is serving; that person gets the bill, the counter is only the till @happy', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const sid = await freshStore(api);
    await api.request('POST', '/stock/adjust/qty', { itemid: POOL[POOL.length - 4].itemid, qty: 20, reasoncode: 'CORRECTION', comments: 'qa account kinds', storeid: sid, status: 'APPROVED' }, MGR);
    const counter = await userOf(api, sid, 'Counter');
    const person = await userOf(api, sid, 'Sales Staff');
    const stranger = await userOf(api, await freshStore(api), 'Sales Staff');
    const open = await openShift(api, sid, counter.email);
    expect(open.status).toBeLessThan(300);

    // the picker lists people, not the till
    const picker = (await api.request('GET', `/store-cash/users?storeid=${sid}`, undefined, counter.email)).body as any[];
    expect(picker.map((u) => u.id)).toContain(person.id);
    expect(picker.map((u) => u.id)).not.toContain(counter.id);

    const mk = (extra: any = {}) => ({ ...bill(), storeid: sid, ...extra });
    const none = await api.request('POST', '/sales', mk(), counter.email);
    expect(none.status).toBe(400);
    expect(none.body.message).toMatch(/who is serving/i);
    expect((await api.request('POST', '/sales', mk({ actinguserid: counter.id }), counter.email)).status).toBe(400);
    const wrong = await api.request('POST', '/sales', mk({ actinguserid: stranger.id }), counter.email);
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/does not work at this store/i);

    const ok = await api.request('POST', '/sales', mk({ actinguserid: person.id }), counter.email);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body.actinguserid).toBe(person.id);
    expect(ok.body.createdby).toBe(counter.id);
    expect(ok.body.shiftid).toBe(open.body.id);

    // a store that does not ask for an operator lets the counter bill without one
    await closeShift(api, open.body.id, counter.email, { counteddenominations: denoms(1000 + 40) });
    await setProfile(api, sid, { operatorrequired: false });
    const again = await openShift(api, sid, counter.email);
    const relaxed = await api.request('POST', '/sales', mk(), counter.email);
    expect(relaxed.status, JSON.stringify(relaxed.body)).toBeLessThan(300);
    await closeShift(api, again.body.id, counter.email, { counteddenominations: denoms(1000 + 40) });
  });

  test('OM-22 one person, several logins: their HR record follows whichever login they use @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const personal = await userOf(api, sid, 'Personal');
    const sales = await userOf(api, sid, 'Sales Staff');
    const other = await userOf(api, sid, 'Sales Staff');
    const emp = await api.request('POST', '/hr/staff', { user_id: personal.id, join_date: '2024-01-01', designation: 'Assistant', store_id: sid }, MGR);
    expect(emp.status, JSON.stringify(emp.body)).toBeLessThan(300);
    const id = emp.body.id as number;

    const before = (await api.request('GET', `/hr/staff/${id}/accounts`, undefined, MGR)).body;
    expect(before.linked).toEqual([]);
    expect(before.candidates.map((c: any) => c.id)).toEqual(expect.arrayContaining([sales.id, other.id]));
    expect(before.candidates.map((c: any) => c.id)).not.toContain(personal.id);
    expect((await api.request('GET', '/my-hr/summary', undefined, sales.email)).body.staff).toBe(false);

    const put = (ids: any) => api.request('PUT', `/hr/staff/${id}/accounts`, { userids: ids }, MGR);
    expect((await put('nope')).status).toBe(400);
    expect((await put([personal.id])).status).toBe(400);                  // their own login is not an extra
    const linked = await put([sales.id]);
    expect(linked.status, JSON.stringify(linked.body)).toBeLessThan(300);
    expect(linked.body.linked.map((l: any) => l.id)).toEqual([sales.id]);
    expect((await api.request('GET', '/my-hr/summary', undefined, sales.email)).body.staff).toBe(true);

    // a login belongs to one person only
    const emp2 = await api.request('POST', '/hr/staff', { full_name: 'QA Other Person', phone: '9876500099', join_date: '2024-01-01' }, MGR);
    expect((await api.request('PUT', `/hr/staff/${emp2.body.id}/accounts`, { userids: [sales.id] }, MGR)).status).toBe(400);
    // and one that has a staff record of its own cannot be tied to somebody else
    expect((await put([personal.id, other.id])).status).toBe(400);

    // their ratings count the bills they made on either login
    const metric = await api.request('POST', '/hr/kpi/metrics', { name: `QA sales ${Date.now()}`, max_points: 10, source: 'SYSTEM', system_key: 'SALES_VALUE', rule: { kind: 'linear', target: 100000, floor: 0 } }, MGR);
    expect(metric.status, JSON.stringify(metric.body)).toBeLessThan(300);
    try {
      const rows = (await api.request('GET', `/kpi/rate?period=${new Date().toISOString().slice(0, 7)}`, undefined, MGR)).body as any[];
      expect(rows.some((r) => r.employee_id === id)).toBe(true);
    } finally {
      await api.request('PUT', `/hr/kpi/metrics/${metric.body.id}`, { name: 'QA retired', max_points: 10, source: 'MANUAL', active: false }, MGR);
    }

    expect((await put([])).body.linked).toEqual([]);
    expect((await api.request('GET', '/my-hr/summary', undefined, sales.email)).body.staff).toBe(false);
  });
});

// ------------------------------------------------------------------ step 5: setup wizard and presets
// A business of its own (Harbour Health), so switching presets never disturbs the stores the other specs use.
const OWNER3 = 'bh.harbourh@qa.local';
const stores3 = () => data.storesOf(3).map((s) => s.id);
const presetGet = async (api: any) => (await api.request('GET', '/businesses/mine/presets', undefined, OWNER3)).body;
const preview = (api: any, body: any) => api.request('POST', '/businesses/mine/preset/preview', body, OWNER3);
const applyPreset = (api: any, body: any) => api.request('PUT', '/businesses/mine/preset', body, OWNER3);
const profileOf = async (api: any, id: number) => (await api.request('GET', `/store-cash/profile?storeid=${id}`, undefined, OWNER3)).body;
const modules3 = async (api: any) => (await api.request('GET', '/businesses/mine/modules', undefined, OWNER3)).body;

test.describe('Operating modes: setup wizard @p1', () => {
  test.beforeEach(async ({ api }) => {
    for (const id of stores3()) {
      const open = (await api.request('GET', `/store-cash/shifts?storeid=${id}&status=OPEN`, undefined, OWNER3)).body || [];
      for (const s of open) await closeShift(api, s.id, OWNER3, { counteddenominations: denoms(Math.max(1, Number(s.expectedcash || 1))) });
    }
  });
  test.afterEach(async ({ api }) => {                                    // put the business back as the seed made it
    for (const id of stores3()) await api.request('PUT', `/stores/${id}/profile`, { shiftmode: 'time', operatorrequired: true, approvalmode: null }, OWNER3);
    await api.request('PUT', '/businesses/mine', { approvalmode: 'separate' }, OWNER3);
    await api.request('PUT', '/businesses/mine/modules', ALL_ON, OWNER3);
  });

  test('OM-23 the presets, the current choice and each store are offered to the owner only @happy', async ({ api }) => {
    const r = await presetGet(api);
    expect(r.presets.map((p: any) => p.key)).toEqual(['solo', 'owner_and_staff', 'manager_and_staff', 'multi_store']);
    expect(r.presets.find((p: any) => p.key === 'solo')).toMatchObject({ label: 'Just me', approvalmode: 'self' });
    expect(r.stores.length).toBeGreaterThan(0);
    for (const s of r.stores) expect(stores3()).toContain(s.id);
    expect((await api.request('GET', '/businesses/mine/presets', undefined, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/businesses/mine/preset', { preset: 'solo' }, SALES)).status).toBe(403);
  });

  test('OM-24 a preview says what would change and changes nothing; a bad preset is refused @happy', async ({ api }) => {
    expect((await preview(api, { preset: 'bogus' })).status).toBe(400);
    expect((await preview(api, { preset: 'solo', shiftmode: 'sometimes' })).status).toBe(400);
    const p = await preview(api, { preset: 'solo' });
    expect(p.status).toBe(201);
    expect(p.body.approvalmode).toBe('self');
    expect(p.body.modules).toEqual({ hr: false, transfers: false, stock_audits: false });
    expect(p.body.stores).toHaveLength(stores3().length);
    expect(p.body.stores.every((s: any) => s.shiftmode === 'staff' && s.operatorrequired === false)).toBe(true);
    expect(p.body.changes.join(' ')).toMatch(/approve your own/);
    expect(p.body.info.label).toBe('Just me');
    // nothing was written
    expect((await profileOf(api, stores3()[0])).shiftmode).toBe('time');
    expect(await modules3(api)).toEqual(ALL_ON);
  });

  test('OM-25 several stores: a till mode per store, approvals separate, nothing hidden @happy', async ({ api }) => {
    const [a, b, c] = stores3();
    const r = await applyPreset(api, { preset: 'multi_store', stores: { [a]: { shiftmode: 'staff' }, [b]: { shiftmode: 'time' }, [c]: { shiftmode: 'time' } } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.current).toBe('multi_store');
    expect(await profileOf(api, a)).toMatchObject({ shiftmode: 'staff', operatorrequired: false });
    expect(await profileOf(api, b)).toMatchObject({ shiftmode: 'time', operatorrequired: true });
    expect(await modules3(api)).toEqual(ALL_ON);
    const biz = (await api.request('GET', '/businesses/mine', undefined, OWNER3)).body;
    expect(biz).toMatchObject({ staffingpreset: 'multi_store', approvalmode: 'separate' });
    const audit = await api.request('GET', '/audit?action=business.preset_applied&limit=1', undefined, OWNER3);
    expect(audit.body.rows[0].summary).toMatch(/multi_store/);
  });

  test('OM-26 switching later rewrites defaults only: solo, then manager and staff; people and history stay @happy', async ({ api }) => {
    const people = async () => ((await api.request('GET', '/users', undefined, OWNER3)).body as any[]).length;
    const before = await people();

    const solo = await applyPreset(api, { preset: 'solo' });
    expect(solo.status, JSON.stringify(solo.body)).toBe(200);
    expect((await api.request('GET', '/businesses/mine', undefined, OWNER3)).body).toMatchObject({ staffingpreset: 'solo', approvalmode: 'self' });
    expect(await modules3(api)).toMatchObject({ hr: false, transfers: false, stock_audits: false, expenses: true, purchasing: 'full' });
    for (const id of stores3()) expect(await profileOf(api, id)).toMatchObject({ shiftmode: 'staff', operatorrequired: false });
    expect(((await api.request('GET', '/auth/me', undefined, OWNER3)).body.permissions as any[]).map((p) => p.resource)).not.toContain('hr');

    const mgr = await applyPreset(api, { preset: 'manager_and_staff', shiftmode: 'time' });
    expect(mgr.status, JSON.stringify(mgr.body)).toBe(200);
    expect((await api.request('GET', '/businesses/mine', undefined, OWNER3)).body).toMatchObject({ staffingpreset: 'manager_and_staff', approvalmode: 'separate' });
    expect(await modules3(api)).toMatchObject({ hr: true, transfers: true, stock_audits: true });     // three stores: transfers stay
    for (const id of stores3()) expect(await profileOf(api, id)).toMatchObject({ shiftmode: 'time', operatorrequired: true });
    expect(await people()).toBe(before);
  });

  test('OM-27 a store with a shift open holds the whole switch until it is closed @negative', async ({ api }) => {
    const [a] = stores3();
    const open = await openShift(api, a, OWNER3);
    expect(open.status).toBeLessThan(300);
    const blocked = await applyPreset(api, { preset: 'solo' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/open shift/);
    // nothing was half applied
    expect((await api.request('GET', '/businesses/mine', undefined, OWNER3)).body.approvalmode).toBe('separate');
    expect(await modules3(api)).toEqual(ALL_ON);
    expect((await profileOf(api, stores3()[1])).shiftmode).toBe('time');
    // a preview names the store so the wizard can say what to close
    expect((await preview(api, { preset: 'solo' })).body.blockers[0]).toMatch(/open shift/);
    // a store that keeps its mode is not held up
    expect((await applyPreset(api, { preset: 'owner_and_staff', shiftmode: 'time' })).status).toBe(200);

    await closeShift(api, open.body.id, OWNER3);
    expect((await applyPreset(api, { preset: 'solo' })).status).toBe(200);
  });

  test('OM-28 logins listed with the preset are created, each reported on its own @happy', async ({ api }) => {
    const [a] = stores3();
    const tag = Date.now();
    const r = await applyPreset(api, {
      preset: 'owner_and_staff', shiftmode: 'time',
      accounts: [
        { role: 'Counter', fullname: 'QA Till', email: `till.${tag}@qa.local`, password: PASS, storeids: [a] },
        { role: 'Sales Staff', fullname: 'QA Seller', email: `seller.${tag}@qa.local`, password: PASS, storeids: [a] },
        { role: 'Owner-operator', fullname: 'QA Nope', email: `nope.${tag}@qa.local`, password: PASS, storeids: [a] },
        { role: 'Counter', fullname: 'QA Till', email: `till.${tag}@qa.local`, password: PASS, storeids: [a] },
        { role: 'Counter', fullname: '', email: '', password: '' },
      ],
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.accounts.map((x: any) => x.ok)).toEqual([true, true, false, false, false]);
    expect(r.body.accounts[2].error).toMatch(/can only create/i);
    const me = await api.request('GET', '/auth/me', undefined, `till.${tag}@qa.local`);
    expect(me.body.rolename).toBe('Counter');
  });

  test('OM-29 the wizard page: choose, see the change, apply; the business details page links to it @happy', async ({ app, api }) => {
    const { page } = await app.open(OWNER3, '/secure/settings/business-profile');
    await page.getByTestId('biz-open-setup').click();
    await expect(page.getByTestId('shop-setup')).toBeVisible();
    await page.getByTestId('preset-solo').click();
    await expect(page.getByTestId('setup-plan')).toContainText('approve your own');
    await expect(page.getByTestId('setup-plan')).toContainText('HR and attendance switched off');
    await page.getByTestId('setup-apply').click();
    await expect(page.getByTestId('setup-done')).toContainText('Just me');
    await expect(page.getByTestId('preset-current')).toHaveCount(1);
    expect((await profileOf(api, stores3()[0])).shiftmode).toBe('staff');

    // switching back: a shift-mode choice appears, and applying it again says nothing changes
    await page.getByTestId('preset-owner_and_staff').click();
    await page.getByTestId('setup-mode-time').check();
    await expect(page.getByTestId('setup-plan')).toContainText('one shared till');
    await page.getByTestId('setup-apply').click();
    await expect(page.getByTestId('setup-done')).toContainText('Owner and staff');
    expect((await profileOf(api, stores3()[0])).shiftmode).toBe('time');
    await page.getByTestId('preset-owner_and_staff').click();
    await expect(page.getByTestId('setup-nochange')).toBeVisible();
  });
});
