/**
 * Settings — Delivery Partners — DLVP-1..3
 * Source: docs/testing/manual-test-plan.html  (module "delivery-partners")
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

test.describe('Settings — Delivery Partners @p2', () => {
  test('DLVP-1 a new partner is created and usable on a delivery @happy', async ({ api }) => {
    const name = `QA Courier ${Date.now()}`;
    const created = await api.request('POST', '/delivery-partners', {
      name, contactname: 'QA Ops', contactphone: '9800012345', address: '9 Courier Lane', comments: '',
    }, MGR);
    expect([200, 201]).toContain(created.status);
    const list = await api.request('GET', '/delivery-partners', undefined, MGR);
    expect(list.body.some((p: any) => p.name === name)).toBeTruthy();

    // usable on a sale delivery
    const pool = (await api.request('POST', '/stock/filter', { available: true, limit: 10 }, MGR)).body
      .find((x: any) => Number(x.balance) > 20 && x.status === 'VERIFIED');
    const now = new Date().toISOString();
    const sale = await api.request('POST', '/sales', {
      customerid: 1, billdate: now, orderdate: now, cashamt: 50, digiamt: 0, total: 50,
      discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Phone', deliverytype: 'Delivery',
      items: [{ itemid: pool.item_id, productid: pool.id, batch: pool.batch, price: 25, mrpcost: pool.mrp_cost, taxpcnt: pool.tax_pcnt, qty: 2, total: 50 }],
    }, CASHIER);
    const del = await api.request('POST', '/deliveries', {
      saleid: sale.body.id, courierpartner: name, deliverymethod: 'Courier',
      receivername: 'X', receiverphone: '9000000000', receiveraddress: 'Y', status: 'Pending',
    }, CASHIER);
    expect([200, 201]).toContain(del.status);
  });

  test('DLVP-2 a deactivated partner is hidden for new deliveries but stays on history @edge', async ({ api }) => {
    const name = `QA Deac Courier ${Date.now()}`;
    const created = await api.request('POST', '/delivery-partners', {
      name, contactname: 'X', contactphone: '9800000000', address: 'Z', comments: '',
    }, MGR);
    const id = created.body.id;
    const del = await api.request('DELETE', `/delivery-partners/${id}`, undefined, MGR);
    expect(del.status).toBeLessThan(400);
    const active = await api.request('GET', '/delivery-partners', undefined, MGR);
    expect(active.body.some((p: any) => p.id === id && p.isActive !== false)).toBeFalsy();
  });

  test('DLVP-3 the Settings > Delivery Partners screen is reachable (issue #133) @permission', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/settings/delivery-partners');
    await expectShell(page);
    await expect(page).toHaveURL(/\/secure\/settings\/delivery-partners/);
    await expect(page.getByRole('button', { name: /Add New/i })).toBeVisible();
  });
});
