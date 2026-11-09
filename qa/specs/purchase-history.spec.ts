/**
 * Purchase history from an invoice line - PHIST-1..3
 * A clock icon next to the product name on a purchase invoice line opens a dialog with the product's earlier purchases on received invoices:
 * date, invoice (or challan) number, vendor, batch, expiry, quantity, free, MRP, rate, discount and tax, with the net rate and the last, lowest
 * and highest paid. The invoice the line is on is left out, and the vendor of that invoice is marked.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const run = Date.now().toString().slice(-7);

async function vendors(api: any) {
  const list = (await api.request('GET', '/vendors', undefined, MGR)).body as any[];
  expect(list.length, 'the database has at least two vendors').toBeGreaterThan(1);
  return [list[0], list[1]];
}

/** a received invoice (or a draft) with one line of the product */
async function invoice(api: any, o: { vendorid: number; invoiceno: string | null; challanno?: string; date: string; productid: number; batch: string; exp: string; qty: number; free: number; mrp: number; rate: number; disc: number; tax: number; complete: boolean; status?: string }) {
  const inv = await api.request('POST', '/purchases', { vendorid: o.vendorid, invoiceno: o.invoiceno, challanno: o.challanno, invoicedate: o.date }, MGR);
  expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
  const total = Math.round(o.qty * o.rate * (1 - o.disc / 100) * (1 + o.tax / 100) * 100) / 100;
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: o.productid, qty: o.qty, freeqty: o.free, ptrvalue: o.rate, ptrcost: o.rate, mrpcost: o.mrp, saleprice: o.mrp, discpcnt: o.disc, taxpcnt: o.tax, total, batch: o.batch, expdate: o.exp,
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  if (o.complete) {
    await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: o.status ?? 'VERIFIED' } }, MGR);
    const done = await api.request('PUT', '/purchases/confirm', { ids: [inv.body.id], values: { status: 'COMPLETE', total } }, MGR);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
  }
  return { id: inv.body.id as number, itemId: it.body.id as number };
}

async function product(api: any, tag: string) {
  const p = await api.request('POST', '/products', { title: `QA PHIST ${tag} ${run}`, taxpcnt: 12, category: 'Analgesic', code: `PH${tag}${run}`, pack: 1 }, MGR);
  expect(p.status, JSON.stringify(p.body)).toBeLessThan(300);
  return p.body.id as number;
}

