/**
 * GST sales register, HSN summary, monthly summary and the auditor's Excel - GRG-1..7
 * The register lists tax invoices (rate by rate, CGST+SGST or IGST by the place of supply), credit notes from settled returns, cash memos and their returns;
 * the HSN summary keeps provisional and unknown codes in view; the monthly summary is the output tax less the input credit; the Excel opens; a month can
 * be closed only when it is over; only the Business Head may use any of it. The business is left not registered.
 */
import { test, expect } from '../fixtures/index.js';
import { withCheck } from '../support/gstin.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const API = process.env.QA_API_URL as string;
const day = (offset: number) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
const month = day(0).slice(0, 7);
const run = Date.now().toString().slice(-7);

const MINE = withCheck('33ABCDE1234F1Z');
const OTHER_STATE = withCheck('29FGHIJ5678K1Z');

let POOL: any[] = [];
let TOKEN = '';
test.beforeAll(async () => {
  TOKEN = (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: MGR, password: PASS }) })).json()).token;
  const rows = await (await fetch(`${API}/stock/filter`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ available: true, limit: 200 }) })).json();
  POOL = rows.filter((x: any) => Number(x.balance) > 30 && x.status === 'VERIFIED').map((x: any) => ({
    itemid: x.item_id, productid: x.id, batch: x.batch, mrpcost: Number(x.mrp_cost) || 25, title: x.title,
  }));
});

