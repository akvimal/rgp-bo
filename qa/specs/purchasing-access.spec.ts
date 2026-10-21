/**
 * Purchasing access by role, and the grouped menu — PACC-1..3
 * The menu only hid buttons; the purchasing API itself now checks the role's `purchases` permission.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

test.describe('Purchasing access and menu @p0', () => {
  test('PACC-1 Sales Staff can read purchasing data but cannot change it @negative', async ({ api }) => {
    // reads stay open to a role with purchases.read
    expect((await api.request('GET', '/vendors', undefined, SALES)).status).toBe(200);
    expect((await api.request('GET', '/purchases/summary', undefined, SALES)).status).toBe(200);

    const inv = (await api.request('GET', '/purchases/search?view=pending&limit=1', undefined, MGR)).body.data?.[0];
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body[0];
    const denied = async (method: string, path: string, body?: any) => {
      const r = await api.request(method, path, body, SALES);
      expect(r.status, `${method} ${path}`).toBe(403);
    };
    if (inv) {
      await denied('POST', '/vendorpayments', { vendorid: inv.vendor_id, invoiceid: inv.id, paydate: '2026-09-04', amount: 1, paymode: 'Cash' });
      await denied('POST', `/purchases/${inv.id}/hold`, { reason: 'sales staff should not' });
      await denied('POST', `/purchases/${inv.id}/release`);
    }
    await denied('POST', '/vendors', { name: 'Sales Staff Vendor' });
    await denied('PUT', `/vendors/${vendor.id}`, { name: 'x' });
    await denied('POST', `/vendors/${vendor.id}/block`, { reason: 'no way' });
    await denied('POST', '/purchaseorders', { vendorid: vendor.id });
  });

  test('PACC-1b Sales Staff can raise a purchase request but not edit, review or delete one @edge', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
    const made = await api.request('POST', '/purchaserequests', { productid: data.m.products[7].id, qty: 3, vendorid: vendor.id }, SALES);
    expect(made.status).toBeLessThan(300);
    const id = made.body.id;
    try {
      expect((await api.request('PUT', `/purchaserequests/${id}`, { status: 'Reviewed' }, SALES)).status).toBe(403);
      expect((await api.request('DELETE', `/purchaserequests/${id}`, undefined, SALES)).status).toBe(403);
      expect((await api.request('GET', '/purchaserequests', undefined, SALES)).status).toBe(200);
    } finally {
      await api.request('DELETE', `/purchaserequests/${id}`, undefined, MGR);
    }
  });

  test('PACC-2 the Business Head can still do all of it @happy', async ({ api }) => {
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
    const po = await api.request('POST', '/purchaseorders', { vendorid: vendor.id }, MGR);
    expect(po.status).toBeLessThan(300);
    const filtered = await api.request('POST', '/purchaserequests/filter', {}, SALES);
    expect(filtered.status).not.toBe(403);   // a read-only POST stays open to read access
  });

  test('PACC-3 the menu is grouped into sections and follows the role @happy', async ({ app }) => {
    const bh = await app.open(MGR, '/secure/dashboard');
    await expectShell(bh.page);
    for (const s of ['sell', 'stock', 'buy', 'oversight', 'admin']) await expect(bh.page.getByTestId(`nav-section-${s}`)).toBeVisible();
    await expect(bh.page.getByTestId('nav-vendors')).toHaveCount(0);    // Vendors is a tab of Purchase now
    await bh.page.getByTestId('nav-purchases').click();
    await expect(bh.page.getByTestId('nav-vendors')).toBeVisible();

    const sales = await app.open(SALES, '/secure/sales/pos');
    await expectShell(sales.page);
    await expect(sales.page.getByTestId('nav-section-sell')).toBeVisible();
    await expect(sales.page.getByTestId('nav-section-admin')).toHaveCount(0);
    await expect(sales.page.getByTestId('nav-section-oversight')).toHaveCount(0);
    await expect(sales.page.getByTestId('nav-dashboard')).toHaveCount(0);   // not open to this role
    await expect(sales.page.getByTestId('nav-vendors')).toHaveCount(0);
    await expect(sales.page.getByTestId('nav-purchases')).toHaveCount(0);   // no purchasing workspace ...
    await expect(sales.page.getByTestId('nav-purchase-requests')).toBeVisible();   // ... only the requests page
    await sales.page.getByTestId('nav-purchase-requests').click();
    await expect(sales.page).toHaveURL(/purchases\/my-requests/);
    await expect(sales.page.getByTestId('nav-payables')).toHaveCount(0);
  });
});
