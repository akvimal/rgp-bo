/**
 * Expiry inside the stock audit — AUDX-1..2
 * Source: docs/planning/EXPIRY_REVAMP.md (step 3)
 * Of the batches an audit's count covered, those expired or near expiry that still sit on the books, or were written off by the count itself with no out-pass,
 * need an out-pass or a short explanation before the audit is signed off. An out-pass can be made from the audit; the certificate carries the picture.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const lastMonth = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 1, 1); return d.toISOString().slice(0, 10); };

/** an expired batch of a new product in its own category, at store 1: pack 1, cost 70 a unit, so the counts and their values are exact */
async function expiredBatch(api: any, tag: string, category: string, qty: number) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body.find((x: any) => x.isActive !== false && !x.blocked);
  const prod = await api.request('POST', '/products', { title: `QA-AUDX-${tag}`, taxpcnt: 12, category, code: `AX${tag}`, pack: 1 }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const inv = await api.request('POST', '/purchases', { vendorid: v.id, storeid: 1, invoiceno: `QA-AUDX-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total: qty * 70, batch: `AX-${tag}`, expdate: lastMonth(),
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);
  expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  return { itemid: it.body.id as number, title: prod.body.title as string };
}

const pdf = async (api: any, who: string, path: string) => {
  const r = await (await api.raw(who)).get(path);
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
};

/** an audit of one category at store 1, counted by the Store Head with the given counted quantities, its differences approved */
async function countedAudit(api: any, cat: string, counted: Record<number, number>) {
  const plan = await api.request('POST', '/stock-audits/plans', { name: `QA ${cat}`, scope: 'CATEGORY', categories: [cat], frequency_days: 30, first_due: today(), store_id: 1 }, MGR);
  expect(plan.status, JSON.stringify(plan.body)).toBeLessThan(300);
  expect((await api.request('POST', '/stock-audits/generate', {}, MGR)).status).toBeLessThan(300);
  const audit = (await api.request('GET', '/stock-audits?status=ACTIVE', undefined, MGR)).body.find((a: any) => a.category === cat);
  expect(audit, 'the audit was planned').toBeTruthy();
  const started = await api.request('POST', '/stock/counts', { category: cat, storeid: 1, auditid: audit.id }, STORE_HEAD);
  expect(started.status, JSON.stringify(started.body)).toBeLessThan(300);
  const items = Object.entries(counted).map(([itemid, countedqty]) => ({ itemid: +itemid, bookqty: 0, countedqty }));
  const submitted = await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, { items }, STORE_HEAD);
  expect(submitted.status, JSON.stringify(submitted.body)).toBeLessThan(300);
  for (const adj of submitted.body.adjustments || []) {
    const ok = await api.request('PUT', `/stock/audit/${adj.id}/approve`, { reasoncode: 'SHRINKAGE' }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
  }
  return audit;
}
const reviewOf = async (api: any, id: number) => (await api.request('GET', `/stock-audits/${id}/expiry`, undefined, MGR)).body;

test.describe('Expiry in the stock audit @p1', () => {
  test('AUDX-1 expired batches the count covered need an out-pass or an explanation before sign-off; the pass names its audit @happy', async ({ api }) => {
    const cat = `QA-AUDX-${Date.now()}`;
    const a = await expiredBatch(api, `a-${Date.now()}`, cat, 20);               // counted in full: the expired stock is still there
    const b = await expiredBatch(api, `b-${Date.now()}`, cat, 10);               // 2 short: written off by the count
    const audit = await countedAudit(api, cat, { [a.itemid]: 20, [b.itemid]: 8 });

    const r = await reviewOf(api, audit.id);
    expect(r).toMatchObject({ counted: true, certified: false });
    const ra = r.rows.find((x: any) => x.itemid === a.itemid);
    const rb = r.rows.find((x: any) => x.itemid === b.itemid);
    expect(ra).toMatchObject({ kind: 'ON_BOOKS', balance: 20, counted: 20, resolved: false, passid: null });
    expect(rb).toMatchObject({ kind: 'BOTH', balance: 8, adjusted: -2, resolved: false });
    expect(r.open).toBe(2);
    expect(r.unrecorded).toBe(1);
    expect(r.unrecordedValue).toBe(140);                                         // 2 units at 70

    const row = (await api.request('GET', '/stock-audits?status=DONE', undefined, MGR)).body.find((x: any) => x.id === audit.id);
    expect(row.expiry_open).toBe(2);                                             // the list says what is waiting
    const blocked = await api.request('POST', `/stock-audits/${audit.id}/certify`, { note: 'qa' }, MGR);
    expect(blocked.status).toBe(400);
    expect(JSON.stringify(blocked.body)).toMatch(/2 expired or near-expiry batches need an out-pass or an explanation/);

    // an out-pass made from the audit resolves the first; it names the audit
    const pass = await api.request('POST', '/disposal', { storeid: 1, reason: 'EXPIRED', method: 'DESTROYED', auditid: audit.id, lines: [{ itemid: a.itemid, qty: 20 }] }, MGR);
    expect(pass.status, JSON.stringify(pass.body)).toBeLessThan(300);
    expect(pass.body.audit_no).toMatch(/^SA-\d{4,}$/);
    expect((await api.request('POST', '/disposal', { storeid: 1, reason: 'EXPIRED', method: 'DESTROYED', auditid: 999999, lines: [{ itemid: b.itemid, qty: 1 }] }, MGR)).status).toBe(400);   // not one of this store's audits
    let r2 = await reviewOf(api, audit.id);
    expect(r2.rows.find((x: any) => x.itemid === a.itemid)).toMatchObject({ resolved: true, passno: pass.body.pass_no, passstatus: 'DRAFT' });
    expect(r2.open).toBe(1);

    // the second has no pass behind the shortage: a short explanation settles it
    expect((await api.request('POST', `/stock-audits/${audit.id}/expiry/explain`, { itemid: b.itemid, note: 'ok' }, MGR)).status).toBe(400);   // too short to mean anything
    expect((await api.request('POST', `/stock-audits/${audit.id}/expiry/explain`, { itemid: 999999, note: 'thrown away by the night staff' }, MGR)).status).toBe(400);
    const ex = await api.request('POST', `/stock-audits/${audit.id}/expiry/explain`, { itemid: b.itemid, note: 'thrown away by the night staff on 3 Nov' }, MGR);
    expect(ex.status, JSON.stringify(ex.body)).toBeLessThan(300);
    r2 = ex.body;
    expect(r2.rows.find((x: any) => x.itemid === b.itemid)).toMatchObject({ resolved: true, note: 'thrown away by the night staff on 3 Nov' });
    expect(r2.open).toBe(0);
    expect(r2.explained).toBe(1);

    // signed off by someone other than the counter, and the certificate is kept
    expect((await api.request('POST', `/stock-audits/${audit.id}/certify`, {}, STORE_HEAD)).status).toBe(403);
    const cert = await api.request('POST', `/stock-audits/${audit.id}/certify`, { note: 'qa' }, MGR);
    expect(cert.status, JSON.stringify(cert.body)).toBeLessThan(300);
    const kept = await pdf(api, MGR, `/stock-audits/${audit.id}/certificate`);
    expect(kept.status).toBe(200);
    expect(kept.bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect((await api.request('POST', `/stock-audits/${audit.id}/expiry/explain`, { itemid: b.itemid, note: 'changed afterwards' }, MGR)).status).toBe(400);   // a signed audit is closed
  });

  test('AUDX-2 an audit with nothing expired is not held up, and the review is empty @edge', async ({ api }) => {
    const cat = `QA-AUDX-${Date.now()}`;
    const v = (await api.request('GET', '/vendors', undefined, MGR)).body.find((x: any) => x.isActive !== false && !x.blocked);
    const prod = await api.request('POST', '/products', { title: `QA-AUDX-fresh-${Date.now()}`, taxpcnt: 12, category: cat, code: `AXF${Date.now()}`, pack: 1 }, MGR);
    const inv = await api.request('POST', '/purchases', { vendorid: v.id, storeid: 1, invoiceno: `QA-AUDX-F${Date.now()}`, invoicedate: '2026-07-01' }, MGR);
    const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 10, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total: 700, batch: 'AXF', expdate: '2099-12-01' }, MGR);
    await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
    await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE' } }, MGR);
    const audit = await countedAudit(api, cat, { [it.body.id]: 10 });
    const r = await reviewOf(api, audit.id);
    expect(r).toMatchObject({ open: 0, rows: [] });
    const cert = await api.request('POST', `/stock-audits/${audit.id}/certify`, {}, MGR);
    expect(cert.status, JSON.stringify(cert.body)).toBeLessThan(300);
  });

  test('AUDX-3 the audit screen: the open expired batches hold back the sign-off, an out-pass is made from the audit, an explanation is typed @happy', async ({ app, api }) => {
    const cat = `QA-AUDX-${Date.now()}`;
    const a = await expiredBatch(api, `ua-${Date.now()}`, cat, 12);
    const b = await expiredBatch(api, `ub-${Date.now()}`, cat, 9);
    const audit = await countedAudit(api, cat, { [a.itemid]: 12, [b.itemid]: 7 });

    const { page } = await app.open(MGR, '/secure/stock-audits');
    await page.getByTestId('sa-tab-done').click();
    const row = page.locator(`[data-testid="sa-row"][data-id="${audit.id}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId('sa-expiry-open')).toContainText('2 expired or near-expiry batches');
    await expect(row.getByTestId('sa-certify')).toBeDisabled();                                  // held back until they are settled

    await row.getByTestId('sa-expiry').click();
    await expect(page.getByTestId('sa-expiry-panel')).toBeVisible();
    await expect(page.getByTestId('sa-expiry-row')).toHaveCount(2);
    const line = page.getByTestId('sa-expiry-row').filter({ hasText: a.title });
    await expect(line).toContainText('Expired stock still on the books');
    await expect(page.getByTestId('sa-expiry-row').filter({ hasText: b.title })).toContainText('unrecorded disposal');

    // an out-pass for the first, made from the audit
    await line.getByTestId('sa-expiry-check').check();
    await page.getByTestId('sa-expiry-make-pass').click();
    await expect(page.getByTestId('pass-detail')).toBeVisible();
    await expect(page.getByTestId('pass-audit')).toContainText('SA-');
    await page.goBack();

    // an explanation for the second
    await page.getByTestId('sa-tab-done').click();
    const row2 = page.locator(`[data-testid="sa-row"][data-id="${audit.id}"]`);
    await row2.getByTestId('sa-expiry').click();
    const second = page.getByTestId('sa-expiry-row').filter({ hasText: b.title });
    await second.getByTestId('sa-expiry-note').fill('thrown away by the night staff on 3 Nov');
    await second.getByTestId('sa-expiry-note-save').click();
    await expect(second.getByTestId('sa-expiry-explained')).toBeVisible();
    await expect(row2.getByTestId('sa-certify')).toBeEnabled();                                  // nothing is waiting now
  });
});

