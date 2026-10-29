/**
 * GST rate changes and HSN - GR-1..6
 * A change of rate is dated and covers all products, a category, an HSN prefix or one product; the most specific in force wins; a bill is billed at the
 * rate in force on its date; a change not yet in force can be withdrawn and one in force cannot; keeping the price needs a confirmation; a product with no
 * HSN is never blocked and can be filled from its purchases, by a category default, or by hand; only the Business Head may do any of it.
 * Each test makes its own product (and category), so a change left in force touches nothing else.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const run = Date.now().toString().slice(-7);
const day = (offset: number) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);

/** a fresh product in its own category with one batch at 12% GST, MRP 112 per pack of 1 */
async function product(api: any, tag: string, over: { hsn?: string; batchHsn?: string; category?: string } = {}) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-GR-${tag}`, invoicedate: '2026-07-01' }, MGR);
  const category = over.category ?? `QA GST ${tag}`;
  const prod = await api.request('POST', '/products', { title: `QA GST ${tag}`, taxpcnt: 12, category, code: `GR${tag}`, pack: 1, props: {}, ...(over.hsn ? { hsn: over.hsn } : {}) }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: 70, ptrcost: 78.4, mrpcost: 112, saleprice: 100, taxpcnt: 12, total: 3500,
    batch: `GR-${tag}`, expdate: '2028-06-30', ...(over.batchHsn ? { hsn: over.batchHsn } : {}),
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  return { id: prod.body.id as number, category, title: `QA GST ${tag}`, itemid: it.body.id };
}

/** the GST the till bills for this product today, as the stock list sends it to the till */
async function billed(api: any, id: number): Promise<number> {
  const rows = (await api.request('POST', '/stock/filter', { id, limit: 5 }, MGR)).body as any[];
  expect(rows.length, 'the product has stock rows').toBeGreaterThan(0);
  return Number(rows[0].sale_tax);
}

const change = (over: any = {}) => ({ scope_type: 'all', scope_value: '', mode: 'cap', rate: 5, effective_from: day(0), note: `QA ${run}`, ...over });

test.describe('GST rate changes and HSN @p1', () => {
  test.describe.configure({ mode: 'serial' });

  test('GR-1 the GST 2.0 cap is a dated change, and the till bills a 12% batch at 5% @happy', async ({ api }) => {
    const list = (await api.request('GET', '/gst/rate-changes', undefined, MGR)).body;
    const cap = list.changes.find((c: any) => c.scope_type === 'all' && c.mode === 'cap' && c.effective_from === '2025-09-22' && !c.cancelled);
    expect(cap, 'the old setting became a dated change').toBeTruthy();
    expect(cap.rate).toBe(5);
    expect(cap.state).toBe('in force');
    const p = await product(api, `a${run}`);
    expect(await billed(api, p.id)).toBe(5);
  });

  test('GR-2 a change is billed from its date, the most specific wins, and one in force cannot be removed @happy', async ({ api }) => {
    const p = await product(api, `b${run}`);
    // a change for the category that starts tomorrow does nothing today, and can be withdrawn
    const future = await api.request('POST', '/gst/rate-changes', change({ scope_type: 'category', scope_value: p.category, mode: 'set', rate: 4, effective_from: day(1) }), MGR);
    expect(future.status, JSON.stringify(future.body)).toBeLessThan(300);
    expect(await billed(api, p.id)).toBe(5);
    expect((await api.request('DELETE', `/gst/rate-changes/${future.body.id}`, undefined, MGR)).status).toBeLessThan(300);
    // the same change from today is billed at once
    const now = await api.request('POST', '/gst/rate-changes', change({ scope_type: 'category', scope_value: p.category, mode: 'set', rate: 4 }), MGR);
    expect(now.status, JSON.stringify(now.body)).toBeLessThan(300);
    expect(await billed(api, p.id)).toBe(4);
    // a change for the product itself beats the category's
    const own = await api.request('POST', '/gst/rate-changes', change({ scope_type: 'product', scope_value: String(p.id), mode: 'set', rate: 3 }), MGR);
    expect(own.status, JSON.stringify(own.body)).toBeLessThan(300);
    expect(await billed(api, p.id)).toBe(3);
    // one in force cannot be erased: bills were made under it
    const gone = await api.request('DELETE', `/gst/rate-changes/${now.body.id}`, undefined, MGR);
    expect(gone.status).toBe(400);
    expect(JSON.stringify(gone.body)).toMatch(/already in force/);
    // the same scope and date twice is refused
    const dup = await api.request('POST', '/gst/rate-changes', change({ scope_type: 'product', scope_value: String(p.id), mode: 'set', rate: 2 }), MGR);
    expect(dup.status).toBe(400);
  });

  test('GR-3 the preview shows what a change does, defaults to passing the saving on, and keeping the price needs a confirmation @happy', async ({ api }) => {
    const p = await product(api, `c${run}`);
    const body = change({ scope_type: 'category', scope_value: p.category, mode: 'set', rate: 5, effective_from: day(10) });
    const pre = (await api.request('POST', '/gst/rate-changes/preview', body, MGR)).body;
    expect(pre.policy_default).toBe('pass_saving');
    expect(pre.change.label).toMatch(/Category/);
    // the batch is 12% but the cap already bills 5%, so setting 5% changes nothing for this product today
    expect(pre.rows.find((r: any) => r.id === p.id)).toBeFalsy();
    // a rise to 12% does change it, and the rows carry the price choices
    const rise = (await api.request('POST', '/gst/rate-changes/preview', { ...body, rate: 12 }, MGR)).body;
    const row = rise.rows.find((r: any) => r.id === p.id);
    expect(row, JSON.stringify(rise).slice(0, 300)).toBeTruthy();
    expect(row.old_rate).toBe(5);
    expect(row.new_rate).toBe(12);
    const keep = await api.request('POST', '/gst/rate-changes', { ...body, price_policy: 'keep_price' }, MGR);
    expect(keep.status).toBe(400);
    expect(JSON.stringify(keep.body)).toMatch(/Confirm/);
    const confirmed = await api.request('POST', '/gst/rate-changes', { ...body, price_policy: 'keep_price', confirm_keep_price: true }, MGR);
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBeLessThan(300);
    const listed = (await api.request('GET', '/gst/rate-changes', undefined, MGR)).body.changes.find((c: any) => c.id === confirmed.body.id);
    expect(listed.price_policy).toBe('keep_price');
    expect(listed.state).toBe('upcoming');
    expect((await api.request('DELETE', `/gst/rate-changes/${confirmed.body.id}`, undefined, MGR)).status).toBeLessThan(300);
  });

  test('GR-4 only the Business Head may use GST, and bad input is refused @negative', async ({ api }) => {
    for (const [m, path, b] of [['GET', '/gst/rate-changes', undefined], ['POST', '/gst/rate-changes/preview', change()], ['POST', '/gst/rate-changes', change()], ['GET', '/gst/hsn/missing', undefined]] as any[]) {
      expect((await api.request(m, path, b, SALES)).status, `${m} ${path}`).toBe(403);
    }
    expect((await api.request('POST', '/gst/rate-changes', change({ rate: 41 }), MGR)).status).toBe(400);
    expect((await api.request('POST', '/gst/rate-changes', change({ scope_type: 'hsn_prefix', scope_value: 'abc' }), MGR)).status).toBe(400);
    expect((await api.request('POST', '/gst/rate-changes', change({ effective_from: 'soon' }), MGR)).status).toBe(400);
    expect((await api.request('POST', '/gst/rate-changes', change({ scope_type: 'product', scope_value: '99999999', mode: 'set' }), MGR)).status).toBe(400);
  });

  test('GR-5 a product with no HSN is not blocked: it is listed, filled from its purchase, by category default, or by hand @happy', async ({ api }) => {
    const a = await product(api, `d${run}`, { batchHsn: '30049099' });        // the vendor printed an HSN on the purchase line
    const b = await product(api, `e${run}`);                                   // nothing known
    const missing = (await api.request('GET', '/gst/hsn/missing', undefined, MGR)).body;
    expect(missing.missing).toBeGreaterThan(0);
    const ra = missing.rows.find((r: any) => r.id === a.id);
    expect(ra, 'listed as missing with a proposal').toBeTruthy();
    expect(ra.proposed).toBe('30049099');
    // accept the proposal from the purchase
    expect((await api.request('PUT', '/gst/hsn/products', { items: [{ product_id: a.id }] }, MGR)).body.updated).toBe(1);
    expect((await api.request('GET', '/gst/hsn/missing', undefined, MGR)).body.rows.find((r: any) => r.id === a.id)).toBeFalsy();
    // typing one in: a bad code is refused
    expect((await api.request('PUT', '/gst/hsn/products', { items: [{ product_id: b.id, hsn: '123' }] }, MGR)).status).toBe(400);
    // a category default is provisional until confirmed, and covers the product without writing to it
    expect((await api.request('PUT', '/gst/hsn/category', { category: b.category, hsn: '3003' }, MGR)).status).toBeLessThan(300);
    let cat = (await api.request('GET', '/gst/hsn/missing', undefined, MGR)).body.categories.find((c: any) => c.category === b.category);
    expect(cat.hsn).toBe('3003');
    expect(cat.confirmed).toBe(false);
    const pre = (await api.request('POST', '/gst/rate-changes/preview', change({ scope_type: 'hsn_prefix', scope_value: '3003', mode: 'set', rate: 12, effective_from: day(20) }), MGR)).body;
    const row = pre.rows.find((r: any) => r.id === b.id);
    expect(row, 'covered through the category default').toBeTruthy();
    expect(row.hsn_source).toBe('category');
    // confirm it, then copy it onto the products of the category
    await api.request('PUT', '/gst/hsn/category', { category: b.category, hsn: '3003', confirm: true }, MGR);
    cat = (await api.request('GET', '/gst/hsn/missing', undefined, MGR)).body.categories.find((c: any) => c.category === b.category);
    expect(cat.confirmed).toBe(true);
    expect((await api.request('POST', '/gst/hsn/category/apply', { category: b.category }, MGR)).body.updated).toBe(1);
    expect((await api.request('GET', '/gst/hsn/missing', undefined, MGR)).body.rows.find((r: any) => r.id === b.id)).toBeFalsy();
  });

  test('GR-6 a product with no HSN is still covered by a category change, and an HSN-prefix change reports what it cannot cover @edge', async ({ api }) => {
    const p = await product(api, `f${run}`);
    const byCategory = (await api.request('POST', '/gst/rate-changes/preview', change({ scope_type: 'category', scope_value: p.category, mode: 'set', rate: 12, effective_from: day(30) }), MGR)).body;
    expect(byCategory.rows.some((r: any) => r.id === p.id)).toBe(true);
    const byHsn = (await api.request('POST', '/gst/rate-changes/preview', change({ scope_type: 'hsn_prefix', scope_value: '9999', mode: 'set', rate: 12, effective_from: day(30) }), MGR)).body;
    expect(byHsn.not_covered).toBeGreaterThan(0);                                              // products whose HSN is unknown cannot be reached by an HSN change
    expect(byHsn.not_covered_sample.length).toBeGreaterThan(0);                                // a sample of them is named so they can be fixed
  });
});
