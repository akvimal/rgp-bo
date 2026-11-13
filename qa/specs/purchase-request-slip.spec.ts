/**
 * Purchase requests, phase A (docs/planning/PURCHASE_REQUEST_SLIPS_AND_STORES.md)
 * Several products in one request (a slip), the asking store on every request, and a store's staff seeing their whole store's requests.
 */
import { test, expect } from '../fixtures/index.js';

const BUYER = 'businesshead@local.test';
const STAFF_A = 'sales1@local.test';          // store 1
const STAFF_A2 = 'sales2@local.test';         // store 1
const STAFF_B = 'cashier.rgppharm20@qa.local'; // another store

const slipBody = (over: any = {}) => ({
  requesttype: 'Ad Hoc', source: 'Staff', priority: 'High', neededby: '2027-01-15', comments: 'for the shelf',
  lines: [{ productid: 201, qty: 4 }, { productid: 202, qty: 2, note: 'strips' }, { requestedname: `QA Slip Typed ${Date.now()}`, qty: 1 }],
  ...over,
});

test.describe('Purchase request slips @p1', () => {
  test('PRS-1 a slip raises one request per product, sharing the fields, for the asking store; a repeated product is added up', async ({ api }) => {
    const r = await api.request('POST', '/purchaserequests/slip', slipBody({ lines: [
      { productid: 201, qty: 4 }, { productid: 202, qty: 2, note: 'strips' }, { productid: 201, qty: 3, note: 'loose' }, { requestedname: `QA Slip Typed ${Date.now()}`, qty: 1 },
    ] }), STAFF_A);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(r.body.requests).toHaveLength(3);                       // 201 twice became one line
    const byProduct = (id: number) => r.body.requests.find((x: any) => x.productid === id);
    expect(byProduct(201).qty).toBe(7);
    expect(byProduct(201).comments).toBe('for the shelf | loose');
    expect(byProduct(202).comments).toBe('for the shelf | strips');
    for (const x of r.body.requests) {
      expect(x).toMatchObject({ groupid: r.body.groupid, storeid: r.body.storeid, priority: 'High', status: 'Open', source: 'Staff' });
      expect(String(x.neededby)).toContain('2027-01-15');
    }
    expect(r.body.storeid).toBeTruthy();
  });

  test('PRS-2 a slip is checked: at least one product, whole quantities from 1, a product or a name on every line @negative', async ({ api }) => {
    const post = (b: any) => api.request('POST', '/purchaserequests/slip', b, STAFF_A);
    expect((await post(slipBody({ lines: [] }))).status).toBe(400);
    expect((await post(slipBody({ lines: [{ productid: 201, qty: 0 }] }))).status).toBe(400);
    expect((await post(slipBody({ lines: [{ productid: 201, qty: 1.5 }] }))).status).toBe(400);
    expect((await post(slipBody({ lines: [{ qty: 2 }] }))).status).toBe(400);
    expect((await post(slipBody({ storeid: 99999 }))).status).toBe(400);
    expect((await api.request('POST', '/purchaserequests', { productid: 201, qty: 0, source: 'Staff', requesttype: 'Ad Hoc', priority: 'Normal' }, STAFF_A)).status).toBe(400);
  });

  test('PRS-3 the whole store sees the slip without the vendor; another store does not; the buyer sees the store and vendor @edge', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors', undefined, BUYER)).body.find((v: any) => v.active !== false);
    const made = await api.request('POST', '/purchaserequests/slip', slipBody({ customername: 'QA Walk', customerphone: '9000000000' }), STAFF_A);
    expect(made.status).toBeLessThan(300);
    const ids = made.body.requests.map((x: any) => x.id);

    // a colleague of the same store sees all of it, but not the customer on a request they did not raise
    const mate = (await api.request('GET', '/purchaserequests', undefined, STAFF_A2)).body.filter((x: any) => ids.includes(x.id));
    expect(mate).toHaveLength(ids.length);
    for (const x of mate) expect(x).toMatchObject({ vendor: null, vendorid: null, notes: null, customername: null, customerphone: null });
    // the person who raised it keeps the customer
    const mine = (await api.request('GET', '/purchaserequests', undefined, STAFF_A)).body.filter((x: any) => ids.includes(x.id));
    expect(mine[0].customername).toBe('QA Walk');
    // a person from another store sees none of it
    const other = (await api.request('GET', '/purchaserequests', undefined, STAFF_B)).body.filter((x: any) => ids.includes(x.id));
    expect(other).toHaveLength(0);
    expect((await api.request('GET', `/purchaserequests/${ids[0]}`, undefined, STAFF_B)).body?.id).toBeFalsy();

    // the buyer sees the store, can filter by it and by the slip, and sets the vendor
    const all = (await api.request('POST', '/purchaserequests/filter', { groupid: made.body.groupid }, BUYER)).body;
    expect(all).toHaveLength(ids.length);
    expect(all[0].store?.location).toBeTruthy();
    const byStore = (await api.request('POST', '/purchaserequests/filter', { storeid: made.body.storeid }, BUYER)).body;
    expect(byStore.some((x: any) => x.id === ids[0])).toBe(true);
    if (vendor) expect((await api.request('PUT', `/purchaserequests/${ids[0]}`, { vendorid: vendor.id }, BUYER)).status).toBeLessThan(300);
  });

  test('PRS-4 more products can be added to a slip while a line is still open; a product already on it is raised, not repeated @edge', async ({ api }) => {
    const made = await api.request('POST', '/purchaserequests/slip', slipBody({ lines: [{ productid: 201, qty: 4 }] }), STAFF_A);
    const gid = made.body.groupid;
    const add = await api.request('POST', `/purchaserequests/slip/${gid}/lines`, { lines: [{ productid: 201, qty: 2 }, { productid: 203, qty: 5 }] }, STAFF_A2);
    expect(add.status, JSON.stringify(add.body)).toBeLessThan(300);
    expect(add.body.added).toHaveLength(1);
    expect(add.body.raised).toHaveLength(1);
    const rows = (await api.request('POST', '/purchaserequests/filter', { groupid: gid }, BUYER)).body;
    expect(rows).toHaveLength(2);
    expect(rows.find((x: any) => x.productid === 201).qty).toBe(6);
    expect(rows.find((x: any) => x.productid === 203)).toMatchObject({ qty: 5, priority: 'High', storeid: made.body.storeid });
    // a person from another store cannot add to it
    expect((await api.request('POST', `/purchaserequests/slip/${gid}/lines`, { lines: [{ productid: 203, qty: 1 }] }, STAFF_B)).status).toBe(400);
    // once every line has been taken up, a new request is needed
    for (const x of rows) await api.request('PUT', `/purchaserequests/${x.id}`, { status: 'Reviewed' }, BUYER);
    expect((await api.request('POST', `/purchaserequests/slip/${gid}/lines`, { lines: [{ productid: 203, qty: 1 }] }, STAFF_A)).status).toBe(400);
  });

  test('PRS-5 on the Requests screen several products are listed, saved as one slip, and more can be added to it @happy', async ({ app, api }) => {
    const run = Date.now();
    const names = [`QA Slip UI A ${run}`, `QA Slip UI B ${run}`, `QA Slip UI C ${run}`];
    const { page } = await app.open(STAFF_A, '/secure/purchases/requests');
    await page.getByTestId('req-add').click();
    const dlg = page.locator('.p-dialog');
    for (const [i, name] of names.slice(0, 2).entries()) {
      if (i === 0) await page.getByTestId('req-type-name').click();
      else await page.getByTestId('req-type-name').click();
      await page.getByTestId('req-requestedname').fill(name);
      await dlg.locator('input[formcontrolname=qty]').fill(String(i + 2));
      await page.getByTestId('req-add-line').click();
    }
    await expect(page.getByTestId('req-line')).toHaveCount(2);
    // what is still in the box when Save is pressed goes on the list too
    await page.getByTestId('req-type-name').click();
    await page.getByTestId('req-requestedname').fill(names[2]);
    await dlg.locator('input[formcontrolname=qty]').fill('5');
    await dlg.getByRole('button', { name: 'Save Request' }).click();
    await expect(dlg).toBeHidden();

    for (const name of names) await expect(page.locator('tr', { hasText: name })).toHaveCount(1);
    const rows = (await api.request('GET', '/purchaserequests', undefined, BUYER)).body.filter((r: any) => names.includes(r.requestedname));
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r: any) => r.groupid)).size).toBe(1);
    expect(rows.map((r: any) => r.qty).sort()).toEqual([2, 3, 5]);
    await expect(page.locator('tr', { hasText: names[0] }).getByTestId('req-slip')).toContainText('3');

    // more for the same slip: the shared details are not asked again
    await page.locator('tr', { hasText: names[0] }).getByTestId('req-add-more').click();
    await expect(page.getByTestId('req-adding-to')).toBeVisible();
    await expect(dlg.locator('select[formcontrolname=source]')).toHaveCount(0);
    const extra = `QA Slip UI D ${run}`;
    await page.getByTestId('req-type-name').click();
    await page.getByTestId('req-requestedname').fill(extra);
    await dlg.locator('input[formcontrolname=qty]').fill('7');
    await dlg.getByRole('button', { name: 'Save Request' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.locator('tr', { hasText: extra })).toHaveCount(1);
    const again = (await api.request('GET', '/purchaserequests', undefined, BUYER)).body.find((r: any) => r.requestedname === extra);
    expect(again).toMatchObject({ groupid: rows[0].groupid, qty: 7, priority: rows[0].priority, storeid: rows[0].storeid });
  });

  test('PRS-6 the list shows the date and time, newest first; a new request takes the vendor the product was last bought from @happy', async ({ app, api }) => {
    const stamp = Date.now();
    const first = `QA Dated A ${stamp}`, second = `QA Dated B ${stamp}`;
    for (const n of [first, second]) {
      expect((await api.request('POST', '/purchaserequests', { requestedname: n, qty: 1, source: 'Staff', requesttype: 'Ad Hoc', priority: 'Normal' }, BUYER)).status).toBeLessThan(300);
      await new Promise((r) => setTimeout(r, 1100));
    }
    // a product that has been bought: the vendor of its newest completed invoice; a request-only role is not told
    const last = (await api.request('GET', '/purchaserequests/last-vendor/214', undefined, BUYER)).body;
    expect(last?.vendorid).toBeTruthy();
    expect(last.name).toBeTruthy();
    const none = await api.request('GET', '/purchaserequests/last-vendor/214', undefined, STAFF_A);
    expect(none.body === null || none.body === '').toBe(true);

    const { page } = await app.open(BUYER, '/secure/purchases/requests');
    const rows = page.getByTestId('req-table').locator('tbody tr');
    await expect(rows.first()).toContainText(second);                      // newest on top
    await expect(rows.first().getByTestId('req-date')).toContainText(/\d{2} \w{3} \d{4}, \d{2}:\d{2} (AM|PM)/);
    await expect(page.getByTestId('req-sort-date')).toBeVisible();
    const idx = async (n: string) => (await rows.allInnerTexts()).findIndex((t) => t.includes(n));
    expect(await idx(second)).toBeLessThan(await idx(first));

    await page.getByTestId('req-add').click();
    const dlg = page.locator('.p-dialog');
    await dlg.locator('app-product-select input').fill('Vitamin B12 250');
    await page.locator('.p-autocomplete-panel li').first().click();
    await expect(page.getByTestId('req-last-vendor')).toBeVisible();
    await expect(dlg.locator('select[formcontrolname=vendorid]')).toHaveValue(String(last.vendorid));
  });
});
