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
    for (const s of ['sell', 'stock', 'buy', 'people', 'oversight', 'admin']) await expect(bh.page.getByTestId(`nav-section-${s}`)).toBeVisible();

    // every page sits under the heading that describes it
    const groups = await bh.page.evaluate(() => {
      const out: Record<string, string[]> = {};
      let cur = '';
      document.querySelectorAll('#sidebar-nav > li').forEach((li) => {
        const sec = li.getAttribute('data-testid') || '';
        if (sec.startsWith('nav-section-')) { cur = sec.replace('nav-section-', ''); out[cur] = []; return; }
        const a = li.querySelector('a[data-testid^="nav-"]');
        if (a && cur) out[cur].push(a.getAttribute('data-testid') as string);
      });
      return out;
    });
    expect(groups.sell).toEqual(['nav-sales', 'nav-customers', 'nav-inquiries', 'nav-shift']);
    expect(groups.stock).toEqual(['nav-store', 'nav-products', 'nav-stock-audits']);
    expect(groups.buy).toEqual(['nav-purchases', 'nav-vendor-issues', 'nav-expenses']);
    expect(groups.people).toEqual(['nav-my-hr', 'nav-leave-approvals', 'nav-kpi-rate', 'nav-kpi-mine', 'nav-hr']);
    expect(groups.oversight).toEqual(['nav-reports', 'nav-quality', 'nav-digital-payments']);
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

  test('PACC-4 a request-only role sees only its own requests, cannot set the buying side, and gets the form from the counter @edge', async ({ app, api }) => {
    const vendor = (await api.request('GET', '/vendors', undefined, MGR)).body.find((v: any) => v.isActive !== false && !v.blocked);
    const stamp = Date.now();
    const product = data.m.products[9].id;
    // a manager's request exists; the Sales Staff user must not see it
    const theirs = await api.request('POST', '/purchaserequests', { productid: product, qty: 2, vendorid: vendor.id, notes: 'internal note' }, MGR);
    expect(theirs.status).toBeLessThan(300);

    // Sales Staff try to set the buying side of their own request
    const mine = await api.request('POST', '/purchaserequests', {
      productid: product, qty: 4, source: 'Customer', requesttype: 'Stockout', priority: 'High', customername: `QA Cust ${stamp}`,
      status: 'Ordered', orderedqty: 4, fulfilledqty: 4, vendorid: vendor.id, notes: 'sneaky',
    }, SALES);
    expect(mine.status).toBeLessThan(300);
    expect(mine.body.status).toBe('Open');
    expect(mine.body.vendorid ?? null).toBeNull();
    expect(mine.body.notes ?? null).toBeNull();
    expect(mine.body.orderedqty ?? null).toBeNull();

    const list = (await api.request('GET', '/purchaserequests', undefined, SALES)).body;
    expect(list.some((r: any) => r.id === mine.body.id)).toBe(true);
    expect(list.some((r: any) => r.id === theirs.body.id)).toBe(false);          // not someone else's
    expect(list.every((r: any) => r.vendor === null && r.notes === null)).toBe(true);
    expect((await api.request('GET', `/purchaserequests/${theirs.body.id}`, undefined, SALES)).body?.id).toBeUndefined();
    // the manager still sees both, with the buying side's fields
    const all = (await api.request('GET', '/purchaserequests', undefined, MGR)).body;
    expect(all.find((r: any) => r.id === theirs.body.id).notes).toBe('internal note');

    // the screen: no action icons, no vendor column or field for Sales Staff
    const { page } = await app.open(SALES, '/secure/purchases/my-requests');
    await expectShell(page);
    await expect(page.getByTestId('req-add')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Vendor' })).toHaveCount(0);
    await expect(page.locator('i.bi-pencil-square, i.bi-check2, i.bi-trash')).toHaveCount(0);

    // from the counter: a link below the items opens a popup to capture the request (POS-REQ-1 covers saving it)
    const pos = await app.open(SALES, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    const link = pos.page.getByTestId('pos-request-product');
    await expect(link).toBeVisible();
    await link.click();
    await expect(pos.page.getByTestId('pos-request-dialog')).toBeVisible();
    // and the Add form on the requests page still opens pre-filled from a link
    const direct = await app.open(SALES, `/secure/purchases/my-requests?add=1&cname=${encodeURIComponent('QA Counter Customer')}&cphone=9812345678`);
    await expect(direct.page.getByRole('dialog')).toBeVisible();
    await expect(direct.page.locator('input[formcontrolname=customername]')).toHaveValue('QA Counter Customer');
    await expect(direct.page.locator('input[formcontrolname=customerphone]')).toHaveValue('9812345678');
    await expect(direct.page.getByText('Vendor', { exact: true })).toHaveCount(0);
  });

  test('PACC-6 the menu stays open on a desktop; the toggle is only the phone drawer @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/dashboard');
    await expectShell(page);
    await expect(page.getByTestId('sidebar-toggle')).toBeHidden();                       // no way to collapse it on a desktop
    const wide = await page.locator('.sidebar').boundingBox();
    expect(wide!.width).toBeGreaterThan(200);
    await expect(page.getByTestId('nav-sales')).toBeVisible();

    await page.setViewportSize({ width: 600, height: 900 });                              // a phone: the menu is a drawer
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible();
    expect((await page.locator('.sidebar').boundingBox())!.x).toBeLessThan(0);
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('nav-sales')).toBeVisible();
    await expect.poll(async () => (await page.locator('.sidebar').boundingBox())!.x).toBeGreaterThanOrEqual(0);   // it slides in
  });
});
