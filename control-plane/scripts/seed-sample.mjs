#!/usr/bin/env node
/**
 * Fills a running customer's app with invented sample data (a small pharmacy: staff, vendors, products, customers, stock
 * received on invoices, two weeks of shifts and sales, a few expenses). Nothing here is real: names, numbers and shops are made up.
 * Used by scripts/demo-template-build.sh to build the demo template; it only talks to the app's public API.
 *
 *   API=http://localhost:8204/api OWNER_EMAIL=... OWNER_PASSWORD=... STAFF_PASSWORD=... node seed-sample.mjs
 */
const API = (process.env.API || 'http://localhost:3000').replace(/\/$/, '');
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || OWNER_PASSWORD;
if (!OWNER_EMAIL || !OWNER_PASSWORD) { console.error('OWNER_EMAIL and OWNER_PASSWORD are required'); process.exit(1); }

// a small repeatable generator, so every template is the same shop
let seed = 20261023;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (list) => list[Math.floor(rnd() * list.length)];
const r2 = (n) => Math.round(n * 100) / 100;
const day = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
const at = (back, hour, minute) => { const d = new Date(Date.now() - back * 86400000); d.setHours(hour, minute, 0, 0); return d.toISOString(); };

async function call(method, path, body, token, quiet = false) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (quiet) return null;
    throw new Error(`${method} ${path} -> ${res.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`.slice(0, 400));
  }
  return data;
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password, scope: 'business' })).token;

function denoms(amount) {
  let left = Math.max(0, Math.round(amount)); const rows = [];
  for (const d of [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1]) { const n = Math.floor(left / d); if (n > 0) { rows.push({ d, n }); left -= n * d; } }
  return rows.length ? rows : [{ d: 1, n: 0 }];
}

const PRODUCTS = [
  ['Paracetamol 500mg Tablet', 'Analgesic', 12, 10, 28], ['Paracetamol 650mg Tablet', 'Analgesic', 12, 15, 34], ['Ibuprofen 400mg Tablet', 'Analgesic', 12, 10, 32],
  ['Diclofenac Gel 30g', 'Analgesic', 12, 1, 96], ['Amoxicillin 500mg Capsule', 'Antibiotic', 12, 10, 118], ['Azithromycin 500mg Tablet', 'Antibiotic', 12, 3, 112],
  ['Cefixime 200mg Tablet', 'Antibiotic', 12, 10, 165], ['Ciprofloxacin 500mg Tablet', 'Antibiotic', 12, 10, 74], ['Pantoprazole 40mg Tablet', 'Antacid', 12, 15, 142],
  ['Omeprazole 20mg Capsule', 'Antacid', 12, 15, 88], ['Domperidone 10mg Tablet', 'Antacid', 12, 10, 52], ['ORS Sachet', 'Supplement', 5, 1, 22],
  ['Amlodipine 5mg Tablet', 'Antihypertensive', 12, 15, 46], ['Telmisartan 40mg Tablet', 'Antihypertensive', 12, 15, 128], ['Losartan 50mg Tablet', 'Antihypertensive', 12, 15, 82],
  ['Atenolol 50mg Tablet', 'Antihypertensive', 12, 14, 38], ['Metformin 500mg Tablet', 'Antidiabetic', 12, 20, 36], ['Glimepiride 2mg Tablet', 'Antidiabetic', 12, 10, 98],
  ['Sitagliptin 100mg Tablet', 'Antidiabetic', 12, 10, 285], ['Cetirizine 10mg Tablet', 'Antihistamine', 12, 10, 24], ['Levocetirizine 5mg Tablet', 'Antihistamine', 12, 10, 58],
  ['Montelukast 10mg Tablet', 'Respiratory', 12, 10, 172], ['Salbutamol Inhaler 100mcg', 'Respiratory', 12, 1, 156], ['Cough Syrup 100ml', 'Respiratory', 12, 1, 92],
  ['Vitamin D3 60000IU Capsule', 'Supplement', 12, 4, 118], ['Vitamin B12 Tablet', 'Supplement', 12, 15, 84], ['Calcium + D3 Tablet', 'Supplement', 12, 15, 112],
  ['Multivitamin Tablet', 'Supplement', 12, 15, 96], ['Iron + Folic Acid Tablet', 'Supplement', 12, 20, 70], ['Atorvastatin 10mg Tablet', 'Cardiac', 12, 15, 108],
  ['Rosuvastatin 10mg Tablet', 'Cardiac', 12, 15, 168], ['Clopidogrel 75mg Tablet', 'Cardiac', 12, 15, 92], ['Aspirin 75mg Tablet', 'Cardiac', 12, 14, 18],
  ['Povidone Iodine 10% 100ml', 'Dermatology', 12, 1, 74], ['Clotrimazole Cream 15g', 'Dermatology', 12, 1, 68], ['Hand Sanitiser 100ml', 'Personal care', 18, 1, 60],
  ['Digital Thermometer', 'Devices', 18, 1, 220], ['Surgical Mask Box of 50', 'Devices', 12, 1, 150],
];
const VENDORS = [['Sri Balaji Distributors', 'Mr Suresh', '9840000101'], ['Apollo Wholesale Agencies', 'Ms Lakshmi', '9840000102'], ['City Care Pharma Traders', 'Mr Imran', '9840000103']];
const FIRST = ['Anil', 'Bhavna', 'Chitra', 'Deepak', 'Esha', 'Farooq', 'Gita', 'Harish', 'Indu', 'Jagan', 'Kavya', 'Lokesh', 'Meena', 'Naveen', 'Oviya', 'Prakash', 'Revathi', 'Sanjay', 'Tara', 'Uday'];
const LAST = ['Raman', 'Iyer', 'Pillai', 'Reddy', 'Naidu', 'Khan', 'Sharma', 'Das', 'Menon', 'Rao'];
const STAFF = [['Priya Nair', 'priya.manager@demo.test', 'Store Head'], ['Arun Kumar', 'arun.sales@demo.test', 'Sales Staff'], ['Divya Menon', 'divya.sales@demo.test', 'Sales Staff']];

