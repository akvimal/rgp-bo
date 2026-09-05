/**
 * GST inward-supply reconciliation (WS-5, docs/planning/PURCHASING_PAYABLES_GST_PROGRAM.md)
 * New feature, not part of the original 120-case manual-test-plan.html.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

// GST periods are process-wide state (a period can be locked, a batch replaces the whole prior
// import) - unlike most of this suite's per-record uniqueness, re-running the file against the same
// unreseeded DB would collide on a fixed period. Pick a year that changes on every invocation instead.
const RUN_YEAR = 2000 + (Date.now() % 90);
const periodFor = (month: string) => `${RUN_YEAR}-${month}`;

async function completedInvoice(api: any, tag: string, period: string) {
  const vendors = (await api.request('GET', '/vendors', undefined, MGR)).body;
  const v = vendors.find((x: any) => x.gstn) || vendors[0];
  const prod = data.m.products[42].id;
  const po = await api.request('POST', '/purchaseorders', { vendorid: v.id }, MGR);
  const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 5, vendorid: v.id }, MGR);
  await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: po.body.id }, MGR);
  await api.request('POST', `/purchaseorders/${po.body.id}/submit`, undefined, MGR);
  const st = await api.request('GET', `/purchaseorders/${po.body.id}`, undefined, MGR);
  if (st.body.status === 'PENDING_APPROVAL') await api.request('POST', `/purchaseorders/${po.body.id}/approve`, undefined, MGR);
  const invoiceno = `QA-RECON-${tag}-${po.body.id}`;
  const invoicedate = `${period}-10`;
  const inv = await api.request('POST', '/purchases', { vendorid: v.id, purchaseorderid: String(po.body.id), invoiceno, invoicedate }, MGR);
  const lineTotal = +(5 * 20 * 1.18).toFixed(2);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod, qty: 5, ptrvalue: 20, ptrcost: 20, mrpcost: 30,
    taxpcnt: 18, total: lineTotal, batch: `RECON-${tag}-${po.body.id}`, expdate: '2028-06-30', saleprice: 25,
  }, MGR);
  await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
  await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total: lineTotal } }, MGR);
  const fetched = (await api.request('GET', `/purchases/${inv.body.id}`, undefined, MGR)).body;
  return { id: inv.body.id, vendorid: v.id, invoiceno, invoicedate, total: lineTotal, suppliergstin: fetched.suppliergstin };
}

test.describe('GST reconciliation @p2', () => {
  test('GSTRECON-1 the GST screen is reachable and gated to privileged roles @permission', async ({ app, api }) => {
    const { page } = await app.open(MGR, '/secure/purchases/gst');
    await expectShell(page);
    await expect(page.getByTestId('gst-run-match')).toBeVisible();

    const denied = await api.request('GET', '/gst/summary?period=2026-01', undefined, SALES);
    expect(denied.status).toBe(403);
  });

  test('GSTRECON-2 an exact match (same GSTIN/invoice/value) is auto-matched with the invoice\'s ITC @happy', async ({ api }) => {
    const period = periodFor('06');
    const inv = await completedInvoice(api, 'exact', period);
    test.skip(!inv.suppliergstin, 'seeded vendor has no GSTIN - nothing to match on');

    const imp = await api.request('POST', '/gst/import', {
      period, source: '2B',
      file: [{
        supplier_gstin: inv.suppliergstin, supplier_name: 'Portal Test Vendor',
        invoice_no: inv.invoiceno, invoice_date: inv.invoicedate, invoice_value: inv.total,
        taxable_value: inv.total * 0.85, cgst: inv.total * 0.075, sgst: inv.total * 0.075, igst: 0,
      }],
    }, MGR);
    expect(imp.status).toBeLessThan(300);

    const match = await api.request('POST', '/gst/match', { period }, MGR);
    expect(match.status).toBeLessThan(300);
    expect(match.body.matched).toBeGreaterThanOrEqual(1);

    const worklist = (await api.request('GET', `/gst/worklist?period=${period}&status=MATCHED`, undefined, MGR)).body;
    const row = worklist.find((r: any) => r.invoice_no === inv.invoiceno);
    expect(row, 'the invoice appears as MATCHED').toBeTruthy();
    expect(row.match_type).toBe('EXACT');
  });

  test('GSTRECON-3 a value mismatch is flagged with variances, not silently matched @negative', async ({ api }) => {
    const period = periodFor('05');
    const inv = await completedInvoice(api, 'mismatch', period);
    test.skip(!inv.suppliergstin, 'seeded vendor has no GSTIN - nothing to match on');

    await api.request('POST', '/gst/import', {
      period, source: '2B',
      file: [{
        supplier_gstin: inv.suppliergstin, supplier_name: 'Portal Test Vendor',
        invoice_no: inv.invoiceno, invoice_date: inv.invoicedate, invoice_value: inv.total + 5000, // way outside tolerance
        taxable_value: 1, cgst: 1, sgst: 1, igst: 0,
      }],
    }, MGR);
    await api.request('POST', '/gst/match', { period }, MGR);

    const worklist = (await api.request('GET', `/gst/worklist?period=${period}&status=MISMATCH`, undefined, MGR)).body;
    const row = worklist.find((r: any) => r.invoice_no === inv.invoiceno);
    expect(row, 'the invoice appears as MISMATCH').toBeTruthy();
    expect(row.variances).toBeTruthy();
  });

  test('GSTRECON-4 a books invoice absent from the portal import is MISSING_IN_2B @edge', async ({ api }) => {
    const period = periodFor('04');
    const inv = await completedInvoice(api, 'missing2b', period);
    test.skip(!inv.suppliergstin, 'seeded vendor has no GSTIN - nothing to match on');

    // import something unrelated so the period exists, but never mention this invoice
    await api.request('POST', '/gst/import', { period, source: '2B', file: [] }, MGR).catch(() => {});
    await api.request('POST', '/gst/match', { period }, MGR);

    const worklist = (await api.request('GET', `/gst/worklist?period=${period}&status=MISSING_IN_2B`, undefined, MGR)).body;
    expect(worklist.some((r: any) => r.invoice_no === inv.invoiceno)).toBeTruthy();
  });

  test('GSTRECON-5 a resolved row keeps its manual verdict across a re-run of the match @happy', async ({ api }) => {
    const period = periodFor('03');
    const inv = await completedInvoice(api, 'resolved', period);
    test.skip(!inv.suppliergstin, 'seeded vendor has no GSTIN - nothing to match on');
    await api.request('POST', '/gst/match', { period }, MGR);

    const before = (await api.request('GET', `/gst/worklist?period=${period}&status=MISSING_IN_2B`, undefined, MGR)).body
      .find((r: any) => r.invoice_no === inv.invoiceno);
    expect(before).toBeTruthy();

    const excluded = await api.request('POST', `/gst/reconciliation/${before.id}/exclude`, { note: 'qa: not a real supply' }, MGR);
    expect(excluded.status).toBeLessThan(300);

    await api.request('POST', '/gst/match', { period }, MGR); // re-run must not touch it
    const after = (await api.request('GET', `/gst/worklist?period=${period}&status=EXCLUDED`, undefined, MGR)).body
      .find((r: any) => r.id === before.id);
    expect(after, 'the excluded verdict survives a re-match').toBeTruthy();
    expect(after.resolution_note).toContain('not a real supply');
  });

  test('GSTRECON-6 locking a period snapshots the ITC ledger and blocks a second lock @edge', async ({ api }) => {
    const period = periodFor('02');
    const inv = await completedInvoice(api, 'lock', period);
    test.skip(!inv.suppliergstin, 'seeded vendor has no GSTIN - nothing to match on');

    await api.request('POST', '/gst/import', {
      period, source: '2B',
      file: [{
        supplier_gstin: inv.suppliergstin, invoice_no: inv.invoiceno, invoice_date: inv.invoicedate,
        invoice_value: inv.total, taxable_value: inv.total * 0.85, cgst: inv.total * 0.075, sgst: inv.total * 0.075, igst: 0,
      }],
    }, MGR);
    await api.request('POST', '/gst/match', { period }, MGR);

    const lock1 = await api.request('POST', `/gst/periods/${period}/lock`, {}, MGR);
    expect(lock1.status).toBeLessThan(300);
    expect(lock1.body.status).toBe('LOCKED');
    expect(Number(lock1.body.itcavailable)).toBeGreaterThan(0);

    const lock2 = await api.request('POST', `/gst/periods/${period}/lock`, {}, MGR);
    expect(lock2.status).toBeGreaterThanOrEqual(400); // already locked

    const fetched = (await api.request('GET', `/purchases/${inv.id}`, undefined, MGR)).body;
    expect(fetched.gstreconstatus).toBe('MATCHED');
  });
});
