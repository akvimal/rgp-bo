/**
 * Stock audit adjustments keep a trail — ATRAIL-1..3
 * A count difference is approved only with the reason it arose; rejecting needs a reason; a draft adjustment is deleted only with a reason and an approved or
 * count one never; each of these is recorded. An adjustment names the audit it belongs to and can be listed by audit. A saved plan plans its audit at once.
 */
import { test, expect } from '../fixtures/index.js';
import { q } from '../seed/db.js';

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + 5.5 * 3600000 + n * 86400000).toISOString().slice(0, 10);

/** a fresh product with one batch at a cheap cost (70 a unit), so a small difference is not a "large" one that needs a recount */
async function cheapBatch(api: any, tag: string, category: string, qty = 50) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-ATR-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA-ATR-PROD-${tag}`, taxpcnt: 12, category, code: `ATR${tag}`, pack: 1 }, MGR);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total: qty * 70, batch: `ATR-${tag}`, expdate: '2028-06-30',
  }, MGR);
  return { itemid: it.body.id, productid: prod.body.id, batch: `ATR-${tag}` };
}

/** a plan for one category at store 1, its audit, and the count submitted with `counted` units for a batch of 50 */
async function countedAudit(api: any, tag: string, counted: number) {
  const cat = `QA-ATR-${tag}`;
  const b = await cheapBatch(api, tag, cat);
  const plan = await api.request('POST', '/stock-audits/plans', { name: `QA ${cat}`, scope: 'CATEGORY', categories: [cat], frequency_days: 30, first_due: today(), store_id: 1 }, MGR);
  expect(plan.status, JSON.stringify(plan.body)).toBeLessThan(300);
  const audit = (await api.request('GET', '/stock-audits?status=ACTIVE', undefined, MGR)).body.find((a: any) => a.category === cat);
  expect(audit, 'the saved plan planned its audit at once').toBeTruthy();
  const started = await api.request('POST', '/stock/counts', { category: cat, storeid: 1, auditid: audit.id }, STORE_HEAD);
  expect(started.status, JSON.stringify(started.body)).toBeLessThan(300);
  const submitted = await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, { items: [{ itemid: b.itemid, bookqty: 50, countedqty: counted }] }, STORE_HEAD);
  expect(submitted.status, JSON.stringify(submitted.body)).toBeLessThan(300);
  return { b, audit, plan: plan.body, adj: submitted.body.adjustments[0] };
}

const adjustments = async (api: any, qs = '') => (await api.request('GET', `/stock/adjust/qty${qs}`, undefined, MGR)).body as any[];
const events = async (id: number) => (await q(`select action, summary from audit_event where entity_type = 'product_qtychange' and entity_id = $1 order by id`, [String(id)])).map((r: any) => r.action);

test.describe('Stock audit adjustment trail @p1', () => {
  test('ATRAIL-1 a count difference is approved only with a reason, names its audit, and cannot be deleted or edited round @happy', async ({ api }) => {
    const { audit, plan, adj } = await countedAudit(api, `c-${Date.now()}`, 48);
    expect(plan.created).toBeGreaterThanOrEqual(1);                                            // the plan planned its audit when it was saved
    expect(adj.status).toBe('PENDING');

    // the adjustment names the audit and can be listed by it
    const mine = (await adjustments(api, `?audit=${audit.id}`));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: adj.id, auditid: audit.id, auditno: audit.audit_no, status: 'PENDING' });
    const row = (await api.request('GET', '/stock-audits?status=DONE', undefined, MGR)).body.find((a: any) => a.id === audit.id);
    expect(row).toMatchObject({ adjustments: 1, pending_lines: 1 });

    // approving needs the reason it arose; "Other" needs words
    expect((await api.request('PUT', `/stock/audit/${adj.id}/approve`, undefined, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/stock/audit/${adj.id}/approve`, { reasoncode: 'AUDIT' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/stock/audit/${adj.id}/approve`, { reasoncode: 'OTHER' }, MGR)).status).toBe(400);
    // a count difference cannot be deleted, and editing cannot settle it round the reason
    expect((await api.request('DELETE', `/stock/adjust/qty/${adj.id}`, { note: 'remove it' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/stock/adjust/qty/${adj.id}`, { status: 'APPROVED' }, MGR)).status).toBe(400);

    const ok = await api.request('PUT', `/stock/audit/${adj.id}/approve`, { reasoncode: 'DAMAGED', note: 'broke while shelving' }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const after = (await adjustments(api, `?audit=${audit.id}`))[0];
    expect(after).toMatchObject({ status: 'APPROVED', reasoncode: 'DAMAGED', discarded: true, settlenote: 'broke while shelving' });
    expect(await events(adj.id)).toContain('stock_adjustment.approved');
    expect((await api.request('DELETE', `/stock/adjust/qty/${adj.id}`, { note: 'now it is approved' }, MGR)).status).toBe(400);

    // with every difference settled, the audit can be signed off by someone other than the counter
    const cert = await api.request('POST', `/stock-audits/${audit.id}/certify`, { note: 'qa' }, MGR);
    expect(cert.status, JSON.stringify(cert.body)).toBeLessThan(300);
  });

  test('ATRAIL-2 rejecting and deleting need a reason, are recorded, and an approved adjustment is never deleted @happy', async ({ api }) => {
    const cat = `QA-ATR-m-${Date.now()}`;
    const b = await cheapBatch(api, `m-${Date.now()}`, cat);
    const make = async (qty: number, extra: any = {}) => {
      const r = await api.request('POST', '/stock/adjust/qty', { itemid: b.itemid, qty, reasoncode: 'SHRINKAGE', comments: 'qa trail', ...extra }, MGR);
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
      return r.body;
    };
    const rejectMe = await make(-5, { status: 'PENDING' });
    expect(rejectMe.status).toBe('PENDING');
    expect((await api.request('PUT', `/stock/audit/${rejectMe.id}/reject`, undefined, MGR)).status).toBe(400);               // no reason
    expect((await api.request('PUT', `/stock/audit/${rejectMe.id}/reject`, { note: 'x' }, MGR)).status).toBe(400);           // too short
    expect((await api.request('PUT', `/stock/audit/${rejectMe.id}/reject`, { note: 'Miscounted: shelf was fine' }, MGR)).status).toBeLessThan(300);
    expect((await adjustments(api)).find((x: any) => x.id === rejectMe.id)).toMatchObject({ status: 'REJECTED', settlenote: 'Miscounted: shelf was fine' });
    expect(await events(rejectMe.id)).toContain('stock_adjustment.rejected');

    // a rejected draft can be deleted, with a reason, and the deletion is recorded
    expect((await api.request('DELETE', `/stock/adjust/qty/${rejectMe.id}`, undefined, MGR)).status).toBe(400);
    expect((await api.request('DELETE', `/stock/adjust/qty/${rejectMe.id}`, { note: 'entered twice' }, MGR)).status).toBeLessThan(300);
    expect((await adjustments(api)).some((x: any) => x.id === rejectMe.id)).toBe(false);
    expect(await events(rejectMe.id)).toContain('stock_adjustment.deleted');

    // an approved adjustment has moved the stock: it cannot be deleted
    const approveMe = await make(-3, { status: 'PENDING' });
    expect((await api.request('PUT', `/stock/audit/${approveMe.id}/approve`, undefined, MGR)).status).toBeLessThan(300);    // a plain adjustment already carries its reason
    expect((await api.request('DELETE', `/stock/adjust/qty/${approveMe.id}`, { note: 'changed my mind' }, MGR)).status).toBe(400);
    expect((await adjustments(api)).some((x: any) => x.id === approveMe.id)).toBe(true);

    // an adjustment made for an audit names it
    const { audit } = await countedAudit(api, `e-${Date.now()}`, 50);
    const forAudit = await make(-1, { auditid: audit.id });
    expect((await adjustments(api, `?audit=${audit.id}`)).some((x: any) => x.id === forAudit.id && x.auditno === audit.audit_no)).toBe(true);
    expect((await api.request('POST', '/stock/adjust/qty', { itemid: b.itemid, qty: -1, reasoncode: 'SHRINKAGE', auditid: 99999999 }, MGR)).status).toBe(400);
  });

  test('ATRAIL-3 a saved plan says when its audit will appear when it is not due yet @edge', async ({ api }) => {
    const cat = `QA-ATR-f-${Date.now()}`;
    const plan = await api.request('POST', '/stock-audits/plans', { name: `QA ${cat}`, scope: 'CATEGORY', categories: [cat], frequency_days: 30, first_due: inDays(40), store_id: 1 }, MGR);
    expect(plan.status, JSON.stringify(plan.body)).toBeLessThan(300);
    expect(plan.body.created).toBe(0);
    expect(plan.body.appears_on).toBe(inDays(33));                                              // a week before it is due
    expect((await api.request('GET', '/stock-audits?status=ACTIVE', undefined, MGR)).body.some((a: any) => a.category === cat)).toBe(false);
    // switch it off so it does not plan audits later
    const p = (await api.request('GET', '/stock-audits/plans', undefined, MGR)).body.find((x: any) => x.id === plan.body.id);
    await api.request('PUT', `/stock-audits/plans/${p.id}`, { name: p.name, scope: p.scope, categories: p.categories || [], frequency_days: p.frequency_days, first_due: String(p.first_due).slice(0, 10), store_id: p.store_id, assigned_to: p.assigned_to, active: false }, MGR);
  });
});
