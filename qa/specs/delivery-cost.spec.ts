/**
 * What a delivery cost, and how it was paid - DELCOST-1..7
 * The Manage Delivery screen saves the cost with how it was paid: cash from the counter (an entry on the open shift's cash ledger, so the expected cash falls),
 * digitally (an expense), not yet, or no cost. It is posted once and a later change updates the same entry. Costs and expenses that were already recorded
 * separately are linked to their deliveries instead of being posted again, so nothing is counted twice. The person logged in is who confirmed the delivery.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
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

/** a delivery bill, rung up at the counter */
async function deliveryBill(api: any) {
  const s = POOL[0];
  const total = +(s.price * 2 * (1 + s.taxpcnt / 100)).toFixed(2);
  const now = new Date().toISOString();
  const sale = await api.request('POST', '/sales', {
    customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Delivery',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 2, total }],
  }, COUNTER);
  expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);
  const saleid = sale.body.id as number;
  const list = (await api.request('GET', '/deliveries', undefined, COUNTER)).body as any[];
  const row = list.find((d) => d.saleid === saleid);
  expect(row, 'the bill is in the deliveries list').toBeTruthy();
  return { saleid, billno: sale.body.billno ?? row.sale?.billno, storeid: row.storeid as number };
}

const manage = (api: any, saleid: number, body: any, who = COUNTER) => api.request('PUT', `/deliveries/${saleid}`, { saleid, ...body }, who);
const deliveryOf = async (api: any, saleid: number) => ((await api.request('GET', '/deliveries', undefined, COUNTER)).body as any[]).find((d) => d.saleid === saleid);
const openShift = async (api: any, storeid: number) => ((await api.request('GET', `/store-cash/shifts?storeid=${storeid}&status=OPEN`, undefined, COUNTER)).body as any[])[0];
const ledgerFor = async (api: any, storeid: number, text: string) =>
  ((await api.request('GET', `/store-cash/ledger?storeid=${storeid}`, undefined, COUNTER)).body as any[]).filter((r) => String(r.description || '').includes(text));
const expenseList = async (api: any) => (await api.request('GET', '/expenses', undefined, MGR)).body.rows as any[];