const owner = await login(OWNER_EMAIL, OWNER_PASSWORD);
const stores = await call('GET', '/stores', undefined, owner);
const storeId = stores[0].id;
console.log(`store ${storeId}`);

// ---- a drug licence ending in 25 days and cash due at the bank every day, so a new demo has alerts to show under the bell
await call('PUT', `/stores/${storeId}/licenses`, { licenses: [{ licensetype: 'RETAIL_20_21', number: 'TN-DEMO-2041', validfrom: day(340), validto: day(-25) }] }, owner);
await call('PUT', `/stores/${storeId}`, { location: String(stores[0].location).trim(), depositthreshold: 50000, depositschedule: 'daily' }, owner);

// ---- staff
const roles = await call('GET', '/roles', undefined, owner);
const roleId = (n) => roles.find((r) => r.name === n)?.id;
const people = {};
for (const [name, email, role] of STAFF) {
  const made = await call('POST', '/users', { fullname: name, email, password: STAFF_PASSWORD, phone: '98400' + String(int(10000, 99999)), location: 'Main Store', roleid: roleId(role), storeids: [storeId] }, owner, true);
  if (made?.id) people[email] = { id: made.id, role };
}
console.log(`staff ${Object.keys(people).length}`);
const cashiers = Object.entries(people).filter(([, p]) => p.role === 'Sales Staff').map(([email, p]) => ({ email, id: p.id }));

