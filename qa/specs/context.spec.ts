/**
 * Store Context & Multi-Store Switching — CTX-1..5
 * Source: docs/testing/manual-test-plan.html  (module "context")
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

async function makeCashier(api: any, storeIds: number[]) {
  const email = `qa.ctx.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
  await api.request('POST', '/users', {
    fullname: 'CTX Cashier', email, password: PASS, phone: '9000009999',
    location: 'x', roleid: 2, storeids: storeIds,
  }, MGR);
  return email;
}

test.describe('Store Context & Multi-Store Switching @p0', () => {
  test('CTX-1 a single-store user gets that store and no real choice @happy', async ({ app, api }) => {
    const store = data.storesOf(1)[0].id;
    const email = await makeCashier(api, [store]);
    const { page } = await app.open(email);
    await expectShell(page);
    const opts = page.getByTestId('store-switcher').locator('option');
    await expect(opts.first()).toBeAttached();
    expect(await opts.count()).toBeLessThanOrEqual(2); // "All stores" + the one store
  });

  test('CTX-2 a multi-store user sees every assigned store, primary pre-selected @happy', async ({ app, api }) => {
    const biz1Stores = data.storesOf(1).map((s) => s.id).slice(0, 2);
    expect(biz1Stores.length).toBe(2);
    const email = await makeCashier(api, biz1Stores);

    const ctx = await api.request('GET', '/stores/context', undefined, email);
    const ctxStoreIds = ctx.body.stores.map((s: any) => s.id);
    for (const sid of biz1Stores) expect(ctxStoreIds).toContain(sid);
    expect(ctx.body.selectedstoreid).toBe(biz1Stores[0]); // primary = first assigned

    const { page } = await app.open(email);
    await expectShell(page);
    const values = await page.getByTestId('store-switcher').locator('option').evaluateAll(
      (os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    for (const sid of biz1Stores) expect(values).toContain(String(sid));
  });

  test('CTX-3 a Business Head can select every store in its business @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/store/cash');
    await expectShell(page);
    const values = await page.getByTestId('store-switcher').locator('option').evaluateAll(
      (os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
    for (const s of data.storesOf(1)) expect(values).toContain(String(s.id));
  });

  test('CTX-4 archiving the store in view drops it from the switcher without crashing @edge', async ({ app, api }) => {
    const s = await api.request('POST', '/stores', { location: `CTX4 ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
    const sid = s.body.id;
    const { page } = await app.open(MGR, '/secure/store/cash', { storeId: sid });
    await expectShell(page);
    await api.request('PUT', `/stores/${sid}`, { isArchived: true, isActive: false }, MGR);
    await page.reload();
    await expectShell(page);
    const values = await page.getByTestId('store-switcher').locator('option').evaluateAll(
      (os) => os.map((o) => (o as HTMLOptionElement).value),
    );
    expect(values).not.toContain(String(sid));
  });

  test('CTX-5 the selected store persists from Cash to Stock @integration', async ({ app }) => {
    const target = data.storesOf(1).find((s) => s.id !== 1)!.id;
    const { page } = await app.open(MGR, '/secure/store/cash', { storeId: 1 });
    await expectShell(page);
    await page.getByTestId('store-switcher').selectOption(String(target));
    await page.waitForTimeout(400);
    await page.getByTestId('nav-store').click();
    await page.waitForURL(/\/secure\/store/);
    const stored = await page.evaluate(() => localStorage.getItem('selected_store_id'));
    expect(stored).toBe(String(target));
  });
});
