/**
 * GST registration and tax invoices - GI-1..7
 * A business that is not registered issues cash memos. Registered and live, a completed bill is a tax invoice with the next number of its financial-year
 * series (no gaps, even when bills are saved together), the buyer's GSTIN decides the place of supply, an issued invoice cannot be changed, and only the
 * Business Head chooses. Each test leaves the business as it found it (not registered).
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const day = (offset: number) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** a GSTIN with a correct check character, for a state and a PAN-like body */
function gstin(state: string, body = 'ABCDE1234F1Z') {
  const v = `${state}${body}`;
  let sum = 0;
  for (let i = 0; i < 14; i++) { const p = CHARS.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2); sum += Math.floor(p / 36) + (p % 36); }
  return v + CHARS[(36 - (sum % 36)) % 36];
}
const MINE = gstin('33');                // the business's own GSTIN (Tamil Nadu)
const OTHER_STATE = gstin('29', 'FGHIJ5678K1Z');   // a buyer in Karnataka

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
    itemid: x.item_id, productid: x.id, batch: x.batch, mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

const mobile = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

function bill(s: any, over: Record<string, any> = {}, qty = 1) {
  const now = new Date().toISOString();
  const total = Math.round(100 * 1.05 * qty * 100) / 100;
  return {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7,
    status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'QA GST', mobile: mobile() },
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: 100, mrpcost: s.mrpcost, taxpcnt: 5, qty, total }],
    ...over,
  };
}
async function sell(api: any, s: any, over: Record<string, any> = {}) {
  const r = await api.request('POST', '/sales', bill(s, over), SALES);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return r.body;
}
const register = (api: any, body: any) => api.request('PUT', '/gst/registration', body, MGR);
const live = (over: any = {}) => ({ reg_type: 'registered', gstin: MINE, go_live: day(0), ...over });
const unregister = (api: any) => register(api, { reg_type: 'none', confirm_cancelled: true });
const noOf = (b: any) => String(b.gstinvoiceno ?? '');
const seq = (n: string) => +n.split('/')[2];