test.describe('Delivery cost @p1', () => {
  test('DELCOST-1 paid in cash from the counter: one entry on the open shift, the expected cash falls, saving again pays nothing twice @happy', async ({ api }) => {
    const b = await deliveryBill(api);
    const shift = await openShift(api, b.storeid);
    test.skip(!shift, 'no shift is open at the store');
    const before = Number((await openShift(api, b.storeid)).expectedcash);
    const tag = `Delivery #${b.billno}`;

    const saved = await manage(api, b.saleid, { status: 'Delivered', deliveryby: 'Ramesh', actualcost: 60, costpaid: { via: 'CASH' } });
    expect(saved.status, JSON.stringify(saved.body)).toBeLessThan(300);
    const d1 = await deliveryOf(api, b.saleid);
    expect(d1).toMatchObject({ costpaidvia: 'CASH', actualcost: 60, status: 'Delivered', costlinked: false });
    expect(d1.cashentryid).toBeTruthy();
    const entries = await ledgerFor(api, b.storeid, tag);
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatchObject({ category: 'EXPENSE', expensecategory: 'LOGISTICS', withdraw: 60 });
    expect(String(entries[0].description)).toContain('Ramesh');
    expect(Number((await openShift(api, b.storeid)).expectedcash)).toBeCloseTo(before - 60, 1);

    // saving again, the same way: nothing is posted a second time
    expect((await manage(api, b.saleid, { status: 'Delivered', deliveryby: 'Ramesh', actualcost: 60, costpaid: { via: 'CASH' } })).status).toBeLessThan(300);
    expect((await ledgerFor(api, b.storeid, tag)).length).toBe(1);
    // a changed cost updates the same entry while the shift is open
    expect((await manage(api, b.saleid, { status: 'Delivered', deliveryby: 'Ramesh', actualcost: 80, costpaid: { via: 'CASH' } })).status).toBeLessThan(300);
    const changed = await ledgerFor(api, b.storeid, tag);
    expect(changed.length).toBe(1);
    expect(changed[0].withdraw).toBe(80);
    expect(Number((await openShift(api, b.storeid)).expectedcash)).toBeCloseTo(before - 80, 1);
    // not paid yet takes it back
    expect((await manage(api, b.saleid, { actualcost: 80, costpaid: { via: 'UNPAID' } })).status).toBeLessThan(300);
    expect((await ledgerFor(api, b.storeid, tag)).length).toBe(0);
    expect(Number((await openShift(api, b.storeid)).expectedcash)).toBeCloseTo(before, 1);
    expect(await deliveryOf(api, b.saleid)).toMatchObject({ costpaidvia: 'UNPAID', cashentryid: null });
  });

  test('DELCOST-2 confirmed by the person logged in, at the shop time, when it is marked delivered @happy', async ({ api }) => {
    const b = await deliveryBill(api);
    expect((await manage(api, b.saleid, { status: 'Delivered' })).status).toBeLessThan(300);
    const d = await deliveryOf(api, b.saleid);
    expect(d.confirmed).toBe(true);
    expect(d.confirmedby, 'the person logged in').toBeTruthy();
    expect(d.confirmedbyuser).toBeTruthy();
    expect(d.confirmedat).toBeTruthy();
    expect(d.deliveredat).toBeTruthy();
    // somebody else named: that name is kept, not overwritten
    const other = await deliveryBill(api);
    await manage(api, other.saleid, { status: 'Delivered', confirmedby: 'Priya (customer called)' });
    expect((await deliveryOf(api, other.saleid)).confirmedby).toBe('Priya (customer called)');
  });

  test('DELCOST-3 paid digitally: an expense with its mode and reference, changed while pending, locked once approved @happy', async ({ api }) => {
    const b = await deliveryBill(api);
    const saved = await manage(api, b.saleid, { status: 'Delivered', deliveryby: 'DTDC', actualcost: 70, costpaid: { via: 'DIGITAL', mode: 'upi', ref: `TXN${run}` } });
    expect(saved.status, JSON.stringify(saved.body)).toBeLessThan(300);
    const d = await deliveryOf(api, b.saleid);
    expect(d).toMatchObject({ costpaidvia: 'DIGITAL', costpaidmode: 'UPI', costpaidref: `TXN${run}` });
    expect(d.expenseid).toBeTruthy();
    const e = (await expenseList(api)).find((x) => x.id === d.expenseid);
    expect(e).toMatchObject({ category: 'Transport and courier', pay_mode: 'UPI', amount: 70, bill_no: `TXN${run}` });
    expect(String(e.description)).toContain(`Delivery #${b.billno}`);
    expect(e.status, 'counter staff wait for approval').toBe('PENDING');

    // changed while pending
    expect((await manage(api, b.saleid, { actualcost: 75, costpaid: { via: 'DIGITAL', mode: 'UPI', ref: `TXN${run}` } })).status).toBeLessThan(300);
    expect((await expenseList(api)).find((x) => x.id === d.expenseid).amount).toBe(75);
    expect((await expenseList(api)).filter((x) => String(x.description).includes(`Delivery #${b.billno}`)).length, 'still one expense').toBe(1);
    // approved: it can no longer be changed here
    expect((await api.request('POST', `/expenses/${d.expenseid}/decision`, { action: 'approve' }, MGR)).status).toBeLessThan(300);
    const locked = await manage(api, b.saleid, { actualcost: 90, costpaid: { via: 'DIGITAL', mode: 'UPI', ref: `TXN${run}` } });
    expect(locked.status).toBe(409);
    expect(JSON.stringify(locked.body)).toMatch(/already approved as an expense/);
    expect((await deliveryOf(api, b.saleid)).costlocked).toBe(true);
  });

  test('DELCOST-4 a cost needs an amount and a way, and a bad way is refused @negative', async ({ api }) => {
    const b = await deliveryBill(api);
    const bad = async (body: any) => (await manage(api, b.saleid, body)).status;
    expect(await bad({ actualcost: 0, costpaid: { via: 'CASH' } })).toBe(400);
    expect(await bad({ actualcost: 60, costpaid: { via: 'DIGITAL' } })).toBe(400);                       // no mode
    expect(await bad({ actualcost: 60, costpaid: { via: 'DIGITAL', mode: 'CASH' } })).toBe(400);
    expect(await bad({ actualcost: 60, costpaid: { via: 'MAGIC' } })).toBe(400);
    expect(await bad({ actualcost: 60, costpaid: { link: { kind: 'CASH', id: 0 } } })).toBe(400);
    expect((await deliveryOf(api, b.saleid)).costpaidvia, 'nothing was recorded').toBeFalsy();
    // no cost at all
    expect((await manage(api, b.saleid, { actualcost: 60, costpaid: { via: 'NONE' } })).status).toBeLessThan(300);
    expect(await deliveryOf(api, b.saleid)).toMatchObject({ costpaidvia: 'NONE', actualcost: 0 });
  });

  test('DELCOST-5 an expense already recorded is linked to the delivery, not posted again; unlinking leaves it where it was @happy', async ({ api }) => {
    const b = await deliveryBill(api);
    const shift = await openShift(api, b.storeid);
    test.skip(!shift, 'no shift is open at the store');
    const amount = 100 + (Number(run.slice(-3)) % 800) + 0.5;                                         // an amount nothing else here has
    // what was entered separately, before: a cash drawer expense and the delivery with its amount
    const made = await api.request('POST', '/store-cash/ledger', { storeid: b.storeid, category: 'EXPENSE', expensecategory: 'LOGISTICS', withdraw: amount, description: `Delivery charge ${run}`, shiftid: shift.id }, COUNTER);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const entryId = made.body.id as number;
    expect((await manage(api, b.saleid, { status: 'Delivered', actualcost: amount })).status).toBeLessThan(300);
    const expectedBefore = Number((await openShift(api, b.storeid)).expectedcash);
    const entriesBefore = (await api.request('GET', `/store-cash/ledger?storeid=${b.storeid}`, undefined, COUNTER)).body.length;

    // it is offered as the cost of this delivery, exact and sure
    const cand = (await api.request('GET', `/deliveries/${b.saleid}/cost-candidates`, undefined, COUNTER)).body;
    const mine = cand.candidates.find((c: any) => c.kind === 'CASH' && c.id === entryId);
    expect(mine, 'the existing entry is a candidate').toBeTruthy();
    expect(mine).toMatchObject({ exact: true, level: 'sure', amount });
    expect(cand.candidates[0].id, 'exact amounts come first').toBe(entryId);
    // and suggested for linking in one go
    const sug = (await api.request('GET', '/deliveries/cost-links/suggestions', undefined, COUNTER)).body;
    const pair = sug.pairs.find((p: any) => p.saleid === b.saleid);
    expect(pair).toMatchObject({ kind: 'CASH', entryid: entryId, cost: amount });
    const linked = await api.request('POST', '/deliveries/cost-links', { links: [{ saleid: b.saleid, kind: 'CASH', entryid: entryId }] }, COUNTER);
    expect(linked.body).toMatchObject({ linked: 1, skipped: [] });

    // nothing was posted: the ledger and the expected cash are as they were
    const d = await deliveryOf(api, b.saleid);
    expect(d).toMatchObject({ costpaidvia: 'CASH', costlinked: true, cashentryid: entryId, costlocked: true });
    expect((await api.request('GET', `/store-cash/ledger?storeid=${b.storeid}`, undefined, COUNTER)).body.length).toBe(entriesBefore);
    expect(Number((await openShift(api, b.storeid)).expectedcash)).toBeCloseTo(expectedBefore, 1);
    // it is no longer offered to another delivery, and cannot be linked twice
    const other = await deliveryBill(api);
    expect((await api.request('GET', `/deliveries/${other.saleid}/cost-candidates`, undefined, COUNTER)).body.candidates.some((c: any) => c.kind === 'CASH' && c.id === entryId)).toBe(false);
    await manage(api, other.saleid, { actualcost: amount });
    const twice = await api.request('POST', '/deliveries/cost-links', { links: [{ saleid: other.saleid, kind: 'CASH', entryid: entryId }] }, COUNTER);
    expect(twice.body.linked).toBe(0);
    expect(JSON.stringify(twice.body.skipped)).toMatch(/already the cost of another delivery/);

    // the cost cannot be changed from the delivery while it is linked (it belongs to the entry)
    const change = await manage(api, b.saleid, { actualcost: amount + 10, costpaid: { via: 'CASH' } });
    expect(change.status).toBe(409);
    expect(JSON.stringify(change.body)).toMatch(/linked to an expense that was already recorded/);
    // unlinking lets go, and does not delete the entry
    expect((await manage(api, b.saleid, { actualcost: amount, costpaid: { via: 'UNPAID' } })).status).toBeLessThan(300);
    expect(await deliveryOf(api, b.saleid)).toMatchObject({ costpaidvia: 'UNPAID', cashentryid: null, costlinked: false });
    expect((await ledgerFor(api, b.storeid, `Delivery charge ${run}`)).length, 'the entry is still there').toBe(1);
    expect((await api.request('GET', `/deliveries/${b.saleid}/cost-candidates`, undefined, COUNTER)).body.candidates.some((c: any) => c.id === entryId), 'and free to link again').toBe(true);
  });

  test('DELCOST-6 an expense in the Expenses ledger is linked the same way, and a different amount is refused unless the entry amount is used @edge', async ({ api }) => {
    const b = await deliveryBill(api);
    const cat = ((await api.request('GET', '/expenses/categories', undefined, MGR)).body as any[]).find((c) => c.name === 'Transport and courier');
    test.skip(!cat, 'no Transport and courier category');
    const amount = 200 + (Number(run.slice(-3)) % 700) + 0.25;
    const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    const exp = await api.request('POST', '/expenses', { expense_date: today, store_id: b.storeid, category_id: cat.id, amount, pay_mode: 'BANK', payee: 'Courier', description: `Courier ${run}` }, MGR);
    expect(exp.status, JSON.stringify(exp.body)).toBeLessThan(300);
    await manage(api, b.saleid, { status: 'Delivered', actualcost: amount + 20 });                       // the delivery says a different cost
    const refused = await manage(api, b.saleid, { actualcost: amount + 20, costpaid: { link: { kind: 'DIGITAL', id: exp.body.id } } });
    expect(refused.status).toBe(409);
    expect(JSON.stringify(refused.body)).toMatch(/amounts differ/);
    const ok = await manage(api, b.saleid, { actualcost: amount + 20, costpaid: { link: { kind: 'DIGITAL', id: exp.body.id }, adopt: true } });
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(await deliveryOf(api, b.saleid)).toMatchObject({ costpaidvia: 'DIGITAL', costpaidmode: 'BANK', expenseid: exp.body.id, costlinked: true, actualcost: amount });
    expect((await expenseList(api)).filter((x) => String(x.description).includes(`Courier ${run}`)).length, 'no second expense').toBe(1);
  });

  test('DELCOST-7 posting a new cost warns when one like it is already recorded, so it is not counted twice @edge', async ({ api }) => {
    const b = await deliveryBill(api);
    const shift = await openShift(api, b.storeid);
    test.skip(!shift, 'no shift is open at the store');
    const amount = 300 + (Number(run.slice(-3)) % 600) + 0.75;
    await api.request('POST', '/store-cash/ledger', { storeid: b.storeid, category: 'EXPENSE', expensecategory: 'LOGISTICS', withdraw: amount, description: `Auto fare ${run}`, shiftid: shift.id }, COUNTER);
    const r = await manage(api, b.saleid, { status: 'Delivered', actualcost: amount, costpaid: { via: 'CASH' } });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(r.body.costwarning).toMatch(/already 1 recorded expense/);
    // nothing is blocked: it is posted, and the person has been told
    expect((await deliveryOf(api, b.saleid)).costpaidvia).toBe('CASH');
  });
});
