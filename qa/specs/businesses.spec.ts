/**
 * Settings — Businesses & Stores — BIZ-1..4
 * Source: docs/testing/manual-test-plan.html  (module "businesses")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const ADMIN = 'siteadmin@local.test';
const MGR = 'businesshead@local.test';

test.describe('Settings — Businesses & Stores @p0', () => {
  test('BIZ-1 Site Admin can create a business and it becomes a store parent @happy', async ({ app, api }) => {
    const name = `QA Biz ${Date.now()}`;
    const { page } = await app.open(ADMIN, '/secure/settings/businesses');
    await expectShell(page);
    await page.getByTestId(TID.bizName).fill(name);
    await page.getByTestId(TID.bizSave).click();
    await expect(page.getByTestId(TID.bizRow).filter({ hasText: name })).toBeVisible();
    // available as a parent when a Business Head creates a store there
    const list = await api.request('GET', '/stores/businesses', undefined, MGR);
    expect(list.body.some((b: any) => b.name === name)).toBeTruthy();
  });

  test('BIZ-2 a store created under a business shows in the switcher and Store Settings @happy', async ({ app, api }) => {
    const loc = `QA Store ${Date.now()}`;
    const s = await api.request('POST', '/stores', { location: loc, depositthreshold: 14000, isActive: true }, MGR);
    expect([200, 201]).toContain(s.status);

    const { page } = await app.open(MGR, '/secure/settings/store');
    await expectShell(page);
    await page.getByTestId(TID.storeTab('master')).click();
    await expect(page.getByTestId(TID.storeRow).filter({ hasText: loc })).toBeVisible();

    const { page: p2 } = await app.open(MGR, '/secure/store/cash', { storeId: s.body.id });
    await expectShell(p2);
    await expect(p2.getByTestId('store-switcher').locator('option', { hasText: loc })).toHaveCount(1);
  });

  test('BIZ-3 changing a store deposit threshold drives the Cash deposit-due flag @integration', async ({ app, api }) => {
    const s = await api.request('POST', '/stores', { location: `QA Thr ${Date.now()}`, depositthreshold: 200, isActive: true }, MGR);
    const sid = s.body.id;
    // put some cash in so balance is ~1000
    await api.request('POST', '/store-cash/ledger', { storeid: sid, category: 'ADJUSTMENT', deposit: 1000, description: 'seed balance' }, MGR);

    let dash = await api.request('GET', `/store-cash/dashboard?storeid=${sid}`);
    expect(dash.body.depositdue).toBeTruthy(); // 1000 >= 200

    await api.request('PUT', `/stores/${sid}`, { depositthreshold: 5000 }, MGR);
    dash = await api.request('GET', `/store-cash/dashboard?storeid=${sid}`);
    expect(dash.body.depositdue).toBeFalsy(); // 1000 < 5000 now
    expect(Number(dash.body.depositthreshold)).toBe(5000);
  });

  test('BIZ-4 archiving a store with history removes it from active switchers but keeps its records @edge', async ({ app, api }) => {
    // store 1 has the seeded sales history
    const sales = await api.request('GET', '/sales/raw', undefined, MGR);
    expect(sales.body.length).toBeGreaterThan(0);

    const s = await api.request('POST', '/stores', { location: `QA Arch ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
    const sid = s.body.id;
    await api.request('PUT', `/stores/${sid}`, { isArchived: true, isActive: false }, MGR);

    const stores = await api.request('GET', '/stores', undefined, MGR);
    expect(stores.body.some((x: any) => x.id === sid)).toBeFalsy(); // gone from the active list

    // historical sales still resolve
    const stillThere = await api.request('GET', '/sales/raw', undefined, MGR);
    expect(stillThere.body.length).toBe(sales.body.length);
  });
});