// ---- vendors, products, customers
const vendorIds = [];
for (const [name, contact, phone] of VENDORS) {
  const v = await call('POST', '/vendors', { name, contactname: contact, contactphone: phone, address: 'Chennai', comments: 'sample' }, owner, true);
  if (v?.id) vendorIds.push(v.id);
}
const products = [];
for (let i = 0; i < PRODUCTS.length; i++) {
  const [title, category, tax, pack, mrp] = PRODUCTS[i];
  const p = await call('POST', '/products', { title, taxpcnt: tax, category, brand: 'Sample', mfr: 'Sample Labs', hsn: '30049099', code: `S${String(i + 1).padStart(4, '0')}`, pack }, owner, true);
  if (!p?.id) continue;
  const saleprice = r2(mrp * 0.92);
  await call('POST', '/products/prices/add', { productid: p.id, saleprice, effdate: day(30), reason: 'Initial', comments: 'sample' }, owner, true);
  products.push({ id: p.id, title, tax, mrp, saleprice });
}
console.log(`vendors ${vendorIds.length}, products ${products.length}`);
const customers = [];
for (let i = 0; i < 20; i++) {
  const c = await call('POST', '/customers', { name: `${FIRST[i]} ${pick(LAST)}`, mobile: `90000${String(10000 + i * 7)}`, email: '', locality: pick(['Adyar', 'T Nagar', 'Velachery', 'Anna Nagar']), address: `${int(1, 90)}, Sample Street`, area: 'Chennai', srctype: pick(['Walk-in', 'Referral']), srcdesc: '' }, owner, true);
  if (c?.id) customers.push(c.id);
}
console.log(`customers ${customers.length}`);

// ---- stock in: one invoice per vendor, received and complete
for (let v = 0; v < vendorIds.length; v++) {
  const part = products.filter((_, i) => i % vendorIds.length === v);
  const inv = await call('POST', '/purchases', { vendorid: vendorIds[v], invoiceno: `SMP-${100 + v}`, invoicedate: day(20 - v * 3) }, owner, true);
  if (!inv?.id) continue;
  const ids = []; let total = 0;
  for (const p of part) {
    const qty = int(60, 140), ptr = r2(p.mrp * 0.62), line = r2(qty * ptr * (1 + p.tax / 100));
    total += line;
    const it = await call('POST', '/purchaseitems', { invoiceid: inv.id, productid: p.id, qty, ptrvalue: ptr, ptrcost: ptr, total: line, mrpcost: p.mrp, taxpcnt: p.tax, batch: `SB${v + 1}${p.id}`, expdate: day(-int(240, 700)), saleprice: p.saleprice }, owner, true);
    if (it?.id) ids.push(it.id);
  }
  if (ids.length) {
    await call('PUT', '/purchaseitems', { ids, values: { status: 'VERIFIED' } }, owner, true);
    await call('PUT', '/purchases/confirm', { ids: [inv.id], values: { status: 'COMPLETE', total: r2(total) } }, owner, true);
    if (v < 2) await call('POST', '/vendorpayments', { vendorid: vendorIds[v], invoiceid: inv.id, paydate: day(5), amount: r2(total * (v === 0 ? 1 : 0.5)), paymode: 'Transfer' }, owner, true);
  }
}
const pool = ((await call('POST', '/stock/filter', { available: true, limit: 400 }, owner)) || []).filter((x) => Number(x.balance) > 5).map((x) => {
  const mrp = Number(x.mrp_cost) || 25, sp = Number(x.sale_price) || r2(mrp * 0.9);
  return { itemid: x.item_id, productid: x.id, batch: x.batch, price: Math.min(sp, r2(mrp * 0.95)), mrpcost: mrp, taxpcnt: Number(x.tax_pcnt) || 12 };
});
console.log(`sellable batches ${pool.length}`);

// ---- the shop's shift templates, so opening a shift offers Morning and Evening and the sample shifts belong to them
const tplMorning = await call('POST', '/store-cash/templates', { storeid: storeId, name: 'Morning', starttime: '09:00', endtime: '14:00' }, owner, true);
const tplEvening = await call('POST', '/store-cash/templates', { storeid: storeId, name: 'Evening', starttime: '14:00', endtime: '22:00' }, owner, true);