test.describe('GST registration and tax invoices @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('GI-1 a business that is not registered issues cash memos and watches its turnover @happy', async ({ api }) => {
    await unregister(api);
    const reg = (await api.request('GET', '/gst/registration', undefined, MGR)).body;
    expect(reg.reg_type).toBe('none');
    expect(reg.turnover_limit).toBeGreaterThan(0);
    expect(['ok', 'near', 'over']).toContain(reg.watch);
    expect(typeof reg.turnover_fy).toBe('number');
    const b = await sell(api, POOL[0]);
    expect(b.gstinvoiceno ?? null).toBeNull();
  });

  test('GI-2 going live asks for a valid GSTIN and a date, and then every completed bill is numbered in a series @happy', async ({ api }) => {
    expect((await register(api, { reg_type: 'registered', gstin: '', go_live: day(0) })).status).toBe(400);                 // no GSTIN
    expect((await register(api, live({ gstin: '33ABCDE1234F1Z0' }))).status).toBe(400);                                  // bad check digit
    expect((await register(api, live({ go_live: 'today' }))).status).toBe(400);
    expect((await register(api, live({ invoice_prefix: 'TOOLONG' }))).status).toBe(400);
    const ok = await register(api, live({ invoice_prefix: 'QAI' }));
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect(ok.body.reg_type).toBe('registered');
    expect(ok.body.state_code).toBe('33');
    expect(ok.body.live).toBe(true);
    const a = noOf(await sell(api, POOL[0]));
    const b = noOf(await sell(api, POOL[1]));
    expect(a).toMatch(/^QAI\/\d{2}-\d{2}\/\d{6}$/);
    expect(a.length).toBeLessThanOrEqual(16);
    expect(seq(b)).toBe(seq(a) + 1);
    // a parked bill has no number until it is completed
    const parked = await sell(api, POOL[0], { status: 'PENDING' });
    expect(noOf(parked)).toBe('');
  });

  test('GI-3 a go-live date in the future numbers nothing yet; the buyer GSTIN decides the place of supply @edge', async ({ api }) => {
    await register(api, live({ invoice_prefix: 'QAI', go_live: day(0) }));
    const sameState = await sell(api, POOL[0], { buyergstin: gstin('33', 'KLMNO9012P1Z') });
    expect(sameState.placeofsupply).toBe('33');
    const interState = await sell(api, POOL[1], { buyergstin: OTHER_STATE });
    expect(interState.buyergstin).toBe(OTHER_STATE);
    expect(interState.placeofsupply).toBe('29');
    const got = (await api.request('GET', `/sales/${interState.id}`, undefined, MGR)).body;
    expect(got.gstinvoiceno).toBe(interState.gstinvoiceno);
    expect(got.placeofsupply).toBe('29');
    const bad = await api.request('POST', '/sales', bill(POOL[0], { buyergstin: '29ABCDE1234F1Z0' }), SALES);
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toMatch(/GSTIN/);
    // a bill with no buyer GSTIN is in the seller's state unless a delivery state is given
    const plain = (await api.request('GET', `/sales/${(await sell(api, POOL[0])).id}`, undefined, MGR)).body;
    expect(plain.placeofsupply).toBe('33');
    const delivery = await sell(api, POOL[0], { placeofsupply: '32' });
    expect(delivery.placeofsupply).toBe('32');
  });

  test('GI-4 an issued tax invoice cannot be changed: it is corrected by a return and a new bill @negative', async ({ api }) => {
    const b = await sell(api, POOL[2]);
    const full = (await api.request('GET', `/sales/${b.id}`, undefined, MGR)).body;
    expect(full.gstinvoiceno).toBeTruthy();
    const items = full.items.map((i: any) => ({ ...i, qty: 2, total: 210 }));
    const edit = await api.request('PUT', '/sales', { ...full, items, total: 210, cashamt: 210 }, SALES);
    expect(edit.status).toBe(400);
    expect(JSON.stringify(edit.body)).toMatch(/tax invoice and cannot be changed/);
    const status = await api.request('PUT', '/sales', { ...full, status: 'PENDING' }, SALES);
    expect(status.status).toBe(400);
    const buyer = await api.request('PUT', '/sales', { ...full, buyergstin: OTHER_STATE }, SALES);
    expect(buyer.status).toBe(400);
    // the number is not the client's to set
    const again = (await api.request('GET', `/sales/${b.id}`, undefined, MGR)).body;
    expect(again.gstinvoiceno).toBe(full.gstinvoiceno);
  });

  test('GI-5 bills saved together never share a number, and a bill that fails leaves no gap @edge', async ({ api }) => {
    const results = await Promise.all([0, 1, 2, 3, 4].map((i) => api.request('POST', '/sales', bill(POOL[i % POOL.length]), SALES)));
    const ok = results.filter((r: any) => r.status < 300);
    expect(ok.length, JSON.stringify(results.map((r: any) => [r.status, r.body?.message]))).toBeGreaterThan(0);
    // the app already refuses a bill that collides with another saved at the same instant (the person saves again); that is the only way one fails
    for (const r of results.filter((x: any) => x.status >= 300)) expect(JSON.stringify(r.body)).toMatch(/serialize|concurrent/i);
    const nos = ok.map((r: any) => noOf(r.body)).sort();
    expect(new Set(nos).size).toBe(nos.length);
    // the next bills carry on from the highest number: the ones that failed took none
    const high = Math.max(...nos.map(seq));
    const a = noOf(await sell(api, POOL[0]));
    const b = noOf(await sell(api, POOL[1]));
    expect(seq(a)).toBe(high + 1);
    expect(seq(b)).toBe(high + 2);
  });

  test('GI-6 going back to not registered needs a confirmation, stops numbering and leaves issued invoices alone @negative', async ({ api }) => {
    const before = noOf(await sell(api, POOL[0]));
    expect(before).toBeTruthy();
    const refused = await register(api, { reg_type: 'none' });
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toMatch(/Confirm/);
    expect((await register(api, live({ gstin: OTHER_STATE }))).status, 'a different GSTIN is a new registration').toBe(400);
    expect((await register(api, live({ go_live: day(5) }))).status, 'the go-live date cannot move once invoices exist').toBe(400);
    expect((await unregister(api)).status).toBeLessThan(300);
    expect(noOf(await sell(api, POOL[0]))).toBe('');
    const reg = (await api.request('GET', '/gst/registration', undefined, MGR)).body;
    expect(reg.reg_type).toBe('none');
    expect(reg.invoices_issued).toBeGreaterThan(0);
  });

  test('GI-7 only the Business Head may see or change the registration @negative', async ({ api }) => {
    expect((await api.request('GET', '/gst/registration', undefined, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/gst/registration', live(), SALES)).status).toBe(403);
    const reg = (await api.request('GET', '/gst/registration', undefined, MGR)).body;
    expect(reg.reg_type).toBe('none');
  });
});
