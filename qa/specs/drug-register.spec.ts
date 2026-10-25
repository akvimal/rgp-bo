/**
 * Drug register (pharmacy pack) — DREG-1..5
 * A bill with a Schedule H, H1 or X drug needs the patient and the prescriber before it is completed; completing it writes numbered register lines;
 * the prescriber is kept for the next bill; a changed bill supersedes its lines; the register is read and printed by the people who run the shop;
 * and the whole thing switches off with the module.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const STORE_HEAD = 'storehead@local.test';
const API = process.env.QA_API_URL as string;
const run = Date.now().toString().slice(-7);

const GOOD = { patient_name: `QA PATIENT ${run}`, patient_address: '12 Main Road, Anytown', patient_age: '42', prescriber_name: `DR QA ${run}`, prescriber_reg_no: `TN${run}`, prescriber_address: 'QA Clinic, High Street' };

/** a fresh product of a given schedule with one batch, pack 1 */
async function drug(api: any, tag: string, schedule: string | null, qty = 50) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-DR-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA DRUG ${tag}`, taxpcnt: 12, category: 'Analgesic', code: `DR${tag}`, pack: 1, props: schedule ? { schedule } : {} }, MGR);
  const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total: qty * 70, batch: `DR-${tag}`, expdate: '2028-06-30' }, MGR);
  return { itemid: it.body.id, productid: prod.body.id, batch: `DR-${tag}`, title: `QA DRUG ${tag}` };
}

function bill(d: { itemid: number; productid: number; batch: string }, extra: any = {}, qty = 2) {
  const now = new Date().toISOString();
  const total = qty * 100;
  return {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'QA Register Customer', mobile: `9${Math.floor(100000000 + Math.random() * 899999999)}` },
    items: [{ itemid: d.itemid, productid: d.productid, batch: d.batch, price: 100, mrpcost: 100, taxpcnt: 12, qty, total, status: 'Complete' }],
    ...extra,
  };
}

async function required(api: any, value: string) {
  const s = (await api.request('GET', '/settings?key=schedule_register_required', undefined, MGR)).body[0];
  expect(s, 'the setting exists').toBeTruthy();
  const r = await api.request('PUT', `/settings/${s.id}`, { value }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
}

const register = async (api: any, who = MGR, q = '') => (await api.request('GET', `/schedule/register?from=2020-01-01&to=2099-12-31${q}`, undefined, who));
const mine = (rows: any[], patient = GOOD.patient_name) => rows.filter((r) => r.patient_name === patient);

test.describe('Drug register @p1', () => {
  test.afterEach(async ({ api }) => { await required(api, ''); });

  test('DREG-1 a scheduled drug needs the patient and the prescriber, then a numbered register line is written @happy', async ({ api }) => {
    await required(api, 'H1,H,X');
    const h1 = await drug(api, `h1-${run}`, 'H1');
    const plain = await drug(api, `plain-${run}`, null);

    const none = await api.request('POST', '/sales', bill(h1), SALES);
    expect(none.status).toBe(400);
    expect(JSON.stringify(none.body)).toMatch(/Schedule H1/);
    expect(JSON.stringify(none.body)).toMatch(/patient's name/);
    const partial = await api.request('POST', '/sales', bill(h1, { props: { scheduledetail: { patient_name: GOOD.patient_name } } }), SALES);
    expect(partial.status).toBe(400);
    expect(JSON.stringify(partial.body)).toMatch(/prescriber's name/);
    expect((await api.request('POST', '/sales', bill(plain), SALES)).status).toBeLessThan(300);        // an ordinary drug needs nothing
    const held = await api.request('POST', '/sales', bill(h1, { status: 'PENDING', cashamt: 0, total: 0 }), SALES);   // a bill held for later needs nothing, and writes nothing
    expect(held.status, JSON.stringify(held.body)).toBeLessThan(300);

    const ok = await api.request('POST', '/sales', bill(h1, { props: { scheduledetail: GOOD } }), SALES);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const rows = mine((await register(api)).body.rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ schedule: 'H1', qty: 2, batch: h1.batch, drug_name: h1.title, patient_address: GOOD.patient_address, prescriber_name: GOOD.prescriber_name, prescriber_reg_no: GOOD.prescriber_reg_no, superseded: false });
    expect(rows[0].label).toMatch(/^H1-\d{4,}$/);
    expect(rows[0].exp_date).toBe('2028-06-30');
    expect(rows[0].supplied_by).toBeTruthy();

    // the prescriber is kept, and a second bill picks the same person up rather than adding another
    const found = (await api.request('GET', `/schedule/prescribers?q=${encodeURIComponent('DR QA ' + run)}`, undefined, SALES)).body;
    expect(found).toHaveLength(1);
    expect(found[0].reg_no).toBe(GOOD.prescriber_reg_no);
    expect((await api.request('POST', '/sales', bill(h1, { props: { scheduledetail: { ...GOOD, patient_name: GOOD.patient_name + ' TWO' } } }, 1), SALES)).status).toBeLessThan(300);
    expect((await api.request('GET', `/schedule/prescribers?q=${encodeURIComponent('DR QA ' + run)}`, undefined, SALES)).body).toHaveLength(1);
    const two = mine((await register(api)).body.rows, GOOD.patient_name + ' TWO')[0];
    expect(two.serial_no).toBe(rows[0].serial_no + 1);                                                  // the register is numbered in order
  });

  test('DREG-2 the setting says which schedules need details; one that is not needed is recorded only when details are given @edge', async ({ api }) => {
    const h = await drug(api, `h-${run}`, 'H');
    const patient = `${GOOD.patient_name} H`;
    await required(api, 'H1,X');                                                                       // H is not required
    expect((await api.request('POST', '/sales', bill(h), SALES)).status).toBeLessThan(300);
    expect(mine((await register(api)).body.rows, patient)).toHaveLength(0);
    expect((await api.request('POST', '/sales', bill(h, { props: { scheduledetail: { ...GOOD, patient_name: patient } } }), SALES)).status).toBeLessThan(300);
    expect(mine((await register(api, MGR, '&schedule=H')).body.rows, patient)).toHaveLength(1);        // given, so it is in the register

    await required(api, 'H1,H,X');
    expect((await api.request('POST', '/sales', bill(h), SALES)).status).toBe(400);                    // now it is required
    await required(api, '');
    expect((await api.request('POST', '/sales', bill(h), SALES)).status).toBeLessThan(300);            // nothing is required
  });

  test('DREG-3 a bill that is changed supersedes its register lines, and nothing is deleted @happy', async ({ api }) => {
    await required(api, 'H1,H,X');
    const d = await drug(api, `edit-${run}`, 'H1');
    const patient = `${GOOD.patient_name} EDIT`;
    const made = await api.request('POST', '/sales', bill(d, { props: { scheduledetail: { ...GOOD, patient_name: patient } } }), SALES);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const first = mine((await register(api)).body.rows, patient);
    expect(first).toHaveLength(1);

    const full = (await api.request('GET', `/sales/${made.body.id}`, undefined, MGR)).body;
    const edit = await api.request('PUT', '/sales', { ...full, props: { scheduledetail: { ...GOOD, patient_name: patient } }, items: full.items.map((i: any) => ({ ...i, qty: 1, total: 100 })), total: 100, cashamt: 100 }, SALES);
    expect(edit.status, JSON.stringify(edit.body)).toBeLessThan(300);
    const now = mine((await register(api)).body.rows, patient);
    expect(now).toHaveLength(1);                                                                       // one live line: the bill as it now stands
    expect(now[0].qty).toBe(1);
    expect(now[0].serial_no).toBeGreaterThan(first[0].serial_no);
    const all = mine((await register(api, MGR, '&superseded=true')).body.rows, patient);
    expect(all).toHaveLength(2);                                                                       // the first line is kept, marked superseded
    expect(all.filter((r: any) => r.superseded)).toHaveLength(1);
  });

  test('DREG-4 the register is read by the people who run the shop, the print and the export work, coverage is reported @happy', async ({ api }) => {
    expect((await register(api, SALES)).status).toBe(403);                                              // the counter writes it, but does not read it
    expect((await api.request('GET', '/schedule/config', undefined, SALES)).status).toBe(200);
    expect((await register(api, STORE_HEAD)).status).toBe(200);
    const raw = async (path: string) => {
      const t = (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123', scope: 'business' }) })).json()).token;
      const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${t}` } });
      return { status: r.status, type: r.headers.get('content-type') || '', bytes: Buffer.from(await r.arrayBuffer()) };
    };
    const pdf = await raw('/schedule/register/pdf?from=2020-01-01&to=2099-12-31&schedule=H1');
    expect(pdf.status).toBe(200);
    expect(pdf.bytes.slice(0, 4).toString()).toBe('%PDF');
    const xlsx = await raw('/schedule/register/xlsx?from=2020-01-01&to=2099-12-31');
    expect(xlsx.status).toBe(200);
    expect(xlsx.bytes.slice(0, 2).toString()).toBe('PK');
    const cov = (await api.request('GET', '/schedule/coverage', undefined, MGR)).body;
    expect(cov).toHaveProperty('missing');
    expect(cov.months.length).toBeGreaterThan(0);
    expect((await api.request('GET', '/schedule/register?from=2026-02-01&to=2026-01-01', undefined, MGR)).status).toBe(400);
  });

  test('DREG-5 the drug register is a module of the pharmacy pack: switched off, it is gone and the bill is not held up @negative', async ({ api }) => {
    await required(api, 'H1,H,X');
    const d = await drug(api, `off-${run}`, 'H1');
    expect((await api.request('POST', '/sales', bill(d), SALES)).status).toBe(400);                    // on: refused without details
    try {
      expect((await api.request('PUT', '/businesses/mine/modules', { drug_register: false }, MGR)).status).toBeLessThan(300);
      const off = await register(api);
      expect(off.status).toBe(403);
      expect(JSON.stringify(off.body)).toMatch(/Drug register/);
      expect((await api.request('POST', '/sales', bill(d), SALES)).status).toBeLessThan(300);          // off: the bill is not held up, and no line is written
      const mods = (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
      expect(mods.drug_register ?? mods.modules?.drug_register).toBe(false);
    } finally {
      await api.request('PUT', '/businesses/mine/modules', { drug_register: true }, MGR);
    }
    expect((await register(api)).status).toBe(200);
  });
});
