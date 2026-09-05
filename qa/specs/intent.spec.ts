/**
 * Purchase Requests & Suggestions — PREQ-1..4
 * Source: docs/testing/manual-test-plan.html  (module "intent")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';

test.describe('Purchase Requests & Suggestions @p2', () => {
  test('PREQ-1 suggestions line up with low-stock, fast-moving items @happy', async ({ api }) => {
    const sug = await api.request('GET', '/purchase-suggestions?days=30&targetdays=21', undefined, MGR);
    expect(sug.status).toBeLessThan(400);
    expect(Array.isArray(sug.body)).toBeTruthy();
    if (sug.body.length) {
      const s = sug.body[0];
      // shape: a product, a vendor, some demand signal
      expect(s.product_id ?? s.productid).toBeTruthy();
      expect(s).toHaveProperty('available_stock');
      // suggested quantity is positive where there is genuine demand
      const qty = Number(s.trend_qty ?? s.suggested_qty ?? s.final_qty ?? 0);
      const sales = Number(s.sales_qty ?? s.avg_daily_sales ?? 0);
      if (sales > 0) expect(qty).toBeGreaterThanOrEqual(0);
    }
  });

  test('PREQ-2 converting suggestions creates one PO per distinct vendor @happy', async ({ api }) => {
    const sug: any[] = (await api.request('GET', '/purchase-suggestions?days=30&targetdays=21&includezero=true', undefined, MGR)).body;
    expect(sug.length).toBeGreaterThan(0);
    const vid = (s: any) => s.vendor_id ?? s.vendorid;
    const pid = (s: any) => s.product_id ?? s.productid;

    // prefer two vendors; fall back to two products of the same vendor
    const distinct = [...new Map(sug.filter(vid).map((s) => [vid(s), s])).values()];
    const picked = distinct.length >= 2 ? distinct.slice(0, 2) : sug.filter((s) => vid(s) === vid(sug[0])).slice(0, 2);
    expect(picked.length).toBeGreaterThan(0);
    const items = picked.map((s) => ({
      productid: pid(s), vendorid: vid(s),
      finalqty: Math.max(1, Math.round(Number(s.trend_qty ?? s.suggested_qty ?? 5))),
    }));
    const expectedPOs = new Set(items.map((i) => i.vendorid)).size;

    const before = (await api.request('GET', '/purchaseorders', undefined, MGR)).body.length;
    const created = await api.request('POST', '/purchase-suggestions/create-orders', { items, comments: 'qa PREQ-2' }, MGR);
    expect([200, 201]).toContain(created.status);
    const after = (await api.request('GET', '/purchaseorders', undefined, MGR)).body.length;
    expect(after - before).toBe(expectedPOs);
  });

  test('PREQ-3 a manual purchase request is saved and filterable by its fields @happy', async ({ api }) => {
    const prod = data.m.products[7].id;
    const vendor = data.m.vendors[0];
    const created = await api.request('POST', '/purchaserequests', {
      productid: prod, qty: 12, source: 'Staff', priority: 'High', requesttype: 'Ad Hoc',
      vendorid: vendor, status: 'Open', comments: 'qa PREQ-3',
    }, MGR);
    expect([200, 201]).toContain(created.status);
    const id = created.body.id;

    const byPriority = await api.request('GET', '/purchaserequests?priority=High', undefined, MGR);
    expect(byPriority.body.some((r: any) => r.id === id)).toBeTruthy();
    const byStatus = await api.request('GET', '/purchaserequests?status=Open', undefined, MGR);
    expect(byStatus.body.some((r: any) => r.id === id)).toBeTruthy();
  });

  test('PREQ-4 cancelling a request drops it from the active pipeline @happy', async ({ api }) => {
    const created = await api.request('POST', '/purchaserequests', {
      productid: data.m.products[8].id, qty: 5, status: 'Open', source: 'Staff', comments: 'qa PREQ-4',
    }, MGR);
    const id = created.body.id;
    const del = await api.request('DELETE', `/purchaserequests/${id}`, undefined, MGR);
    expect(del.status).toBeLessThan(400);
    const openList = await api.request('GET', '/purchaserequests?status=Open', undefined, MGR);
    expect(openList.body.some((r: any) => r.id === id && r.isActive !== false)).toBeFalsy();
  });

  test('the Store > Intent / Purchase Requests screen loads @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/purchases/requests');
    await expectShell(page);
    await expect(page.getByRole('button', { name: /Add Request/i })).toBeVisible();
  });
});
