/**
 * Store Cash & Shifts — CASH-1..16
 * Source: docs/testing/manual-test-plan.html  (module "cash")
 *
 * Store context: the API pins shift/ledger reads to ?storeid=; specs drive the
 * header switcher (localStorage selected_store_id) via app.open({storeId}).
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';
const STORE1 = 1;
// a second store in business 1 (its own open shift is closed before each use)
function store2() {
  const s = data.storesOf(1).find((x) => x.id !== 1);
  if (!s) throw new Error('need a 2nd store in business 1');
  return s.id;
}
async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', {
    location: `Cash ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true,
  }, MGR);
  return s.body.id;
}
function denoms(amount: number) {
  let left = Math.max(0, Math.round(amount));
  const rows: { d: number; n: number }[] = [];
  for (const d of [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]) {
    const n = Math.floor(left / d);
    if (n > 0) { rows.push({ d, n }); left -= n * d; }
  }
  return rows;
}
async function closeOpenShifts(api: any, storeId: number) {
  const open = (await api.request('GET', `/store-cash/shifts?storeid=${storeId}&status=OPEN`)).body || [];
  for (const s of open) {
    const amt = Number(s.expectedcash ?? s.openingcash ?? 0);
    await api.request('PUT', `/store-cash/shifts/${s.id}/close`, { counteddenominations: denoms(amt), allowZero: true });
  }
}
// only one open shift per store is allowed (issue #142), so close any prior one first
async function openShift(api: any, storeId: number, body: Record<string, any> = {}) {
  await closeOpenShifts(api, storeId);
  return api.request('POST', '/store-cash/shifts', {
    storeid: storeId, openingcash: 0, name: 'qa', starttime: '09:00', endtime: '17:00', ...body,
  });
}

test.describe('Store Cash & Shifts @p0', () => {
  test('SHIFTS-NAV the Shifts screen is reachable (issue #133) @permission', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/store/shifts', { storeId: STORE1 });
    await expectShell(page);
    await expect(page).toHaveURL(/\/secure\/store\/shifts/);
    await expect(page.getByRole('heading', { name: 'Shifts' })).toBeVisible();
  });

  test('CASH-1 a created shift template is available when opening a shift @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const name = `QA Tpl ${Date.now()}`;
    const c = await api.request('POST', '/store-cash/templates', {
      storeid: sid, name, starttime: '08:00', endtime: '16:00', depositthreshold: 5000, active: true,
    });
    expect([200, 201]).toContain(c.status);
    const list = await api.request('GET', `/store-cash/templates?storeid=${sid}`);
    expect(list.body.some((t: any) => t.name === name)).toBeTruthy();
    const open = await api.request('POST', '/store-cash/shifts', { storeid: sid, templateid: c.body.id, openingcash: 0, allowZero: true });
    expect([200, 201]).toContain(open.status);
    expect(open.body.name).toBe(name);
    await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, { counteddenominations: [], allowZero: true });
  });

  test('CASH-2 opening a shift starts it OPEN with expected cash = the opening float @happy', async ({ api }) => {
    const float = 1234;
    const s = await openShift(api, store2(), { openingcash: float, name: 'cash2' });
    expect([200, 201]).toContain(s.status);
    expect(s.body.status).toBe('OPEN');
    expect(Number(s.body.expectedcash)).toBe(float);
  });

  test('CASH-3 opening a shift with no store is rejected by the API @edge', async ({ api }) => {
    const { status } = await api.request('POST', '/store-cash/shifts', {
      openingcash: 100, name: 'nostore', starttime: '09:00', endtime: '17:00',
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('CASH-4 a second open shift on the same store is blocked (issue #142) @edge', async ({ api }) => {
    const a = await openShift(api, store2(), { openingcash: 500, name: 'dup' });
    expect([200, 201]).toContain(a.status);
    const b = await api.request('POST', '/store-cash/shifts', {
      storeid: store2(), openingcash: 500, name: 'dup2', starttime: '09:00', endtime: '17:00',
    });
    expect(b.status).toBeGreaterThanOrEqual(400); // rejected - store already has an open shift
  });

  test('CASH-5 a shift can be assigned then reassigned @happy', async ({ api }) => {
    const s = await openShift(api, store2(), { openingcash: 100, name: 'assign-me' });
    const id = s.body.id;
    const u1 = data.user((u) => u.role === 'Sales Staff').id;
    const a1 = await api.request('PUT', `/store-cash/shifts/${id}/assign`, { assigneduserid: u1 });
    expect([200, 201]).toContain(a1.status);
    const a2 = await api.request('PUT', `/store-cash/shifts/${id}/assign`, { assigneduserid: null });
    expect([200, 201]).toContain(a2.status);
  });

  test('CASH-6 an EXPENSE entry saves even with no open shift on that store @edge', async ({ api }) => {
    // fresh store with no shift: create one via BH
    const biz = data.business('RGP Pharmacy');
    const st = await api.request('POST', '/stores', { location: `NoShift ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
    const sid = st.body.id;
    const { status, body } = await api.request('POST', '/store-cash/ledger', {
      storeid: sid, category: 'EXPENSE', withdraw: 250, description: 'no-shift expense',
    });
    expect([200, 201]).toContain(status);
    expect(body.shift_id ?? body.shiftid ?? null).toBeFalsy();
  });

  test('CASH-7 a cash entry auto-attaches to the operator\'s open shift @happy', async ({ api }) => {
    // sales1 == user id 3 (seed). find the open shift assigned to them.
    const cashier = 'sales1@local.test';
    const me = await api.request('GET', '/auth/me', undefined, cashier);
    const open = await api.request('GET', `/store-cash/shifts?storeid=${STORE1}&status=OPEN`);
    const eligible = open.body
      .filter((s: any) => s.assigneduserid === me.body.id || s.assigneduserid == null)
      .map((s: any) => s.id);
    expect(eligible.length).toBeGreaterThan(0);
    const { body } = await api.request('POST', '/store-cash/ledger', {
      storeid: STORE1, category: 'ADJUSTMENT', deposit: 15, description: 'auto-link probe',
    }, cashier);
    expect(eligible).toContain(body.shiftid ?? body.shift?.id);
  });

  test('CASH-8 a BANK_DEPOSIT moves the amount to withdraw and detaches from any shift @edge', async ({ api }) => {
    const { body } = await api.request('POST', '/store-cash/ledger', {
      storeid: STORE1, category: 'BANK_DEPOSIT', deposit: 3000, description: 'to bank',
    }, 'sales1@local.test');
    expect(Number(body.withdraw)).toBe(3000);
    expect(Number(body.deposit)).toBe(0);
    expect(body.shift_id ?? body.shiftid ?? null).toBeFalsy();
  });

  test('CASH-9 dashboard cash balance equals sum(deposits) - sum(withdrawals) @happy', async ({ api }) => {
    const ledger = await api.request('GET', `/store-cash/ledger?storeid=${STORE1}`);
    const sum = ledger.body.reduce(
      (a: number, e: any) => a + Number(e.deposit || 0) - Number(e.withdraw || 0), 0,
    );
    const dash = await api.request('GET', `/store-cash/dashboard?storeid=${STORE1}`);
    expect(Math.abs(Number(dash.body.cashbalance) - sum)).toBeLessThan(0.5);
  });

  test('CASH-10 the deposit-due flag turns on once balance >= threshold @happy', async ({ api }) => {
    const dash = await api.request('GET', `/store-cash/dashboard?storeid=${STORE1}`);
    const bal = Number(dash.body.cashbalance);
    const threshold = Number(dash.body.depositthreshold);
    if (bal >= threshold) {
      expect(dash.body.depositdue).toBeTruthy();
      expect(Math.abs(Number(dash.body.depositexcess) - (bal - threshold))).toBeLessThan(1);
    } else {
      // push it over: deposit enough then re-check
      await api.request('POST', '/store-cash/ledger', {
        storeid: STORE1, category: 'ADJUSTMENT', deposit: threshold, description: 'push over threshold',
      }, 'sales1@local.test');
      const after = await api.request('GET', `/store-cash/dashboard?storeid=${STORE1}`);
      expect(after.body.depositdue).toBeTruthy();
    }
  });

  test('CASH-11 closing with counted = expected gives variance 0 @happy', async ({ api }) => {
    const s = await openShift(api, store2(), { openingcash: 800, name: 'close-exact' });
    const id = s.body.id;
    const expected = Number(s.body.expectedcash);
    const close = await api.request('PUT', `/store-cash/shifts/${id}/close`, { counteddenominations: denoms(expected) });
    expect([200, 201]).toContain(close.status);
    const after = await api.request('GET', `/store-cash/shifts?storeid=${store2()}&shiftid=${id}`);
    expect(Math.abs(Number(after.body[0].variance))).toBeLessThan(0.5);
    // the recorded total equals the denomination sum
    expect(Number(after.body[0].countedcash)).toBe(expected);
  });

  test('CASH-12 short and over closes carry the right variance sign @happy', async ({ api }) => {
    for (const delta of [-100, 150]) {
      const s = await openShift(api, store2(), { openingcash: 500, name: `close-${delta}` });
      const id = s.body.id;
      const expected = Number(s.body.expectedcash);
      await api.request('PUT', `/store-cash/shifts/${id}/close`, { counteddenominations: denoms(expected + delta) });
      const after = await api.request('GET', `/store-cash/shifts?storeid=${store2()}&shiftid=${id}`);
      const v = Number(after.body[0].variance);
      expect(Math.sign(v)).toBe(Math.sign(delta));
      expect(Math.abs(v - delta)).toBeLessThan(0.5);
    }
  });

  test('CASH-13 closing with no drawer count is rejected @negative', async ({ api }) => {
    const s = await openShift(api, store2(), { openingcash: 700, name: 'close-empty' });
    const id = s.body.id;
    const r = await api.request('PUT', `/store-cash/shifts/${id}/close`, { notes: 'no count' });
    expect(r.status).toBe(400);
    const after = await api.request('GET', `/store-cash/shifts?storeid=${store2()}&shiftid=${id}`);
    expect(after.body[0].status).toBe('OPEN'); // still open, not silently zeroed
  });

  test('CASH-14 the shift report figures tie out to the underlying sales @integration', async ({ api }) => {
    const shifts = await api.request('GET', `/store-cash/shifts?storeid=${STORE1}`);
    const closed = shifts.body.find((s: any) => s.status === 'CLOSED' && Number(s.salescash) > 0)
      || shifts.body.find((s: any) => s.status === 'CLOSED');
    expect(closed, 'a closed shift with activity').toBeTruthy();
    const rpt = await api.request('GET', `/store-cash/shifts/${closed.id}/report`);
    expect(rpt.status, 'shift report responds (issue #130)').toBeLessThan(400);

    const body = rpt.body;
    expect(body.sales).toBeTruthy();
    expect(Array.isArray(body.ledger)).toBeTruthy();
    const cashSales = Number(body.sales?.cash_sales ?? 0);
    const digiSales = Number(body.sales?.digi_sales ?? 0);
    const staffCash = (body.staff || []).reduce((a: number, s: any) => a + Number(s.cash_sales || 0), 0);
    const staffDigi = (body.staff || []).reduce((a: number, s: any) => a + Number(s.digi_sales || 0), 0);
    if (body.staff?.length) {
      expect(Math.abs(staffCash - cashSales)).toBeLessThan(1);
      expect(Math.abs(staffDigi - digiSales)).toBeLessThan(1);
    }
    expect(Number(body.sales?.bill_count ?? 0)).toBeGreaterThanOrEqual(0);
  });

  test('CASH-15 closing an already-closed shift is guarded (issue #140) @edge', async ({ api }) => {
    const s = await openShift(api, store2(), { openingcash: 300, name: 'double-close' });
    const id = s.body.id;
    const first = await api.request('PUT', `/store-cash/shifts/${id}/close`, { countedcash: 300 });
    expect([200, 201]).toContain(first.status);
    const before = await api.request('GET', `/store-cash/shifts?storeid=${store2()}&shiftid=${id}`);
    const second = await api.request('PUT', `/store-cash/shifts/${id}/close`, { countedcash: 999 });
    expect(second.status).toBeGreaterThanOrEqual(400); // rejected - already closed
    const after = await api.request('GET', `/store-cash/shifts?storeid=${store2()}&shiftid=${id}`);
    expect(Number(after.body[0].countedcash)).toBe(300);              // original count untouched
    expect(after.body[0].closedon).toBe(before.body[0].closedon);     // original close timestamp untouched
  });

  test('SHIFT-STAFF a Sales Staff can open and close a shift at their own store @permission', async ({ api }) => {
    const sid = await freshStore(api);
    // a fresh cashier scoped to this store (not the shared sales1 persona, whose own store
    // assignment other tests depend on - WS-9 now enforces it, so borrowing sales1 here would
    // either fail against a store they're not assigned to, or mutate shared seed state).
    const email = `qa.staff.${Date.now()}@local.test`;
    const password = process.env.QA_ADMIN_PASS || 'admin123';
    await api.request('POST', '/users', {
      fullname: 'QA Shift Staff', email, password, phone: '9' + String(Date.now()).slice(-9),
      location: 'QA', roleid: 2, storeids: [sid],
    }, MGR);
    const open = await api.request('POST', '/store-cash/shifts', {
      storeid: sid, name: 'staff-run', openingdenominations: denoms(1000),
    }, email);
    expect([200, 201]).toContain(open.status);
    expect(Number(open.body.openingcash)).toBe(1000);
    const close = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, {
      counteddenominations: denoms(1000),
    }, email);
    expect([200, 201]).toContain(close.status);
    const after = await api.request('GET', `/store-cash/shifts?storeid=${sid}&shiftid=${open.body.id}`);
    expect(after.body[0].status).toBe('CLOSED');
  });

  test('WS9-STORE-SCOPE a Sales Staff cannot open a shift at a store they are not assigned to @negative', async ({ api }) => {
    const homeStore = await freshStore(api);
    const otherStore = await freshStore(api);
    const email = `qa.scoped.${Date.now()}@local.test`;
    const password = process.env.QA_ADMIN_PASS || 'admin123';
    await api.request('POST', '/users', {
      fullname: 'QA Scoped Staff', email, password, phone: '9' + String(Date.now()).slice(-9),
      location: 'QA', roleid: 2, storeids: [homeStore],
    }, MGR);
    // their own store: fine
    const ok = await api.request('POST', '/store-cash/shifts', { storeid: homeStore, name: 'home', openingcash: 500 }, email);
    expect([200, 201]).toContain(ok.status);
    await api.request('PUT', `/store-cash/shifts/${ok.body.id}/close`, { countedcash: 500 }, email);
    // a store they're not assigned to: rejected
    const blocked = await api.request('POST', '/store-cash/shifts', { storeid: otherStore, name: 'away', openingcash: 500 }, email);
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    // Business Head is unaffected - oversees every store in the business
    const bhOpen = await api.request('POST', '/store-cash/shifts', { storeid: otherStore, name: 'bh-can', openingcash: 500 }, MGR);
    expect([200, 201]).toContain(bhOpen.status);
    await api.request('PUT', `/store-cash/shifts/${bhOpen.body.id}/close`, { countedcash: 500 }, MGR);
  });

  test('WS9-ZERO-FLOAT opening a shift with no float is rejected unless explicitly confirmed @negative', async ({ api }) => {
    const sid = await freshStore(api);
    const blocked = await api.request('POST', '/store-cash/shifts', { storeid: sid, name: 'zero', openingcash: 0 }, MGR);
    expect(blocked.status).toBe(400);
    const confirmed = await api.request('POST', '/store-cash/shifts', { storeid: sid, name: 'zero-ok', openingcash: 0, allowZero: true }, MGR);
    expect([200, 201]).toContain(confirmed.status);
    await api.request('PUT', `/store-cash/shifts/${confirmed.body.id}/close`, { countedcash: 0, allowZero: true }, MGR);
  });

  test('WS9-DEPOSIT-REF a bank deposit\'s reference number round-trips through the ledger @happy', async ({ api }) => {
    const { body } = await api.request('POST', '/store-cash/ledger', {
      storeid: STORE1, category: 'BANK_DEPOSIT', deposit: 500, description: 'qa ref', referenceno: 'UTR12345',
    }, MGR);
    expect(body.referenceno).toBe('UTR12345');
  });

  test('WS7-CHECKLIST a shift with a complete checklist opens and closes; an incomplete one is rejected @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const OPEN_KEYS = ['float_counted', 'terminal_working', 'entrance_unlocked', 'prior_deposit_secured'];
    const CLOSE_KEYS = ['drawer_counted', 'entrance_locked', 'lights_off', 'cash_secured'];

    // incomplete opening checklist: rejected
    const badOpen = await api.request('POST', '/store-cash/shifts', {
      storeid: sid, name: 'checklist-bad', openingcash: 500, openingchecklist: OPEN_KEYS.slice(0, 2),
    }, MGR);
    expect(badOpen.status).toBe(400);

    // complete: succeeds
    const open = await api.request('POST', '/store-cash/shifts', {
      storeid: sid, name: 'checklist-good', openingcash: 500, openingchecklist: OPEN_KEYS,
    }, MGR);
    expect([200, 201]).toContain(open.status);

    // incomplete closing checklist: rejected, shift stays open
    const badClose = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, {
      countedcash: 500, closingchecklist: CLOSE_KEYS.slice(0, 1),
    }, MGR);
    expect(badClose.status).toBe(400);

    // complete: succeeds
    const close = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, {
      countedcash: 500, closingchecklist: CLOSE_KEYS,
    }, MGR);
    expect([200, 201]).toContain(close.status);
  });

  test('WS7-CHECKLIST-OPTIONAL a shift open/close that omits the checklist entirely is unaffected @edge', async ({ api }) => {
    // manager/API flows that don't send a checklist at all keep working - only the POS card enforces it
    const sid = await freshStore(api);
    const open = await api.request('POST', '/store-cash/shifts', { storeid: sid, name: 'no-checklist', openingcash: 500 }, MGR);
    expect([200, 201]).toContain(open.status);
    const close = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, { countedcash: 500 }, MGR);
    expect([200, 201]).toContain(close.status);
  });

  test('WS2-EXPENSE-CATEGORY an expense category round-trips and rolls up into the monthly summary @happy', async ({ api }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { body } = await api.request('POST', '/store-cash/ledger', {
      storeid: STORE1, category: 'EXPENSE', withdraw: 777, description: 'qa expense',
      expensecategory: 'CLEANING', transdate: today,
    }, MGR);
    expect(body.expensecategory).toBe('CLEANING');

    const summary = await api.request('GET', `/store-cash/expenses/summary?storeid=${STORE1}`, undefined, MGR);
    expect(summary.status).toBeLessThan(400);
    const row = summary.body.find((r: any) => r.category === 'CLEANING');
    expect(row, 'CLEANING appears in this month\'s summary').toBeTruthy();
    expect(row.total).toBeGreaterThanOrEqual(777);
  });

  test('SHIFT-REQUIRED a COMPLETE sale is rejected when store 1 has no open shift @negative', async ({ api }) => {
    // close every open shift on store 1, try to sell, then always reopen one
    const open = (await api.request('GET', `/store-cash/shifts?storeid=${STORE1}&status=OPEN`)).body || [];
    for (const s of open) {
      await api.request('PUT', `/store-cash/shifts/${s.id}/close`, {
        counteddenominations: denoms(Number(s.expectedcash ?? 0)), allowZero: true,
      });
    }
    try {
      const item = (await api.request('POST', '/stock/filter', { available: true, limit: 20 }, MGR)).body
        .find((x: any) => Number(x.balance) > 3 && x.status === 'VERIFIED');
      expect(item, 'a stocked item').toBeTruthy();
      const price = Math.max(1, Math.round(Number(item.mrp_cost || 20) * 0.8));
      const tax = Number(item.tax_pcnt || 12);
      const now = new Date().toISOString();
      const total = +(price * (1 + tax / 100)).toFixed(2);
      const r = await api.request('POST', '/sales', {
        customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0,
        total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
        items: [{ itemid: item.item_id, productid: item.id, batch: item.batch,
          price, mrpcost: Number(item.mrp_cost || 20), taxpcnt: tax, qty: 1, total }],
      }, 'sales1@local.test');
      expect(r.status).toBe(400);
      expect(String(r.body?.message || '')).toMatch(/shift/i);
    } finally {
      await api.request('POST', '/store-cash/shifts', { storeid: STORE1, name: 'reopened', openingdenominations: denoms(2000) });
    }
  });

  test('CASH-16 switching the store in the header re-scopes the cash screen @integration', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/store/cash', { storeId: STORE1 });
    await expectShell(page);
    const balA = await page.getByTestId(TID.cashBalance).textContent();
    await page.getByTestId('store-switcher').selectOption(String(store2()));
    await page.waitForResponse((r) => r.url().includes('/store-cash/dashboard') && r.url().includes(`storeid=${store2()}`));
    await expect(page.getByTestId(TID.cashBalance)).not.toHaveText(balA ?? '');
  });
});
