/**
 * Products that never expire — NOEXP-1..3
 * A line needs its expiry, except for a product with the "No expiry date" property (a blade, a thermometer). Such a line is
 * received and sold like any other, and shows no expiry.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

async function product(api: any, noexpiry: boolean) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100)}`;
  const r = await api.request('POST', '/products', {
    title: `QA ${noexpiry ? 'BLADE' : 'TABLET'} ${stamp}`, taxpcnt: 12, pack: 1, category: 'OTC', code: `NE${stamp}`,
    props: noexpiry ? { subcategory: 'Surgical', noexpiry: true } : { subcategory: 'Other' },
  }, MGR);
  expect(r.status).toBeLessThan(300);
  return r.body;
}

async function draft(api: any) {
  const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
  return (await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA/NE-${Date.now()}`, invoicedate: '2026-09-04' }, MGR)).body.id;
}

const line = (invoiceid: number, productid: number, extra: any = {}) => ({
  invoiceid, productid, qty: 20, ptrvalue: 10, ptrcost: 11.2, mrpcost: 15, taxpcnt: 12, total: 200, batch: `NE${Date.now()}`.slice(0, 12), saleprice: 14, ...extra,
});

test.describe('Products with no expiry @p1', () => {
  test('NOEXP-1 a line needs an expiry unless the product is marked as never expiring @negative', async ({ api }) => {
    const medicine = await product(api, false);
    const blade = await product(api, true);
    const inv = await draft(api);

    const refused = await api.request('POST', '/purchaseitems', line(inv, medicine.id), MGR);
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toContain('expiry date is required');
    expect(JSON.stringify(refused.body)).toContain('No expiry date');

    expect((await api.request('POST', '/purchaseitems', line(inv, medicine.id, { expdate: '2028-06-01' }), MGR)).status).toBeLessThan(300);
    const ok = await api.request('POST', '/purchaseitems', line(inv, blade.id), MGR);
    expect(ok.status).toBeLessThan(300);
    expect(ok.body.expdate ?? null).toBeNull();

    await api.request('DELETE', `/purchases/${inv}`, undefined, MGR);
  });

  test('NOEXP-2 a no-expiry line is received, listed in stock, sold and read back without an expiry @happy', async ({ api }) => {
    const blade = await product(api, true);
    const inv = await draft(api);
    const batch = `NB${Date.now()}`.slice(0, 12);
    const it = await api.request('POST', '/purchaseitems', line(inv, blade.id, { batch }), MGR);
    expect(it.status).toBeLessThan(300);
    await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
    expect((await api.request('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } }, MGR)).status).toBeLessThan(300);

    const stock = (await api.request('POST', '/stock/filter', { available: true, id: blade.id }, MGR)).body;
    const row = stock.find((x: any) => x.batch === batch);
    expect(row, 'the received batch is in stock').toBeTruthy();
    expect(row.exp_date ?? row.expdate ?? null).toBeNull();

    const now = new Date().toISOString();
    const sale = await api.request('POST', '/sales', {
      customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: 14, digiamt: 0, total: 14, discamount: 0, expreturndays: 7, status: 'COMPLETE',
      ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: row.item_id, productid: blade.id, batch, price: 14, mrpcost: 15, taxpcnt: 12, qty: 1, total: 14 }],
    }, CASHIER);
    expect(sale.status).toBeLessThan(300);
    const back = (await api.request('GET', `/sales/${sale.body.id}`, undefined, MGR)).body;
    expect(back.items?.[0]?.expdate ?? null).toBeNull();
  });

  test('NOEXP-3 the item form: the expiry box is off for a no-expiry product and required for a medicine @happy', async ({ app, api }) => {
    const medicine = await product(api, false);
    const blade = await product(api, true);
    const inv = await draft(api);
    const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${inv}`);
    const pick = async (title: string) => {
      await page.locator('app-invoice-item-form app-product-select input').fill(title);
      await page.locator('.p-autocomplete-item').first().click();
    };
    const fill = async () => {
      await page.locator('#qty').fill('5');
      await page.locator('#ptr').fill('10');
      await page.locator('#mrp').fill('15');
      await page.locator('#taxpcnt').fill('12');
    };

    await pick(blade.title);
    await expect(page.locator('p-calendar[data-testid="item-exp"] input')).toBeDisabled();
    await fill();
    await expect(page.getByTestId('item-add')).toBeEnabled();                                       // no expiry needed

    await page.reload();
    await pick(medicine.title);
    await expect(page.locator('p-calendar[data-testid="item-exp"] input')).toBeEnabled();
    await fill();
    await expect(page.getByTestId('item-add')).toBeDisabled();                                      // a medicine needs its expiry
    await api.request('DELETE', `/purchases/${inv}`, undefined, MGR);
  });
});
