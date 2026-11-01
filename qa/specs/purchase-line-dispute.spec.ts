/**
 * Receiving: lines in dispute, the tax rates a line offers, and the flags on a line being typed — PDISP-1..3
 * A draft line can be moved into dispute (it leaves the invoice total and blocks completion), then accepted or rejected; the tax rates come from the business
 * type (pharmacy 0, 5, 18) or the business's own list; an MRP far above the rate is flagged and a new product's best margin is reported.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const run = Date.now().toString().slice(-7);

async function product(api: any, tag: string) {
  const prod = await api.request('POST', '/products', { title: `QA PDISP ${tag}`, taxpcnt: 5, category: 'Analgesic', code: `PD${tag}`, pack: 1, props: {} }, MGR);
  expect(prod.status, JSON.stringify(prod.body)).toBeLessThan(300);
  return prod.body.id as number;
}

async function invoice(api: any, tag: string) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-PD-${tag}`, invoicedate: '2026-10-01' }, MGR);
  expect(inv.status, JSON.stringify(inv.body)).toBeLessThan(300);
  return inv.body.id as number;
}

async function line(api: any, invoiceid: number, productid: number, tag: string, qty = 10, rate = 50, mrp = 100) {
  const total = qty * rate;
  const it = await api.request('POST', '/purchaseitems', { invoiceid, productid, qty, ptrvalue: rate, ptrcost: rate * 1.05, mrpcost: mrp, saleprice: mrp, taxpcnt: 5, total, batch: `PD-${tag}`, expdate: '2028-06-30' }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  return it.body.id as number;
}

const header = async (api: any, id: number) => (await api.request('GET', `/purchases/${id}`, undefined, MGR)).body;
const status = (inv: any, itemid: number) => inv.items.find((i: any) => i.id === itemid);

test.describe('Receiving: disputes, tax rates and flags @p1', () => {
  test('PDISP-1 a disputed line leaves the invoice total and blocks completion until it is accepted or rejected @happy', async ({ api }) => {
    const inv = await invoice(api, `a-${run}`);
    const a = await line(api, inv, await product(api, `a-${run}`), `a-${run}`, 10, 50);      // 500
    const b = await line(api, inv, await product(api, `b-${run}`), `b-${run}`, 4, 25);       // 100
    expect(+(await header(api, inv)).total).toBe(600);

    // a note is needed, and only a line of a draft can be disputed
    expect((await api.request('POST', '/purchaseitems/dispute', { ids: [a], note: '' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/purchaseitems/dispute', { ids: [a], note: 'Rate is 12% above the last bill; vendor to confirm' }, MGR)).status).toBeLessThan(300);
    let h = await header(api, inv);
    expect(status(h, a)).toMatchObject({ status: 'DISPUTED', disputenote: 'Rate is 12% above the last bill; vendor to confirm' });
    expect(+h.total).toBe(100);                                                                // the disputed line is not counted

    // completion is blocked while a line is in dispute, even with the other verified
    expect((await api.request('PUT', '/purchaseitems', { ids: [b], values: { status: 'VERIFIED' } }, MGR)).status).toBeLessThan(300);
    const blocked = await api.request('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } }, MGR);
    expect(blocked.status).toBe(400);
    expect(JSON.stringify(blocked.body)).toContain('in dispute');

    // accepted: back to a draft line, counted again
    expect((await api.request('POST', '/purchaseitems/resolve', { ids: [a], action: 'ACCEPT' }, MGR)).status).toBeLessThan(300);
    h = await header(api, inv);
    expect(status(h, a)).toMatchObject({ status: 'NEW', disputeresult: 'ACCEPTED' });
    expect(+h.total).toBe(600);

    // disputed again and rejected: needs words, the line total becomes 0 and the original is kept
    expect((await api.request('POST', '/purchaseitems/dispute', { ids: [a], note: 'Still not agreed' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', '/purchaseitems/resolve', { ids: [a], action: 'REJECT', note: '' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/purchaseitems/resolve', { ids: [a], action: 'REJECT', note: 'Vendor would not revise the rate' }, MGR)).status).toBeLessThan(300);
    h = await header(api, inv);
    expect(+status(h, a).total).toBe(0);
    expect(status(h, a)).toMatchObject({ status: 'REJECTED', rejectedtotal: 500, disputeresultnote: 'Vendor would not revise the rate' });
    expect(+h.total).toBe(100);
    // a rejected line cannot be resolved again, and the invoice completes with the lines that remain
    expect((await api.request('POST', '/purchaseitems/resolve', { ids: [a], action: 'ACCEPT' }, MGR)).status).toBe(400);
    const done = await api.request('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } }, MGR);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    h = await header(api, inv);
    expect(h.status).toBe('COMPLETE');
    expect(+h.total).toBe(100);
    // nothing can be disputed once the invoice is complete
    expect((await api.request('POST', '/purchaseitems/dispute', { ids: [b], note: 'Too late to say' }, MGR)).status).toBe(400);
  });

  test('PDISP-2 the tax rates a line offers come from the business type, or the business own list @edge', async ({ api }) => {
    const rates = async () => (await api.request('GET', '/purchaseitems/tax-rates', undefined, MGR)).body.rates;
    const s = (await api.request('GET', '/settings?key=purchase_tax_rates', undefined, MGR)).body[0];
    expect(s, 'the setting exists').toBeTruthy();
    const before = String(s.value ?? s.settingvalue ?? '');
    try {
      expect((await api.request('PUT', `/settings/${s.id}`, { value: '' }, MGR)).status).toBeLessThan(300);
      expect(await rates()).toEqual([0, 5, 18]);                                                // a pharmacy
      expect((await api.request('PUT', `/settings/${s.id}`, { value: '18, 0 ,5,5,12' }, MGR)).status).toBeLessThan(300);
      expect(await rates()).toEqual([0, 5, 12, 18]);
      expect((await api.request('PUT', `/settings/${s.id}`, { value: 'rubbish' }, MGR)).status).toBeLessThan(300);
      expect(await rates()).toEqual([0, 5, 18]);                                                // unreadable: the usual rates
    } finally {
      await api.request('PUT', `/settings/${s.id}`, { value: before }, MGR);
    }
  });

  test('PDISP-3 an MRP far above the rate is flagged, and a new product reports its best margin @happy', async ({ api }) => {
    const pid = await product(api, `c-${run}`);
    const check = async (mrp: number, ptr: number) => (await api.request('POST', '/pricing/line-check', { productid: pid, mrp, ptrvalue: ptr, qty: 10, tax: 5 }, MGR)).body;

    const inflated = await check(1000, 100);                                                    // MRP (ex GST ~952) is about 9.5 times the rate
    expect(inflated).toMatchObject({ ready: true, isnew: true, ratioflag: true });
    expect(inflated.ratio).toBeGreaterThan(inflated.ratiothreshold);
    expect(inflated.bestmarkuppct).toBeGreaterThan(500);

    const ordinary = await check(120, 100);                                                     // about 1.1 times the rate: no flag
    expect(ordinary).toMatchObject({ ready: true, ratioflag: false });
    expect(ordinary.ratio).toBeLessThan(ordinary.ratiothreshold);
    expect(typeof ordinary.bestmarkuppct).toBe('number');

    // nothing typed yet, or a product that is not chosen
    expect((await api.request('POST', '/pricing/line-check', { productid: pid, mrp: 0, ptrvalue: 0 }, MGR)).body).toMatchObject({ ready: false });
    expect((await api.request('POST', '/pricing/line-check', { mrp: 100, ptrvalue: 50 }, MGR)).status).toBe(400);

    // a product that has been bought before is no longer new
    const inv = await invoice(api, `c-${run}`);
    const it = await line(api, inv, pid, `c-${run}`, 5, 100, 120);
    expect((await api.request('PUT', '/purchaseitems', { ids: [it], values: { status: 'VERIFIED' } }, MGR)).status).toBeLessThan(300);
    expect((await api.request('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } }, MGR)).status).toBeLessThan(300);
    expect((await check(120, 100)).isnew).toBe(false);
  });
});
