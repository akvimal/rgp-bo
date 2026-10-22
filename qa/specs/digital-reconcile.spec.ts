/**
 * Manual reconciliation of digital payments — RECON-1..6
 * A person compares the bills with the Paytm statement and marks each one verified, different or missing.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

let POOL: any[] = [];
let TOKEN = '';
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
  TOKEN = t;
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

/** a Paytm transaction report as Paytm writes it: every value wrapped in apostrophes */
const HEAD = ['Transaction_ID', 'Order_ID', 'Transaction_Date', 'Status', 'Transaction_Type', 'Request_Type', 'Payment_Mode', 'Amount', 'Settled_Amount', 'Settled_Date', 'Commission', 'GST', 'UTR_No.', 'RRN', 'Customer_VPA', 'Payment_Mobile_Number'];
const stamp = (d = new Date()) => d.toISOString().slice(0, 19).replace('T', ' ');
function csv(rows: { id: string; at?: Date; amount: number; status?: string; type?: string; edc?: boolean }[]) {
  const q = (v: any) => `'${v}'`;
  const body = rows.map(r => [r.id, 'ORD' + r.id.slice(-6), stamp(r.at), r.status ?? 'SUCCESS', r.type ?? 'ACQUIRING', r.edc ? 'EDC' : 'SEAMLESS_3D_FORM', 'UPI', r.amount.toFixed(2), r.amount.toFixed(2), stamp(r.at),
    '1.00', '0.18', 'UTR' + r.id.slice(-8), r.id.slice(-12), 'someone@upi', '9999999999'].map(q).join(','));
  return [HEAD.join(','), ...body].join('\n');
}
async function upload(path: string, text: string, name = 'statement.csv') {
  const f = new FormData();
  f.append('file', new Blob([text], { type: 'text/csv' }), name);
  const r = await fetch(`${process.env.QA_API_URL}/payment-recon/${path}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: f });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const uniq = () => Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
/** an amount no other bill of the day is likely to have */
const amt = (n: number) => 1000 + n * 7 + (Date.now() % 97) + 0.37;
const refNo = () => `RC${Date.now()}${Math.floor(Math.random() * 1e4)}`;
function bill(ref: string, digi: number | string = 100) {
  digi = Number(digi);
  const s = POOL[POOL.length - 2] || POOL[0];
  const now = new Date().toISOString();
  return {
    customerid: data.anyCustomer(), billdate: now, orderdate: now,
    cashamt: 0, digiamt: digi, digimethod: 'UPI', digirefno: ref,
    total: digi, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty: 1, total: digi }],
  };
}
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

test.describe('Digital payment reconciliation @p1', () => {
  test('RECON-1 a bill is verified, flagged, changed and undone; flags need a note @negative', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const ref = refNo();
    const sale = await api.request('POST', '/sales', bill(ref), CASHIER);
    expect(sale.status).toBeLessThan(300);
    const id = sale.body.id;
    const find = async () => (await api.request('GET', `/payment-recon?from=${today()}&to=${today()}&state=ALL&q=${ref}`, undefined, MGR)).body.rows.find((r: any) => r.id === id);

    expect((await find()).check_status).toBeNull();                                                          // new bills start unchecked
    expect((await api.request('POST', `/payment-recon/${id}`, { status: 'MISMATCH', amount_seen: 90 }, MGR)).status).toBe(400);   // a flag needs a note
    expect((await api.request('POST', `/payment-recon/${id}`, { status: 'MISMATCH', note: 'short' }, MGR)).status).toBe(400);     // and the amount
    expect((await api.request('POST', `/payment-recon/${id}`, { status: 'NOT_FOUND' }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/payment-recon/${id}`, { status: 'MISMATCH', amount_seen: 90, note: 'statement shows 90' }, MGR)).status).toBeLessThan(300);
    const m = await find();
    expect(m.check_status).toBe('MISMATCH'); expect(m.amount_seen).toBe(90); expect(m.note).toBe('statement shows 90');

    expect((await api.request('POST', `/payment-recon/${id}`, { status: 'VERIFIED' }, MGR)).status).toBeLessThan(300);
    const v = await find();
    expect(v.check_status).toBe('VERIFIED'); expect(v.amount_seen).toBe(100); expect(v.note).toBeNull();      // verified means the full amount

    expect((await api.request('DELETE', `/payment-recon/${id}`, undefined, MGR)).status).toBeLessThan(300);
    expect((await find()).check_status).toBeNull();
    expect((await api.request('POST', '/payment-recon/999999999', { status: 'VERIFIED' }, MGR)).status).toBe(404);
  });

  test('RECON-2 many bills verify at once; the counts and the day total follow @p1', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const ids: number[] = [];
    for (let i = 0; i < 2; i++) {
      const s = await api.request('POST', '/sales', bill(refNo(), 50), CASHIER);
      expect(s.status).toBeLessThan(300);
      ids.push(s.body.id);
    }
    const before = (await api.request('GET', `/payment-recon?from=${today()}&to=${today()}&state=ALL`, undefined, MGR)).body;
    const r = await api.request('POST', '/payment-recon/verify-many', { sale_ids: ids }, MGR);
    expect(r.status).toBeLessThan(300); expect(r.body.verified).toBe(2);
    const after = (await api.request('GET', `/payment-recon?from=${today()}&to=${today()}&state=ALL`, undefined, MGR)).body;
    expect(after.summary.verified.count - before.summary.verified.count).toBe(2);
    expect(after.summary.pending.count).toBe(before.summary.pending.count - 2);
    expect(after.summary.amount).toBe(before.summary.amount);                                                // checking never changes the system total
    expect(after.days.find((d: any) => d.date === today()).amount).toBeCloseTo(after.summary.amount, 2);
    expect((await api.request('POST', '/payment-recon/verify-many', { sale_ids: [] }, MGR)).status).toBe(400);
  });

  test('RECON-3 a cashier cannot see or mark payments @negative', async ({ api }) => {
    expect((await api.request('GET', '/payment-recon', undefined, CASHIER)).status).toBe(403);
    expect((await api.request('POST', '/payment-recon/1', { status: 'VERIFIED' }, CASHIER)).status).toBe(403);
  });

  test('RECON-4 the page: check a bill, flag another, undo @p1', async ({ app, api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const a = await api.request('POST', '/sales', bill(refNo(), 70), CASHIER);
    const b = await api.request('POST', '/sales', bill(refNo(), 80), CASHIER);
    const { page } = await app.open(MGR, '/secure/digital-payments');
    await page.getByTestId('dp-from').fill(today());
    await page.getByTestId('dp-to').fill(today());
    await page.getByTestId('dp-load').click();

    await page.getByTestId(`dp-verify-${a.body.id}`).click();
    await expect(page.getByTestId('dp-message')).toBeVisible();
    await page.getByTestId(`dp-differs-${b.body.id}`).click();
    await page.getByTestId('dp-flag-save').click();                                                          // no note yet: refused
    await expect(page.getByTestId('dp-error')).toBeVisible();
    await page.getByTestId('dp-flag-amount').fill('75');
    await page.getByTestId('dp-flag-note').fill('statement shows 75');
    await page.getByTestId('dp-flag-save').click();
    await expect(page.getByTestId('dp-message')).toHaveText('Saved.');

    await page.getByTestId('dp-tab-all').click();
    await expect(page.getByTestId(`dp-status-${a.body.id}`)).toHaveText('Verified');
    await expect(page.getByTestId(`dp-status-${b.body.id}`)).toHaveText('Amount differs');
    await page.getByTestId(`dp-undo-${b.body.id}`).click();
    await expect(page.getByTestId(`dp-status-${b.body.id}`)).toHaveText('To check');
  });

  test('RECON-5 a statement is read, bills are suggested payments, and accepting links them @p1', async ({ api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const tid = (last4: string) => `99${uniq()}${last4}`;
    const a1 = amt(1), a2 = amt(2), a3 = amt(3), a4 = amt(4);
    const sure = await api.request('POST', '/sales', bill('4821', a1), CASHIER);                          // the typed digits agree
    const likely = await api.request('POST', '/sales', bill('', a2), CASHIER);                            // no digits: amount and time only
    const wrong = await api.request('POST', '/sales', bill('9999', a3), CASHIER);                         // digits typed and they disagree
    for (const r of [sure, likely, wrong]) expect(r.status).toBeLessThan(300);

    const text = csv([
      { id: tid('4821'), amount: a1 },
      { id: tid('0077'), amount: a2 },
      { id: tid('1111'), amount: a3 },
      { id: 'X' + uniq() + '5555', amount: a4, edc: true },                                               // a payment with no bill
      { id: 'F' + uniq() + '6666', amount: 55.5, status: 'FAILURE' },                                     // left out
      { id: 'R' + uniq() + '7777', amount: 66.5, type: 'REFUND' },                                        // left out
    ]);
    const pre = await upload('statements/preview', text);
    expect(pre.status).toBeLessThan(300);
    expect(pre.body.kept).toBe(4); expect(pre.body.left_out.failed).toBe(1); expect(pre.body.left_out.other).toBe(1);
    expect(pre.body.card).toBe(1); expect(pre.body.new).toBe(4);
    expect(JSON.stringify(pre.body)).not.toContain('9999999999');                                       // no phone numbers come back
    const saved = await upload('statements', text);
    expect(saved.status).toBeLessThan(300); expect(saved.body.kept).toBe(4);
    const again = await upload('statements', text);                                                       // the same file twice adds nothing
    expect(again.body.kept).toBe(0); expect(again.body.duplicates).toBe(4);

    const day = today();
    const view = async () => (await api.request('GET', `/payment-recon?from=${day}&to=${day}&state=ALL`, undefined, MGR)).body;
    let v = await view();
    const row = (x: any, i: number) => x.rows.find((r: any) => r.id === i);
    expect(row(v, sure.body.id).suggestion.level).toBe('SURE');
    expect(row(v, likely.body.id).suggestion.level).toBe('LIKELY');
    expect(row(v, wrong.body.id).suggestion).toBeNull();                                                  // a disagreement is left to the person
    expect(v.unbilled.some((u: any) => Math.abs(u.amount - a4) < 0.01 && u.kind === 'CARD')).toBe(true);
    expect(v.hasStatement).toBe(true);
    expect(v.days.find((d: any) => d.date === day).statement_count).toBeGreaterThanOrEqual(4);

    const sureOnly = await api.request('POST', '/payment-recon/accept', { from: day, to: day, level: 'SURE' }, MGR);
    expect(sureOnly.status).toBeLessThan(300);
    v = await view();
    expect(row(v, sure.body.id).check_status).toBe('VERIFIED');
    expect(row(v, likely.body.id).check_status).toBeNull();                                               // only the sure one was taken
    const rest = await api.request('POST', '/payment-recon/accept', { from: day, to: day, level: 'ALL' }, MGR);
    expect(rest.status).toBeLessThan(300);
    v = await view();
    expect(row(v, likely.body.id).check_status).toBe('VERIFIED');
    expect(row(v, wrong.body.id).check_status).toBeNull();

    for (const s of (await api.request('GET', '/payment-recon/statements', undefined, MGR)).body) await api.request('DELETE', `/payment-recon/statements/${s.id}`, undefined, MGR);
    v = await view();
    expect(row(v, sure.body.id).check_status).toBe('VERIFIED');                                           // removing a statement keeps the checks
    expect(v.hasStatement).toBe(false);
  });

  test('RECON-6 a bad or unauthorised statement is refused @negative', async ({ api }) => {
    expect((await upload('statements/preview', 'a,b\n1,2')).status).toBe(400);                           // not a Paytm report
    expect((await upload('statements/preview', csv([{ id: 'F' + uniq(), amount: 10, status: 'FAILURE' }]))).status).toBe(400);   // nothing successful
    expect((await upload('statements/preview', '')).status).toBe(400);
    const f = new FormData();
    f.append('file', new Blob([csv([{ id: uniq(), amount: 10 }])], { type: 'text/csv' }), 's.csv');
    const cashierToken = (await api.request('POST', '/auth/login', { email: CASHIER, password: process.env.QA_ADMIN_PASS || 'admin123' })).body.token;
    const r = await fetch(`${process.env.QA_API_URL}/payment-recon/statements`, { method: 'POST', headers: { authorization: `Bearer ${cashierToken}` }, body: f });
    expect(r.status).toBe(403);
  });

  test('RECON-7 the page: upload a statement, accept the sure match @p1', async ({ app, api }) => {
    test.skip(!POOL.length, 'no stock to sell');
    const a = amt(5);
    const bill1 = await api.request('POST', '/sales', bill('3355', a), CASHIER);
    expect(bill1.status).toBeLessThan(300);
    const { page } = await app.open(MGR, '/secure/digital-payments');
    await page.getByTestId('dp-upload-toggle').click();
    await page.getByTestId('dp-file').setInputFiles({ name: 'sep.csv', mimeType: 'text/csv', buffer: Buffer.from(csv([{ id: 'U' + uniq() + '003355', amount: a }])) });
    await expect(page.getByTestId('dp-preview')).toContainText('1 new');
    await page.getByTestId('dp-upload-save').click();
    await expect(page.getByTestId('dp-message')).toContainText('1 payment');
    await expect(page.getByTestId(`dp-suggestion-${bill1.body.id}`)).toContainText('Sure');
    await page.getByTestId(`dp-accept-${bill1.body.id}`).click();
    await page.getByTestId('dp-tab-all').click();
    await expect(page.getByTestId(`dp-status-${bill1.body.id}`)).toHaveText('Verified');
    for (const s of (await api.request('GET', '/payment-recon/statements', undefined, MGR)).body) await api.request('DELETE', `/payment-recon/statements/${s.id}`, undefined, MGR);
  });
});
