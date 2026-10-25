/**
 * Stock audit paper trail — AUDREC-1..4
 * A plan makes a numbered audit; the count keeps every line; the sheet, variance report and certificate print; a large difference needs a second count by
 * another person; two different people sign; the certificate is kept as printed; the register and valuation report it.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';
const SALES = 'sales1@local.test';
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

/** A fresh product (in its own category) with one batch of a known cost, pack 1, so the counts and their values are exact. */
async function ownBatch(api: any, tag: string, category: string, qty = 50, mrpcost = 1000) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-AUD-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA-AUD-PROD-${tag}`, taxpcnt: 12, category, code: `AUD${tag}`, pack: 1 }, MGR);
  const lineTotal = +(qty * mrpcost).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: mrpcost * 0.7, ptrcost: mrpcost * 0.7,
    mrpcost, saleprice: mrpcost, taxpcnt: 12, total: lineTotal, batch: `AUD-${tag}`, expdate: '2028-06-30',
  }, MGR);
  return { itemid: it.body.id, productid: prod.body.id, batch: `AUD-${tag}` };
}

const pdf = async (api: any, who: string, path: string) => {
  const r = await (await api.raw(who)).get(path);
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
};

/** sells `qty` of a batch at store 1 while a count is open */
async function sell(api: any, b: { itemid: number; productid: number; batch: string }, qty: number) {
  const now = new Date().toISOString();
  const total = qty * 100;
  const r = await api.request('POST', '/sales', {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    customer: { name: 'QA Count Sale', mobile: `9${Math.floor(100000000 + Math.random() * 899999999)}` },
    items: [{ itemid: b.itemid, productid: b.productid, batch: b.batch, price: 100, mrpcost: 1000, taxpcnt: 12, qty, total, status: 'Complete' }],
  }, SALES);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
}

test.describe('Stock audit paper trail @p1', () => {
  test('AUDREC-1 the standard plans are added once and cover fast movers, scheduled drugs and expiry @happy', async ({ api }) => {
    expect((await api.request('POST', '/stock-audits/plans/standard', {}, SALES)).status).toBe(403);
    const first = await api.request('POST', '/stock-audits/plans/standard', {}, MGR);
    expect(first.status).toBeLessThan(300);
    const again = await api.request('POST', '/stock-audits/plans/standard', {}, MGR);
    expect(again.body.created).toBe(0);
    const plans = (await api.request('GET', '/stock-audits/plans', undefined, MGR)).body;
    const scopes = plans.map((p: any) => p.scope);
    for (const s of ['FAST', 'SCHEDULE', 'EXPIRY', 'ALL']) expect(scopes).toContain(s);
    expect(plans.find((p: any) => p.scope === 'SCHEDULE').frequency_days).toBe(30);
    // the QA database has hundreds of stores, and a plan for every store would plan hundreds of audits: switch the standard ones off again
    for (const p of plans.filter((x: any) => x.active && ['FAST', 'SCHEDULE', 'EXPIRY', 'ALL', 'ROTATE'].includes(x.scope) && /\((weekly|monthly|yearly)\)/.test(x.name))) {
      const off = await api.request('PUT', `/stock-audits/plans/${p.id}`, { name: p.name, scope: p.scope, categories: p.categories || [], frequency_days: p.frequency_days, first_due: String(p.first_due).slice(0, 10), store_id: p.store_id, assigned_to: p.assigned_to, active: false }, MGR);
      expect(off.status, JSON.stringify(off.body)).toBeLessThan(300);
    }
  });

  test('AUDREC-2 sheet, count, large difference recounted by another person, two signers, certificate kept @happy', async ({ api }) => {
    const cat = `QA-AUD-${Date.now()}`;
    const b = await ownBatch(api, `rec-${Date.now()}`, cat);
    const plan = await api.request('POST', '/stock-audits/plans', { name: `QA ${cat}`, scope: 'CATEGORY', categories: [cat], frequency_days: 30, first_due: today(), store_id: 1 }, MGR);
    expect(plan.status, JSON.stringify(plan.body)).toBeLessThan(300);
    expect((await api.request('POST', '/stock-audits/generate', {}, MGR)).status).toBeLessThan(300);
    const audit = (await api.request('GET', '/stock-audits?status=ACTIVE', undefined, MGR)).body.find((a: any) => a.category === cat);
    expect(audit, 'the audit was planned').toBeTruthy();
    expect(audit.audit_no).toBeGreaterThan(0);

    expect((await pdf(api, STORE_HEAD, `/stock-audits/${audit.id}/sheet`)).status).toBe(400);            // not started: nothing fixed to print
    const started = await api.request('POST', '/stock/counts', { category: cat, storeid: 1, auditid: audit.id }, STORE_HEAD);
    expect(started.status, JSON.stringify(started.body)).toBeLessThan(300);
    const sheet = await pdf(api, STORE_HEAD, `/stock-audits/${audit.id}/sheet`);
    expect(sheet.status).toBe(200);
    expect(sheet.type).toContain('pdf');
    expect(sheet.bytes.slice(0, 4).toString()).toBe('%PDF');

    const line = started.body.items.find((i: any) => i.item_id === b.itemid);
    expect(Number(line.balance)).toBe(50);
    const submitted = await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, { items: [{ itemid: b.itemid, bookqty: 999, countedqty: 47 }] }, STORE_HEAD);
    expect(submitted.status, JSON.stringify(submitted.body)).toBeLessThan(300);
    const adj = submitted.body.adjustments[0];
    expect(adj.escalated).toBe(true);                                                   // 3 x 700 at cost
    expect(adj.bookqty).toBe(50);                                                       // the book quantity fixed at the start, not what the client sent
    expect((await pdf(api, STORE_HEAD, `/stock-audits/${audit.id}/variance`)).bytes.slice(0, 4).toString()).toBe('%PDF');

    expect((await api.request('POST', `/stock-audits/${audit.id}/certify`, {}, MGR)).status).toBe(400);   // an adjustment is still waiting
    expect((await api.request('PUT', `/stock/audit/${adj.id}/approve`, undefined, MGR)).status).toBe(400); // a large difference is counted again first
    expect((await api.request('PUT', `/stock/audit/${adj.id}/recount`, { qty: 49 }, STORE_HEAD)).status).toBe(403);   // not by the counter
    const re = await api.request('PUT', `/stock/audit/${adj.id}/recount`, { qty: 49 }, MGR);
    expect(re.status, JSON.stringify(re.body)).toBeLessThan(300);
    expect(re.body.qty).toBe(-1);                                                       // the second count replaces the first
    expect((await api.request('PUT', `/stock/audit/${adj.id}/approve`, undefined, MGR)).status).toBeLessThan(300);

    expect((await api.request('POST', `/stock-audits/${audit.id}/certify`, {}, STORE_HEAD)).status).toBe(403);   // the counter cannot also sign as verifier
    const cert = await api.request('POST', `/stock-audits/${audit.id}/certify`, { note: 'qa' }, MGR);
    expect(cert.status, JSON.stringify(cert.body)).toBeLessThan(300);
    expect(cert.body.no).toMatch(/^SA-\d{4,}$/);
    expect((await api.request('POST', `/stock-audits/${audit.id}/certify`, {}, MGR)).status).toBe(400);          // once
    const kept = await pdf(api, STORE_HEAD, `/stock-audits/${audit.id}/certificate`);
    expect(kept.status).toBe(200);
    expect(kept.bytes.slice(0, 4).toString()).toBe('%PDF');
    const again = await pdf(api, MGR, `/stock-audits/${audit.id}/certificate`);
    expect(again.bytes.equals(kept.bytes)).toBe(true);                                  // a reprint is the file as it was kept

    const row = (await api.request('GET', '/stock-audits?status=DONE', undefined, MGR)).body.find((a: any) => a.id === audit.id);
    expect(row.certified_name).toBeTruthy();
  });

  test('AUDREC-3 the register lists the year and exports, and the valuation totals the stock @happy', async ({ api }) => {
    const reg = (await api.request('GET', '/stock-audits/register', undefined, MGR)).body;
    expect(reg.fy.label).toMatch(/^\d{4}-\d{2}$/);
    expect(reg.summary.audits).toBeGreaterThanOrEqual(1);
    expect(reg.rows.some((r: any) => r.certified_on)).toBe(true);
    const x = await pdf(api, MGR, '/stock-audits/register?format=xlsx');
    expect(x.status).toBe(200);
    expect(x.bytes.slice(0, 2).toString()).toBe('PK');

    const v = (await api.request('GET', `/stock-audits/valuation?asof=${today()}`, undefined, MGR)).body;
    expect(v.rows.length).toBeGreaterThan(0);
    expect(v.total.value).toBeGreaterThan(0);
    expect(Math.round(v.rows.reduce((s: number, r: any) => s + r.value, 0) * 100) / 100).toBeCloseTo(v.total.value, 1);
    const past = (await api.request('GET', '/stock-audits/valuation?asof=2000-01-01', undefined, MGR)).body;
    expect(past.total.value).toBe(0);                                                   // before any purchase
    expect((await pdf(api, MGR, `/stock-audits/valuation?asof=${today()}&format=xlsx`)).bytes.slice(0, 2).toString()).toBe('PK');
  });

  test('AUDREC-4 sales staff cannot reach the audit records @negative', async ({ api }) => {
    expect((await api.request('GET', '/stock-audits/register', undefined, SALES)).status).toBe(403);
    expect((await api.request('GET', '/stock-audits/valuation', undefined, SALES)).status).toBe(403);
    expect((await pdf(api, SALES, '/stock-audits/1/certificate')).status).toBe(403);
    expect((await pdf(api, MGR, '/stock-audits/99999999/sheet')).status).toBe(404);
  });
  test('AUDREC-5 sales made during the count are not shortages: the count is measured against what was expected @happy', async ({ api }) => {
    const cat = `QA-AUDS-${Date.now()}`;
    const clean = await ownBatch(api, `s1-${Date.now()}`, cat, 50, 100);
    const short = await ownBatch(api, `s2-${Date.now()}`, cat, 50, 100);
    const started = await api.request('POST', '/stock/counts', { category: cat, storeid: 1 }, MGR);
    expect(started.status, JSON.stringify(started.body)).toBeLessThan(300);
    const countId = started.body.count.id;

    const open = (await api.request('GET', '/stock/counts/open-items?storeid=1', undefined, MGR)).body;
    expect(open.itemids).toContain(clean.itemid);                                        // screens warn before stock under a count is changed

    await sell(api, clean, 2);                                                           // two sold of each while counting
    await sell(api, short, 2);

    const early = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const lines = [{ itemid: clean.itemid, countedqty: 48 }, { itemid: short.itemid, countedqty: 47 }];
    expect((await api.request('POST', `/stock/counts/${countId}/submit`, { items: lines, finishedat: early }, MGR)).status).toBe(400);    // before it started
    expect((await api.request('POST', `/stock/counts/${countId}/submit`, { items: lines, finishedat: future }, MGR)).status).toBe(400);   // in the future
    expect((await api.request('POST', `/stock/counts/${countId}/submit`, { items: lines, finishedat: 'soon' }, MGR)).status).toBe(400);

    const done = await api.request('POST', `/stock/counts/${countId}/submit`, { items: lines }, MGR);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    expect(done.body.linesAdjusted).toBe(2);                                             // both lines had sales
    expect(done.body.linesChanged).toBe(1);                                              // only the second is really short
    const adj = done.body.adjustments[0];
    expect(adj.qty).toBe(-1);                                                            // 47 against the 48 expected, not -3 against 50
    expect(adj.bookqty).toBe(48);
    expect(adj.escalated).toBe(false);

    const after = (await api.request('GET', '/stock/counts/open-items?storeid=1', undefined, MGR)).body;
    expect(after.itemids).not.toContain(clean.itemid);                                   // no longer being counted
  });
});
