/**
 * GST demo data for the local stack: registers the business for GST (as of today) and leaves a month's worth of tax invoices that exercise the GSTR-1
 * export (B2B, consumer sales and nil-rated) (GST > Monthly summary > GSTR-1 JSON): consumer sales at 5, 12 and 18%, an inter-state consumer sale, B2B sales (in-state and inter-state),
 * 0% sales (nil-rated and exempt), and credit notes from settled returns (one off a consumer bill, two off B2B bills).
 *
 *   node seed/gst-demo.mjs            (QA_API_URL defaults to http://localhost:3000; password admin123)
 *
 * Test data only: the GSTINs are generated with a valid check character and belong to no one. Safe to run more than once; each run adds more bills.
 * To undo the registration: PUT /gst/registration { reg_type: 'none', confirm_cancelled: true } (the invoices stay, as they must).
 */
const API = process.env.QA_API_URL || 'http://localhost:3000';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const MGR = 'businesshead@local.test', SALES = 'sales1@local.test';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const withCheck = (f14) => {
  let sum = 0;
  for (let i = 0; i < 14; i++) { const p = CHARS.indexOf(f14[i]) * (i % 2 === 0 ? 1 : 2); sum += Math.floor(p / 36) + (p % 36); }
  return f14 + CHARS[(36 - (sum % 36)) % 36];
};
const MINE = withCheck('33ABCDE1234F1Z');
const BUYER_IN = withCheck('33PQRST6789U1Z');      // a registered buyer in the same state
const BUYER_OUT = withCheck('29FGHIJ5678K1Z');     // a registered buyer in Karnataka

const login = async (email) => (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASS }) })).json()).token;
const tokens = { [MGR]: await login(MGR), [SALES]: await login(SALES) };
const call = async (who, method, path, body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[who]}` }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
  return { status: r.status, body: b };
};
const must = (r, what) => { if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.body)}`); return r.body; };

const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const run = Date.now().toString().slice(-6);
const mobile = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

// 1. registered for GST as of today
const cur = (await call(MGR, 'GET', '/gst/registration')).body;
if (cur.reg_type !== 'registered') must(await call(MGR, 'PUT', '/gst/registration', { reg_type: 'registered', gstin: MINE, go_live: today, invoice_prefix: 'DEM' }), 'register');
console.log('registered for GST:', (await call(MGR, 'GET', '/gst/registration')).body.gstin);

// 2. stock to sell: existing verified stock at 5, 12 and 18%, and two new 0% products (one category the CA calls exempt)
const stock = must(await call(MGR, 'POST', '/stock/filter', { available: true, limit: 400 }), 'stock').filter((x) => Number(x.balance) > 30 && x.status === 'VERIFIED');
const at = (rate) => stock.filter((x) => Number(x.tax_pcnt) === rate);
const vendor = must(await call(MGR, 'GET', '/vendors'), 'vendors')[0].id;
async function zeroRated(suffix, category) {
  const inv = must(await call(MGR, 'POST', '/purchases', { vendorid: vendor, invoiceno: `DEM-${suffix}${run}`, invoicedate: today }), 'purchase');
  const prod = must(await call(MGR, 'POST', '/products', { title: `Demo ${suffix} 0% ${run}`, taxpcnt: 0, category, code: `DM${suffix}${run}`, pack: 1, props: {} }), 'product');
  const it = must(await call(MGR, 'POST', '/purchaseitems', { invoiceid: inv.id, productid: prod.id, qty: 50, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 0, total: 3500, batch: `DM-${suffix}${run}`, expdate: '2028-06-30' }), 'purchase item');
  return { item_id: it.id, id: prod.id, batch: `DM-${suffix}${run}`, mrp_cost: 100, tax_pcnt: 0, category };
}
const nilItem = await zeroRated('N', `DEMO NIL ${run}`);
const exemptItem = await zeroRated('E', `DEMO EXEMPT ${run}`);
must(await call(MGR, 'PUT', '/gst/supply-kinds', { category: exemptItem.category, kind: 'EXEMPT' }), 'supply kind');

async function sell(s, rate, over = {}, qty = 1) {
  const now = new Date().toISOString();
  const total = Math.round(100 * (1 + rate / 100) * qty * 100) / 100;
  const body = {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'Demo customer', mobile: mobile() },
    items: [{ itemid: s.item_id, productid: s.id, batch: s.batch, price: 100, mrpcost: Number(s.mrp_cost) || 100, taxpcnt: rate, qty, total }], ...over,
  };
  const sale = must(await call(SALES, 'POST', '/sales', body), `sale at ${rate}%`);
  const full = (await call(MGR, 'GET', `/sales/${sale.id}`)).body;
  return { sale, line: full.items[0] };
}

// 3. the bills
const made = [];
for (const [rate, n] of [[5, 3], [12, 3], [18, 2]]) for (let i = 0; i < n; i++) made.push(['consumer', rate, await sell(at(rate)[i], rate)]);
made.push(['consumer, inter-state (Karnataka)', 12, await sell(at(12)[4], 12, { placeofsupply: '29' })]);
made.push(['B2B, in-state', 12, await sell(at(12)[5], 12, { buyergstin: BUYER_IN })]);
made.push(['B2B, inter-state', 5, await sell(at(5)[4], 5, { buyergstin: BUYER_OUT })]);
made.push(['nil-rated, consumer', 0, await sell(nilItem, 0, {}, 2)]);
made.push(['exempt, consumer', 0, await sell(exemptItem, 0)]);
made.push(['nil-rated, B2B', 0, await sell(nilItem, 0, { buyergstin: BUYER_IN })]);

// 4. settled returns: a credit note at the bill's own rate. A consumer bill's note comes off the consumer sales; a B2B bill's note is listed as a credit note.
for (const [kind, rate] of [['consumer', 18], ['B2B, in-state', 12], ['B2B, inter-state', 5]]) {
  const back = made.find(([k, r]) => k === kind && r === rate)[2];
  const ret = must(await call(SALES, 'POST', '/sales/returns', [{ saleitemid: back.line.id, qty: 1, status: 'NEW', reason: 'Defective' }]), 'return');
  must(await call(SALES, 'PUT', '/sales/returns', { id: ret[0].id, status: 'ADJUSTED', refundmode: 'CREDIT' }), 'settle return');
}

for (const [kind, rate, b] of made) console.log(`  ${b.sale.gstinvoiceno}  ${kind} @ ${rate}%`);
const month = today.slice(0, 7);
const p = (await call(MGR, 'GET', `/gst/gstr1-json/preview?month=${month}`)).body;
console.log(`\nGSTR-1 file for ${month}: B2B ${p.totals.b2b_invoices} invoice(s), taxable ${p.totals.b2b_taxable}, tax ${p.totals.b2b_tax}; credit notes ${p.totals.cdnr_notes}, taxable ${p.totals.cdnr_taxable}, tax ${p.totals.cdnr_tax}; consumer sales taxable ${p.totals.b2cs_taxable}, tax ${p.totals.b2cs_tax}, nil/exempt/non-GST ${p.totals.nil_total}`);
console.log('Not in the file:', p.notIncluded);