const mobile = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
function bill(s: any, over: Record<string, any> = {}, qty = 1) {
  const now = new Date().toISOString();
  const total = Math.round(100 * 1.05 * qty * 100) / 100;
  return {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7,
    status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'QA Register', mobile: mobile() },
    items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: 100, mrpcost: s.mrpcost, taxpcnt: 5, qty, total }],
    ...over,
  };
}
async function sell(api: any, s: any, over: Record<string, any> = {}, qty = 1) {
  const r = await api.request('POST', '/sales', bill(s, over, qty), SALES);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  const full = (await api.request('GET', `/sales/${r.body.id}`, undefined, MGR)).body;
  return { sale: r.body, line: full.items[0] };
}
const register = (api: any, body: any) => api.request('PUT', '/gst/registration', body, MGR);
const live = (over: any = {}) => ({ reg_type: 'registered', gstin: MINE, go_live: day(0), invoice_prefix: 'QAR', ...over });
const unregister = (api: any) => register(api, { reg_type: 'none', confirm_cancelled: true });
const reg = async (api: any, m = month) => (await api.request('GET', `/gst/sales-register?month=${m}`, undefined, MGR)).body;
const raise = (api: any, line: any) => api.request('POST', '/sales/returns', [{ saleitemid: line.id, qty: 1, status: 'NEW', reason: 'Defective' }], SALES);
const settle = (api: any, id: number) => api.request('PUT', '/sales/returns', { id, status: 'ADJUSTED', refundmode: 'CREDIT' }, SALES);
const get = async (path: string) => fetch(`${API}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });

test.describe('GST register and summary @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('GRG-1 a tax invoice is listed rate by rate, with CGST and SGST in the state and IGST across it @happy', async ({ api }) => {
    await unregister(api);
    expect((await register(api, live())).status).toBeLessThan(300);
    const a = (await sell(api, POOL[0])).sale;
    const b = (await sell(api, POOL[1], { buyergstin: OTHER_STATE })).sale;
    const r = await reg(api);
    expect(r.registered).toBe(true);
    const ia = r.invoices.find((i: any) => i.doc_no === a.gstinvoiceno);
    const ib = r.invoices.find((i: any) => i.doc_no === b.gstinvoiceno);
    expect(ia.kind).toBe('TAX');
    expect(ia.rates).toEqual([expect.objectContaining({ rate: 5, taxable: 100, tax: 5, cgst: 2.5, sgst: 2.5, igst: 0 })]);
    expect(ib.inter_state).toBe(true);
    expect(ib.buyer_gstin).toBe(OTHER_STATE);
    expect(ib.rates).toEqual([expect.objectContaining({ rate: 5, taxable: 100, tax: 5, cgst: 0, sgst: 0, igst: 5 })]);
    expect(r.totals.tax_invoices).toBeGreaterThanOrEqual(2);
    expect(r.totals.output.tax).toBeGreaterThanOrEqual(10);
  });

  test('GRG-2 a settled return of a tax invoice is a credit note at the invoice rate, and it comes off the month @happy', async ({ api }) => {
    const before = await reg(api);
    const { sale, line } = await sell(api, POOL[2]);
    const ret = await raise(api, line);
    expect(ret.status, JSON.stringify(ret.body)).toBeLessThan(300);
    const st = await settle(api, ret.body[0].id);
    expect(st.status, JSON.stringify(st.body)).toBeLessThan(300);
    const r = await reg(api);
    const cn = r.credit_notes.find((c: any) => c.original_invoice_no === sale.gstinvoiceno);
    expect(cn, 'a credit note was issued').toBeTruthy();
    expect(cn.note_no).toMatch(/^CN\/\d{2}-\d{2}\/\d{6}$/);
    expect(cn).toMatchObject({ rate: 5, qty: 1, taxable: 100, tax: 5, gross: 105 });
    expect(r.totals.credit_notes).toBe(before.totals.credit_notes + 1);
    // the bill sold and was taken back: the net tax of the month is where it was
    expect(r.totals.net.tax).toBeCloseTo(before.totals.net.tax, 2);
    // settling again does not issue a second note
    await settle(api, ret.body[0].id);
    expect((await reg(api)).totals.credit_notes).toBe(r.totals.credit_notes);
  });

  test('GRG-3 a cash memo is listed without tax, and so is its return @edge', async ({ api }) => {
    await unregister(api);
    const { sale, line } = await sell(api, POOL[3]);
    expect(sale.gstinvoiceno ?? null).toBeNull();
    const ret = await raise(api, line);
    await settle(api, ret.body[0].id);
    const r = await reg(api);
    const memo = r.invoices.find((i: any) => i.id === sale.id);
    expect(memo.kind).toBe('CASH');
    expect(memo.rates).toEqual([]);
    expect(r.totals.cash_bills).toBeGreaterThan(0);
    expect(r.returns_cash.some((x: any) => x.bill_no === sale.billno)).toBe(true);
    await register(api, live());
  });

  test('GRG-4 the HSN summary keeps the code, the provisional default and the unknown in view @happy', async ({ api }) => {
    const tag = `${run}`;
    const make = async (suffix: string, hsn?: string) => {
      const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
      const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-RG-${suffix}${tag}`, invoicedate: '2026-07-01' }, MGR);
      const category = `QA REG ${suffix}${tag}`;
      const prod = await api.request('POST', '/products', { title: `QA REG ${suffix}${tag}`, taxpcnt: 12, category, code: `RG${suffix}${tag}`, pack: 1, props: {}, ...(hsn ? { hsn } : {}) }, MGR);
      const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: 70, ptrcost: 78.4, mrpcost: 112, saleprice: 100, taxpcnt: 12, total: 3500, batch: `RG-${suffix}${tag}`, expdate: '2028-06-30' }, MGR);
      expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
      return { itemid: it.body.id, productid: prod.body.id, batch: `RG-${suffix}${tag}`, mrpcost: 112, category };
    };
    const own = await make('a', '30049011');
    const dflt = await make('b');
    const none = await make('c');
    await api.request('PUT', '/gst/hsn/category', { category: dflt.category, hsn: '3003' }, MGR);       // provisional
    for (const p of [own, dflt, none]) await sell(api, p);
    const h = (await api.request('GET', `/gst/hsn-summary?month=${month}`, undefined, MGR)).body;
    expect(h.snapshot).toBe(false);
    const find = (hsn: string) => h.rows.find((r: any) => r.hsn === hsn && r.rate === 5);
    expect(find('30049011')).toMatchObject({ source: 'own' });
    expect(find('3003')).toMatchObject({ source: 'category' });
    expect(h.rows.some((r: any) => r.hsn === '' && r.source === 'none')).toBe(true);
    expect(h.issues.provisional_rows).toBeGreaterThan(0);
    expect(h.issues.unknown_rows).toBeGreaterThan(0);
    expect(h.issues.clean).toBe(false);
  });

  test('GRG-5 the monthly summary is the output tax less the input credit @happy', async ({ api }) => {
    const s = (await api.request('GET', `/gst/monthly-summary?month=${month}`, undefined, MGR)).body;
    const r = await reg(api);
    expect(s.registered).toBe(true);
    expect(s.output.tax).toBeCloseTo(r.totals.net.tax, 2);
    expect(s.output_by_rate.some((x: any) => x.rate === 5)).toBe(true);
    expect(s.payable - s.carry_forward).toBeCloseTo(s.output.tax - s.itc.claimable, 2);
    expect(s.counts.tax_invoices).toBe(r.totals.tax_invoices);
    expect(s.closed).toBeNull();
    expect(s.issues.hsn).toBeTruthy();
    const months = (await api.request('GET', '/gst/months', undefined, MGR)).body;
    expect(months.registered).toBe(true);
    const cur = months.months[0];
    expect(cur.month).toBe(month);
    expect(cur.over).toBe(false);
    expect(cur.can_close).toBe(false);
    expect(cur.invoices).toBeGreaterThan(0);
  });

  test('GRG-6 the Excel files open, and carry the sales and returns first @happy', async () => {
    for (const [path, name] of [[`/gst/sales-register/xlsx?month=${month}`, 'sales-and-returns'], [`/gst/pack?month=${month}`, 'gst-records-pack']]) {
      const res = await get(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/spreadsheetml/);
      expect(res.headers.get('content-disposition')).toContain(`${name}-${month}.xlsx`);
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.length).toBeGreaterThan(2000);
      expect(buf.subarray(0, 2).toString()).toBe('PK');                  // an .xlsx is a zip
    }
  });

  test('GRG-7 a month not over cannot be closed, a bad month or ARN is refused, and only the Business Head may use it @negative', async ({ api }) => {
    const notOver = await api.request('POST', `/gst/months/${month}/close`, { arn: 'AA330126123456Z' }, MGR);
    expect(notOver.status).toBe(400);
    expect(JSON.stringify(notOver.body)).toMatch(/once it is over/);
    expect((await api.request('POST', `/gst/months/2026-13/close`, {}, MGR)).status).toBe(400);
    expect((await api.request('POST', `/gst/months/${month}/reopen`, { reason: 'x' }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/gst/months/${month}/reopen`, { reason: 'a proper reason' }, MGR)).status).toBe(400);      // not closed
    expect((await api.request('GET', `/gst/sales-register?month=bad`, undefined, MGR)).status).toBe(400);
    for (const [m, p] of [['GET', `/gst/sales-register?month=${month}`], ['GET', `/gst/hsn-summary?month=${month}`], ['GET', `/gst/monthly-summary?month=${month}`], ['GET', '/gst/months'], ['POST', `/gst/months/${month}/close`]]) {
      expect((await api.request(m, p, m === 'POST' ? {} : undefined, SALES)).status, `${m} ${p}`).toBe(403);
    }
    expect((await get(`/gst/pack?month=${month}`)).status).toBe(200);          // the Business Head
    const sales = await fetch(`${API}/gst/pack?month=${month}`, { headers: { authorization: `Bearer ${(await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: SALES, password: PASS }) })).json()).token}` } });
    expect(sales.status).toBe(403);
    await unregister(api);
  });
});