test.describe('Purchase history on an invoice line @p1', () => {
  test('PHIST-1 the history lists earlier purchases with their figures, newest first, without the invoice being looked at @happy', async ({ api, app }) => {
    const [a, b] = await vendors(api);
    const productid = await product(api, 'A');
    await invoice(api, { vendorid: a.id, invoiceno: `QA-PH1-${run}`, date: '2026-06-01', productid, batch: 'PHA1', exp: '2028-06-30', qty: 10, free: 1, mrp: 100, rate: 70, disc: 10, tax: 12, complete: true });
    await invoice(api, { vendorid: b.id, invoiceno: null, challanno: `CH-PH2-${run}`, date: '2026-08-01', productid, batch: 'PHB1', exp: '2029-01-31', qty: 20, free: 0, mrp: 110, rate: 75, disc: 0, tax: 5, complete: true });
    // a draft invoice that is not received, and one with the line rejected: neither is a purchase
    await invoice(api, { vendorid: b.id, invoiceno: `QA-PH3-${run}`, date: '2026-09-01', productid, batch: 'PHDRAFT', exp: '2029-01-31', qty: 5, free: 0, mrp: 120, rate: 90, disc: 0, tax: 5, complete: false });
    const now = await invoice(api, { vendorid: a.id, invoiceno: `QA-PH4-${run}`, date: '2026-10-01', productid, batch: 'PHNOW', exp: '2029-05-31', qty: 8, free: 0, mrp: 105, rate: 72, disc: 5, tax: 12, complete: false });

    // the API: received invoices only, newest first, with the net rate and the summary; the invoice being looked at is left out
    const h = await api.request('GET', `/purchaseitems/history/${productid}?exclude=${now.id}`, undefined, MGR);
    expect(h.status, JSON.stringify(h.body)).toBe(200);
    expect(h.body.lines.map((l: any) => l.batch)).toEqual(['PHB1', 'PHA1']);
    expect(h.body.lines[0]).toMatchObject({ doc_no: `CH-PH2-${run}`, vendor: b.business_name ?? b.name, qty: 20, free_qty: 0, mrp_cost: 110, ptr_value: 75, disc_pcnt: 0, tax_pcnt: 5, net_rate: 75, same_vendor: false });
    expect(h.body.lines[1]).toMatchObject({ doc_no: `QA-PH1-${run}`, qty: 10, free_qty: 1, mrp_cost: 100, ptr_value: 70, disc_pcnt: 10, tax_pcnt: 12, net_rate: 63, same_vendor: true });
    expect(h.body.summary).toMatchObject({ count: 2, last: { rate: 75 }, lowest: { rate: 63 }, highest: { rate: 75 } });
    // without the exclusion the same two are returned (the draft is not a purchase)
    expect((await api.request('GET', `/purchaseitems/history/${productid}`, undefined, MGR)).body.lines.length).toBe(2);

    // the screen, with real clicks
    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${now.id}`);
    await page.getByTestId(`item-history-${now.itemId}`).click();
    const dialog = page.getByTestId('purchase-history');
    await expect(dialog.getByTestId('ph-title')).toContainText(`QA PHIST A ${run}`);
    await expect(dialog.getByTestId('ph-row')).toHaveCount(2);
    const first = dialog.getByTestId('ph-row').nth(0);
    await expect(first).toContainText('01 Aug 2026');
    await expect(first).toContainText(`CH-PH2-${run}`);
    await expect(first).toContainText('PHB1');
    await expect(first).toContainText('Jan-29');
    await expect(first).toContainText('110.00');
    await expect(first).toContainText('75.00');
    await expect(first).toContainText('5%');
    const second = dialog.getByTestId('ph-row').nth(1);
    await expect(second).toContainText('PHA1');
    await expect(second).toContainText('10%');
    await expect(second).toContainText('63.00');                                          // the net rate
    await expect(second).toContainText('this vendor');                                    // the vendor of the invoice being looked at
    await expect(first).not.toContainText('this vendor');
    await expect(dialog.getByTestId('ph-summary')).toContainText('Last paid 75.00');
    await expect(dialog.getByTestId('ph-summary')).toContainText('Lowest 63.00');
    await expect(dialog.getByTestId('ph-summary')).toContainText('Highest 75.00');
    await expect(dialog).not.toContainText('PHNOW');                                      // not the line it was opened from
    await expect(dialog).not.toContainText('PHDRAFT');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('purchase-history')).toHaveCount(0);
  });

  test('PHIST-2 a product never bought before says so @edge', async ({ api, app }) => {
    const [a] = await vendors(api);
    const productid = await product(api, 'B');
    const now = await invoice(api, { vendorid: a.id, invoiceno: `QA-PH5-${run}`, date: '2026-10-02', productid, batch: 'PHFIRST', exp: '2029-05-31', qty: 8, free: 0, mrp: 105, rate: 72, disc: 0, tax: 12, complete: false });
    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${now.id}`);
    await page.getByTestId(`item-history-${now.itemId}`).click();
    await expect(page.getByTestId('ph-empty')).toContainText('No earlier purchase');
    await expect(page.getByTestId('ph-row')).toHaveCount(0);
  });

  test('PHIST-3 the history needs a product, and a line rejected on its invoice is not a purchase @negative', async ({ api }) => {
    expect((await api.request('GET', '/purchaseitems/history/0', undefined, MGR)).status).toBe(400);
    const [a] = await vendors(api);
    const productid = await product(api, 'C');
    await invoice(api, { vendorid: a.id, invoiceno: `QA-PH6-${run}`, date: '2026-07-01', productid, batch: 'PHREJ', exp: '2029-05-31', qty: 8, free: 0, mrp: 105, rate: 72, disc: 0, tax: 12, complete: true, status: 'REJECTED' });
    const h = await api.request('GET', `/purchaseitems/history/${productid}`, undefined, MGR);
    expect(h.status).toBe(200);
    expect(h.body.lines.find((l: any) => l.batch === 'PHREJ'), 'a rejected line is not a purchase').toBeUndefined();
  });
});
