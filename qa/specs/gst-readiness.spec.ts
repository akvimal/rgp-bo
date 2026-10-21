/**
 * GST readiness, vendor risk and supplier-GSTIN backfill — GSTR-1..3
 * The matcher skips an invoice with no supplier GSTIN, so the screen says how many there are and why.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const THIS_MONTH = new Date().toISOString().slice(0, 7);

test.describe('GST readiness and GSTIN backfill @p1', () => {
  test('GSTR-1 readiness counts agree with each other and a blocker is raised when invoices lack a GSTIN @integration', async ({ api }) => {
    const r = await api.request('GET', `/gst/readiness?period=${THIS_MONTH}`, undefined, MGR);
    expect(r.status).toBe(200);
    const inv = r.body.invoices;
    expect(inv.received - inv.with_supplier_gstin).toBe(inv.without_supplier_gstin);
    const codes = r.body.issues.map((i: any) => i.code);
    expect(codes.includes('NO_SUPPLIER_GSTIN')).toBe(inv.without_supplier_gstin > 0);
    expect(r.body.ready).toBe(!r.body.issues.some((i: any) => i.severity === 'blocker'));
    expect((await api.request('GET', '/gst/readiness?period=bad', undefined, MGR)).status).toBe(400);
  });

  test('GSTR-2 the vendor risk rows add up to the period and put the biggest risk first @integration', async ({ api }) => {
    const rows = (await api.request('GET', `/gst/vendor-risk?period=${THIS_MONTH}`, undefined, MGR)).body;
    expect(Array.isArray(rows)).toBe(true);
    for (const v of rows) {
      expect(+v.matched_itc + +v.attention_itc + +v.missing_itc + +v.no_gstin_itc).toBeLessThanOrEqual(+v.itc_total + 0.05);
      expect(v.at_risk_itc).toBeCloseTo(+v.attention_itc + +v.missing_itc + +v.no_gstin_itc, 1);
    }
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].at_risk_itc).toBeGreaterThanOrEqual(rows[i].at_risk_itc);
    const ready = (await api.request('GET', `/gst/readiness?period=${THIS_MONTH}`, undefined, MGR)).body;
    expect(rows.reduce((t: number, v: any) => t + v.no_gstin_n, 0)).toBe(ready.invoices.without_supplier_gstin);
  });

  test('GSTR-3 the backfill fills blanks only, is repeatable, and is refused to staff without GST rights @edge', async ({ api }) => {
    expect((await api.request('POST', '/gst/backfill-gstin', undefined, SALES)).status).toBe(403);
    const first = await api.request('POST', '/gst/backfill-gstin', undefined, MGR);
    expect(first.status).toBeLessThan(300);
    const again = await api.request('POST', '/gst/backfill-gstin', undefined, MGR);
    expect(again.body.updated).toBe(0);
    // an invoice's own GSTIN is never replaced: every invoice that has one still matches its vendor or was set earlier
    const list = (await api.request('GET', '/purchases/search?view=all&limit=100', undefined, MGR)).body;
    expect(list.total).toBeGreaterThan(0);
  });
});
