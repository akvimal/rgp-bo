/**
 * The My shift page — SD-1..2
 * Opening and closing a shift live on their own page; closing shows the takings by tender, takes the digital totals, and
 * either ends the day or hands the drawer to the next person while the store stays open.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

const CLOSE_KEYS = ['drawer_counted', 'entrance_locked', 'lights_off', 'cash_secured'];
const OPEN_KEYS = ['float_counted', 'terminal_working', 'entrance_unlocked', 'prior_deposit_secured'];

let POOL: any[] = [];
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
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

function digitalBill(cash: number, digi: number) {
  const s = POOL[POOL.length - 3];   // clear of the lines the transfer, credit and digital specs use
  const now = new Date().toISOString();
  const total = cash + digi;
  return {
    customerid: data.anyCustomer(), billdate: now, orderdate: now,
    cashamt: cash, digiamt: digi, digimethod: 'UPI', digirefno: `SD${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 1, total }],
  };
}

const me = async (api: any, email: string) => (await api.request('GET', '/auth/me', undefined, email)).body.id as number;

test.describe('My shift page @p1', () => {
  test('SD-1 closing: digital totals, cash drawer expenses, and a handover that keeps the store open @happy', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const cashier = await me(api, CASHIER);

    const sale = await api.request('POST', '/sales', digitalBill(40, 60), CASHIER);
    expect(sale.status).toBeLessThan(300);
    const shiftId = sale.body.shiftid as number;
    const storeId = sale.body.storeid as number;
    expect(shiftId).toBeTruthy();

    const summary = async () => (await api.request('GET', `/store-cash/shifts/${shiftId}/summary`, undefined, CASHIER)).body;
    let sm = await summary();
    const pay = sm.digitalByProvider.find((d: any) => d.provider === 'Paytm');
    expect(pay.amount).toBeGreaterThanOrEqual(60);
    expect(sm.cash).toBeGreaterThanOrEqual(40);

    // a payment from the cash drawer shows up and lowers the cash expected
    const before = sm.expected;
    const exp = await api.request('POST', '/store-cash/ledger', { storeid: storeId, shiftid: shiftId, category: 'EXPENSE', withdraw: 25, expensecategory: 'MISC', description: 'QA tea and biscuits' }, CASHIER);
    expect(exp.status).toBeLessThan(300);
    sm = await summary();
    expect(sm.expenses.some((e: any) => e.description === 'QA tea and biscuits')).toBe(true);
    expect(sm.expensesTotal).toBeGreaterThanOrEqual(25);
    expect(sm.expected).toBeCloseTo(before - 25, 1);

    const close = (b: any) => api.request('PUT', `/store-cash/shifts/${shiftId}/close`, { counteddenominations: [{ d: 500, n: 2 }], closedoperatorid: cashier, ...b }, CASHIER);
    const digital = [{ provider: 'Paytm', counted: pay.amount + 5 }];
    expect((await close({ closetype: 'HANDOVER', closingchecklist: ['drawer_counted'], closingdigital: digital })).status).toBe(400);        // who takes over?
    expect((await close({ closetype: 'HANDOVER', handovertoid: cashier, closingchecklist: ['drawer_counted'], closingdigital: digital })).status).toBe(400);   // not oneself
    const staff = (await api.request('GET', `/store-cash/users?storeid=${storeId}`, undefined, CASHIER)).body.filter((u: any) => u.id !== cashier);
    expect(staff.length).toBeGreaterThan(0);
    const taker = staff[0].id;
    expect((await close({ closetype: 'HANDOVER', handovertoid: taker, closingchecklist: ['drawer_counted'], closingdigital: [] })).status).toBe(400);   // the terminal total is missing
    expect((await close({ closetype: 'HANDOVER', handovertoid: taker, closingchecklist: [], closingdigital: digital })).status).toBe(400);               // nothing ticked
    expect((await close({ closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted'], closingdigital: digital })).status).toBe(400);                 // lock-up items still needed at day end
    expect((await close({ closetype: 'HANDOVER', handovertoid: 99999999, closingchecklist: ['drawer_counted'], closingdigital: digital })).status).toBe(400);

    // a handover needs only the drawer count; the next person's shift opens with the counted cash
    const done = await close({ closetype: 'HANDOVER', handovertoid: taker, closingchecklist: ['drawer_counted'], closingdigital: digital });
    expect(done.status).toBeLessThan(300);
    expect(done.body).toMatchObject({ closetype: 'HANDOVER', handovertouserid: taker, status: 'CLOSED' });
    const cd = done.body.closingdigital.find((d: any) => d.provider === 'Paytm');
    expect(cd.counted).toBeCloseTo(pay.amount + 5, 2);
    expect(cd.variance).toBeCloseTo(5, 2);
    const open = (await api.request('GET', `/store-cash/shifts?storeid=${storeId}&status=OPEN`, undefined, MGR)).body;
    expect(open.length).toBe(1);
    expect(open[0]).toMatchObject({ id: done.body.nextshiftid, assigneduserid: taker, handoverfromshiftid: shiftId });
    expect(open[0].openingcash).toBe(1000);

    // the day ends later with the full checklist; then a shift is opened again for the other specs
    const nextId = done.body.nextshiftid as number;
    const eod = (keys: string[]) => api.request('PUT', `/store-cash/shifts/${nextId}/close`, { countedcash: 1000, closedoperatorid: cashier, closetype: 'END_OF_DAY', closingchecklist: keys }, CASHIER);
    expect((await eod(CLOSE_KEYS.slice(0, 2))).status).toBe(400);
    const ended = await eod(CLOSE_KEYS);
    expect(ended.status).toBeLessThan(300);
    expect(ended.body.closetype).toBe('END_OF_DAY');
    const reopen = await api.request('POST', '/store-cash/shifts', { storeid: storeId, openingcash: 1000, assigneduserid: cashier, openingchecklist: OPEN_KEYS }, CASHIER);
    expect(reopen.status).toBeLessThan(300);
  });

  test('SD-2 the page: the billing screen has no shift strip, and the checklist follows the kind of close @happy', async ({ app }) => {
    const { page } = await app.open(CASHIER, '/secure/sales/pos');
    await expectShell(page);
    await expect(page.getByTestId('shift-card')).toHaveCount(0);                          // no shift strip on the POS ...
    await expect(page.getByTestId('shift-card-close')).toHaveCount(0);                    // ... and no open / close forms
    await expect(page.getByTestId('header-shift')).toBeVisible();                         // the header pill says whether a shift is open
    await expect(page.getByTestId('nav-shift')).toBeVisible();

    await page.getByTestId('nav-shift').click();
    await page.waitForURL(/\/secure\/shift/);
    await expect(page.getByTestId('shiftdesk-summary')).toBeVisible();
    await expect(page.getByTestId('shiftdesk-expenses')).toBeVisible();
    await page.getByTestId('shift-card-close').click();
    const form = page.getByTestId('shiftdesk-close-form');
    await expect(form).toBeVisible();
    await expect(form.getByTestId('shift-checklist-entrance_locked')).toBeVisible();      // end of day: the whole list
    await expect(form.locator('input[type=checkbox]')).toHaveCount(6);
    await form.getByTestId('shiftdesk-type-handover').check();
    await expect(form.getByTestId('shiftdesk-handover')).toBeVisible();
    await expect(form.getByTestId('shift-checklist-entrance_locked')).toHaveCount(0);      // a handover: lock-up items do not apply
    await expect(form.getByTestId('shift-checklist-lights_off')).toHaveCount(0);
    await expect(form.locator('input[type=checkbox]')).toHaveCount(3);
  });
});
