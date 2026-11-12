/**
 * The till bills the purchase GST unless a dated change says otherwise - GSTP-1
 * With no cap in force a product is billed at the GST of its purchase item; a change for the product (or its category, HSN, or all products) takes over
 * from its effective date, even when the product was bought at a different rate; one that starts later does nothing today.
 */
import { test, expect } from '../fixtures/index.js';
import { setSeededCap } from '../fixtures/gst-cap.js';

const MGR = 'businesshead@local.test';
const run = Date.now().toString().slice(-7);
const day = (offset: number) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);

test.describe('GST purchase default @p1', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(() => setSeededCap(false));

  test('GSTP-1 the purchase GST is billed; a dated change takes over only from its date @happy', async ({ api }) => {
    const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
    const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-GSTP-${run}`, invoicedate: '2026-07-01' }, MGR);
    const prod = await api.request('POST', '/products', { title: `QA GSTP ${run}`, taxpcnt: 12, category: `QA GSTP ${run}`, code: `GP${run}`, pack: 1, props: {} }, MGR);
    expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
    const it = await api.request('POST', '/purchaseitems', {
      invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: 70, ptrcost: 78.4, mrpcost: 112, saleprice: 100, taxpcnt: 12, total: 3500, batch: `GP-${run}`, expdate: '2028-06-30',
    }, MGR);
    expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
    const billed = async () => Number((await api.request('POST', '/stock/filter', { id: prod.body.id, limit: 5 }, MGR)).body[0].sale_tax);

    const list = (await api.request('GET', '/gst/rate-changes', undefined, MGR)).body;
    expect(list.changes.some((c: any) => c.scope_type === 'all' && c.mode === 'cap' && !c.cancelled), 'no cap in force').toBe(false);
    expect(await billed()).toBe(12);                                                                  // the purchase item's own GST

    const change = (over: any) => ({ scope_type: 'product', scope_value: String(prod.body.id), mode: 'set', rate: 2, effective_from: day(0), price_policy: 'pass_saving', note: `QA ${run}`, ...over });
    const later = await api.request('POST', '/gst/rate-changes', change({ effective_from: day(30) }), MGR);
    expect(later.status, JSON.stringify(later.body)).toBeLessThan(300);
    expect(await billed()).toBe(12);                                                                  // next month's change does not apply today
    const now = await api.request('POST', '/gst/rate-changes', change({}), MGR);
    expect(now.status, JSON.stringify(now.body)).toBeLessThan(300);
    expect(await billed()).toBe(2);                                                                   // from its date, though it was bought at 12
  });
});
