/**
 * The Manage Delivery screen - DM-1..3 (real clicks)
 * Only what most deliveries need is asked: status with a "Mark delivered" action, who delivers, the receiver in one line, the cost and how it was paid, and who
 * confirmed it (the person at the counter). A cost paid in cash lands on the open shift's cash ledger. Costs already recorded as expenses are linked, not paid again.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const OPERATOR = { operatorId: 3, operatorName: 'Sale Staff One' };
const run = Date.now().toString().slice(-6);

let POOL: any[] = [];
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
  const rows = await (await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ available: true, limit: 200 }),
  })).json();
  POOL = rows.filter((x: any) => Number(x.balance) > 30 && x.status === 'VERIFIED').map((x: any) => ({
    itemid: x.item_id, productid: x.id, batch: x.batch, price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)), mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

async function deliveryBill(api: any) {
  const s = POOL[0];
  const total = +(s.price * 2 * (1 + s.taxpcnt / 100)).toFixed(2);
  const now = new Date().toISOString();
  const sale = await api.request('POST', '/sales', {
    customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Delivery',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 2, total }],
  }, COUNTER);
  expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);
  const list = (await api.request('GET', '/deliveries', undefined, COUNTER)).body as any[];
  const row = list.find((d) => d.saleid === sale.body.id);
  return { saleid: sale.body.id as number, billno: row.sale?.billno as number, storeid: row.storeid as number };
}
const deliveryOf = async (api: any, saleid: number) => ((await api.request('GET', '/deliveries', undefined, COUNTER)).body as any[]).find((d) => d.saleid === saleid);
const openShift = async (api: any, storeid: number) => ((await api.request('GET', `/store-cash/shifts?storeid=${storeid}&status=OPEN`, undefined, COUNTER)).body as any[])[0];
const manageRow = (page: any, billno: number) => page.locator('tr', { hasText: `#${billno}` }).first().getByRole('button', { name: 'Manage' });

test.describe('Manage Delivery screen @p1', () => {
  test('DM-1 mark delivered, choose who and how the cost was paid: the cost lands on the open shift, and the person at the counter confirmed it @happy', async ({ api, app }) => {
    const b = await deliveryBill(api);
    const shift = await openShift(api, b.storeid);
    test.skip(!shift, 'no shift is open at the store');
    const before = Number(shift.expectedcash);
    const { page } = await app.open(COUNTER, '/secure/sales/deliveries', { storeId: b.storeid, ...OPERATOR });
    await manageRow(page, b.billno).click();
    const dlg = page.getByTestId('delivery-editor');
    await expect(dlg).toBeVisible();

    // only what is needed is on the screen: the old boxes are not
    await expect(dlg.getByTestId('dm-status')).toBeVisible();
    await expect(dlg.getByTestId('dm-receiver-line')).toBeVisible();                           // the receiver in one line
    await expect(dlg.getByPlaceholder('Receiver name')).toHaveCount(0);
    await expect(dlg.getByText('Collection status')).toHaveCount(0);
    await expect(dlg.getByText('Courier partner')).toHaveCount(0);
    await expect(dlg.getByTestId('dm-confirmed-line')).toContainText('Not confirmed yet');

    // who delivers
    await page.getByTestId('dm-by-courier').check();
    await expect(page.getByTestId('dm-partner')).toBeVisible();
    await page.getByTestId('dm-by-staff').check();
    const staff = page.getByTestId('dm-staff');
    await expect(staff).toBeVisible();
    if ((await staff.evaluate((el: any) => el.tagName)) === 'SELECT') await staff.selectOption({ index: 1 }); else await staff.fill('Ramesh');

    // mark delivered: it is confirmed by the person at the counter, at the time on the wall
    await page.getByTestId('dm-mark-delivered').click();
    await expect(page.getByTestId('dm-status')).toHaveValue('Delivered');
    await expect(page.getByTestId('dm-confirmed-line')).toContainText('Confirmed by Sale Staff One');
    await expect(page.getByTestId('dm-date')).toHaveCount(0);                                    // the day to deliver is not needed once delivered

    // the cost, and how it was paid
    await page.getByTestId('dm-cost').fill('45');
    await expect(page.getByTestId('dm-cost-unsaid')).toBeVisible();                              // an amount and no way yet: it asks
    await page.getByTestId('dm-way-CASH').check();
    await expect(page.getByTestId('dm-cash-shift'), 'the drawer that pays is named').toContainText(shift.name);
    await expect(page.getByTestId('dm-cash-note')).toContainText('cash expected goes down');
    await expect(page.getByTestId('dm-shift-choice'), 'counter staff are not offered a choice').toHaveCount(0);
    await expect(page.getByTestId('dm-cost-unsaid')).toHaveCount(0);
    await page.getByTestId('dm-save').click();
    await expect(page.getByTestId('delivery-editor')).toHaveCount(0);

    const d = await deliveryOf(api, b.saleid);
    expect(d).toMatchObject({ status: 'Delivered', costpaidvia: 'CASH', actualcost: 45, confirmed: true, confirmedby: 'Sale Staff One' });
    expect(d.cashentryid).toBeTruthy();
    expect(Number((await openShift(api, b.storeid)).expectedcash)).toBeCloseTo(before - 45, 1);
    await expect(page.locator('tr', { hasText: `#${b.billno}` }).first().getByTestId('delivery-cost-label')).toContainText('Paid in cash');
  });

  test('DM-2 a digital payment asks for the mode, and what is wrong is said on the screen, not lost @edge', async ({ api, app }) => {
    const b = await deliveryBill(api);
    const { page } = await app.open(COUNTER, '/secure/sales/deliveries', { storeId: b.storeid, ...OPERATOR });
    await manageRow(page, b.billno).click();
    await page.getByTestId('dm-way-DIGITAL').check();
    await page.getByTestId('dm-save').click();                                                   // no cost yet
    await expect(page.getByTestId('dm-error')).toContainText('Enter the cost first');
    await page.getByTestId('dm-cost').fill('70');
    await page.getByTestId('dm-mode').selectOption('UPI');
    await page.getByTestId('dm-ref').fill(`TXN${run}`);
    await page.getByTestId('dm-save').click();
    await expect(page.getByTestId('delivery-editor')).toHaveCount(0);
    expect(await deliveryOf(api, b.saleid)).toMatchObject({ costpaidvia: 'DIGITAL', costpaidmode: 'UPI', costpaidref: `TXN${run}`, actualcost: 70 });
    // the expense waits for approval, and the person is told
    await expect(page.getByTestId('delivery-notice')).toContainText('waiting for the Store Head to approve');
  });

  test('DM-3 costs already recorded as expenses are matched and linked, in one go or from the delivery, without paying twice @happy', async ({ api, app }) => {
    const shiftOf = async (storeid: number) => openShift(api, storeid);
    const a = await deliveryBill(api);
    const b = await deliveryBill(api);
    const shift = await shiftOf(a.storeid);
    test.skip(!shift, 'no shift is open at the store');
    const n = Number(run.slice(-3));
    const amountA = 410 + n + 0.5, amountB = 1500 + n + 0.5;
    // what was entered separately before: two cash expenses, and the two deliveries with their cost
    const ea = await api.request('POST', '/store-cash/ledger', { storeid: a.storeid, category: 'EXPENSE', expensecategory: 'LOGISTICS', withdraw: amountA, description: `Delivery boy ${run}`, shiftid: shift.id }, COUNTER);
    const eb = await api.request('POST', '/store-cash/ledger', { storeid: b.storeid, category: 'EXPENSE', expensecategory: 'MISC', withdraw: amountB, description: `Auto ${run}`, shiftid: shift.id }, COUNTER);      // nothing says it is about a delivery
    expect(ea.status, JSON.stringify(ea.body)).toBeLessThan(300);
    await api.request('PUT', `/deliveries/${a.saleid}`, { saleid: a.saleid, status: 'Delivered', actualcost: amountA }, COUNTER);
    await api.request('PUT', `/deliveries/${b.saleid}`, { saleid: b.saleid, status: 'Delivered', actualcost: amountB }, COUNTER);
    const entriesBefore = (await api.request('GET', `/store-cash/ledger?storeid=${a.storeid}`, undefined, COUNTER)).body.length;

    const { page } = await app.open(COUNTER, '/secure/sales/deliveries', { storeId: a.storeid, ...OPERATOR });
    await expect(page.getByTestId('delivery-unlinked')).toContainText('not linked to an expense');
    // one in one go: the sure match (it says delivery)
    await page.getByTestId('delivery-review-links').click();
    const row = page.getByTestId('delivery-link-row').filter({ hasText: `#${a.billno}` });
    await expect(row).toContainText(`Delivery boy ${run}`);
    await expect(row).toContainText('says delivery or courier');
    await expect(page.getByTestId('delivery-link-row').filter({ hasText: `#${b.billno}` }), 'a match that does not say delivery is left for a person').toHaveCount(0);
    // every sure match is ticked; keep this test to its own delivery (other data in this database may have matches too)
    const rows = page.getByTestId('delivery-link-row');
    for (let i = 0; i < await rows.count(); i++) {
      const r = rows.nth(i);
      if (!(await r.innerText()).includes(`#${a.billno}`)) await r.locator('input[type=checkbox]').uncheck();
    }
    await expect(page.getByTestId('delivery-link-selected')).toContainText('Link 1 selected');
    await page.getByTestId('delivery-link-selected').click();
    await expect(page.getByTestId('delivery-link-message')).toContainText('Linked 1 delivery cost');
    expect(await deliveryOf(api, a.saleid)).toMatchObject({ costlinked: true, cashentryid: ea.body.id, costpaidvia: 'CASH' });
    await page.keyboard.press('Escape');

    // the other from its own delivery: the likely match is shown when "cash" is chosen, and linking it pays nothing
    await manageRow(page, b.billno).click();
    await page.getByTestId('dm-way-CASH').check();
    await expect(page.getByTestId('dm-likely')).toContainText(`Auto ${run}`);
    await page.getByTestId(`dm-link-instead-${eb.body.id}`).click();
    await expect(page.getByTestId('dm-way-LINK')).toBeChecked();
    await page.getByTestId('dm-save').click();
    await expect(page.getByTestId('delivery-editor')).toHaveCount(0);
    expect(await deliveryOf(api, b.saleid)).toMatchObject({ costlinked: true, cashentryid: eb.body.id, actualcost: amountB });
    expect((await api.request('GET', `/store-cash/ledger?storeid=${a.storeid}`, undefined, COUNTER)).body.length, 'nothing was posted').toBe(entriesBefore);

    // a linked cost is shown as recorded, locked, and can be let go without deleting the expense
    await manageRow(page, a.billno).click();
    await expect(page.getByTestId('dm-locked')).toContainText('linked to an expense that was already recorded');
    await expect(page.getByTestId('dm-cost')).toBeDisabled();
    await page.getByTestId('dm-unlink').click();
    await expect(page.getByTestId('delivery-editor')).toHaveCount(0);
    expect(await deliveryOf(api, a.saleid)).toMatchObject({ costpaidvia: 'UNPAID', costlinked: false, cashentryid: null });
    expect((await api.request('GET', `/store-cash/ledger?storeid=${a.storeid}`, undefined, COUNTER)).body.length, 'the expense is still there').toBe(entriesBefore);
  });

  test('DM-HEAD the dialog title shows the bill with the customer name and mobile @happy', async ({ api, app }) => {
    const b = await deliveryBill(api);
    const d = await deliveryOf(api, b.saleid);
    const customer = d.sale?.customer || {};
    const { page } = await app.open(COUNTER, '/secure/sales/deliveries', { storeId: b.storeid, ...OPERATOR });
    await manageRow(page, b.billno).click();
    const title = page.locator('.p-dialog-title').filter({ hasText: 'Manage Delivery' });
    await expect(title).toContainText(`#${b.billno}`);
    if (customer.name) await expect(title).toContainText(String(customer.name).trim());
    if (customer.mobile) await expect(title).toContainText(String(customer.mobile).trim());
  });
});