// ---- two weeks of shifts and sales; the last shift is left open so the till works straight away
const tokens = {};
for (const c of cashiers) tokens[c.email] = await login(c.email, STAFF_PASSWORD);
const SHIFTS = 14 * 2;
let sales = 0, returns = 0;
for (let s = 0; s < SHIFTS; s++) {
  const back = Math.floor((SHIFTS - 1 - s) / 2), evening = s % 2 === 1, isLast = s === SHIFTS - 1;
  const cashier = cashiers[s % cashiers.length];
  const shift = await call('POST', '/store-cash/shifts', {
    storeid: storeId, shiftdate: day(back), name: evening ? 'Evening' : 'Morning', starttime: evening ? '14:00' : '09:00', endtime: evening ? '22:00' : '14:00',
    openingdenominations: denoms(int(10, 25) * 100), assigneduserid: cashier.id, openingchecklist: undefined,
    templateid: (evening ? tplEvening : tplMorning)?.id,
  }, owner, true);
  if (!shift?.id) continue;
  const n = int(6, 11);
  for (let i = 0; i < n; i++) {
    const lines = int(1, 3);
    const items = Array.from({ length: lines }, () => {
      const it = pick(pool), qty = int(1, 3);
      return { itemid: it.itemid, productid: it.productid, batch: it.batch, price: it.price, mrpcost: it.mrpcost, taxpcnt: it.taxpcnt, qty, total: r2(it.price * qty * (1 + it.taxpcnt / 100)) };
    });
    const total = r2(items.reduce((a, b) => a + b.total, 0));
    const digital = rnd() < 0.4 ? r2(total * (0.4 + rnd() * 0.6)) : 0;
    const when = at(back, evening ? 15 + int(0, 6) : 9 + int(0, 4), int(0, 59));
    const sale = await call('POST', '/sales', {
      customerid: pick(customers), billdate: when, orderdate: when, cashamt: r2(total - digital), digiamt: digital, digimethod: digital ? pick(['UPI', 'Card']) : null,
      digirefno: digital ? `REF${int(10000000, 99999999)}` : null, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: pick(['Walk-in', 'Walk-in', 'Phone']), deliverytype: 'Counter', storeid: storeId, items,
    }, tokens[cashier.email], true);
    if (sale?.id) {
      sales++;
      if (rnd() < 0.06 && sale.items?.length) {
        const r = await call('POST', '/sales/returns', [{ saleitemid: sale.items[0].id, qty: 1, reason: pick(['Not Effective', 'Defective', 'Prescription Change']) }], tokens[cashier.email], true);
        if (r) returns++;
      }
    }
  }
  await call('POST', '/store-cash/ledger', { storeid: storeId, shiftid: shift.id, category: 'EXPENSE', withdraw: int(40, 300), expensecategory: pick(['MISC', 'TRANSPORT']), description: pick(['Courier', 'Tea and snacks', 'Stationery', 'Cleaning']) }, tokens[cashier.email], true);
  if (!isLast) {
    const rpt = await call('GET', `/store-cash/shifts/${shift.id}/report`, undefined, owner, true);
    const expected = Number(rpt?.shift?.expectedcash ?? 0);
    await call('PUT', `/store-cash/shifts/${shift.id}/close`, { counteddenominations: denoms(Math.max(1, expected + int(-60, 40))), allowZero: true, notes: 'sample' }, owner, true);
  }
}
console.log(`sales ${sales}, returns ${returns}`);

// ---- a few expenses (only where the plan has the expenses module)
const cats = await call('GET', '/expenses/categories', undefined, owner, true);
if (Array.isArray(cats) && cats.length) {
  for (const [desc, amount] of [['Shop rent', 18000], ['Electricity', 3200], ['Staff tea and cleaning', 900]]) {
    await call('POST', '/expenses', { expense_date: day(int(1, 10)), store_id: null, category_id: pick(cats).id, amount, gst_amount: 0, pay_mode: 'BANK', payee: 'Sample', description: desc }, owner, true);
  }
}
// ---- how this shop runs: an owner with staff, one shared till per shift (what the demo is meant to show)
const preset = await call('PUT', '/businesses/mine/preset', { preset: 'owner_and_staff', shiftmode: 'time' }, owner, true);
console.log(preset ? 'preset owner_and_staff applied' : 'preset could not be applied');
console.log('SAMPLE DATA DONE');
