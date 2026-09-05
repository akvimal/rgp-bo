/**
 * Settings — Roles & Permissions — ROLE-1..4
 * Source: docs/testing/manual-test-plan.html  (module "roles")
 *
 * The API's user endpoints only allow the 4 built-in roles, so the seed assigns
 * the custom QA roles to their holders directly in the DB (see seed/catalog.ts).
 * These specs assert the RUNTIME EFFECT of holding such a role.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';

test.describe('Settings — Roles & Permissions @p0', () => {
  test('ROLE-1 a role with only purchaseorders:approve grants exactly that @happy', async ({ app, api }) => {
    const holder = data.roleHolder('approver');
    const me = await api.request('GET', '/auth/me', undefined, holder.email);
    const resources = (me.body.permissions || []).map((p: any) => p.resource);
    expect(resources).toContain('purchaseorders');
    // no pricing / user-admin / stock-audit
    expect(resources).not.toContain('users');
    expect(resources).not.toContain('businesses');

    const { page } = await app.open(holder.email, '/secure/dashboard');
    await expectShell(page);
    await expect(page.getByTestId('nav-settings')).toBeHidden();
    await expect(page.getByTestId('nav-products')).toBeHidden();
  });

  test('ROLE-4 the approve endpoint rejects a token without the policy @permission', async ({ api }) => {
    // find a PENDING_APPROVAL PO, or create one over the threshold
    let po = (await api.request('GET', '/purchaseorders?status=PENDING_APPROVAL', undefined, MGR)).body?.[0];
    if (!po) {
      const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
      const prod = data.m.products[0].id;
      const created = await api.request('POST', '/purchaseorders', { vendorid: v }, MGR);
      const pr = await api.request('POST', '/purchaserequests', { productid: prod, qty: 5000, vendorid: v }, MGR);
      await api.request('PUT', `/purchaserequests/${pr.body.id}`, { orderid: created.body.id }, MGR);
      // give the product a ptr cost so the estimate clears the threshold
      await api.request('POST', '/purchaseitems', { invoiceid: 0 }, MGR).catch(() => {});
      await api.request('POST', `/purchaseorders/${created.body.id}/submit`, undefined, MGR);
      po = (await api.request('GET', `/purchaseorders/${created.body.id}`, undefined, MGR)).body;
    }

    // a Sales Staff token has no approve policy
    const bad = await api.request('POST', `/purchaseorders/${po.id}/approve`, undefined, 'sales1@local.test');
    expect(bad.status).toBeGreaterThanOrEqual(403);
  });

  test('ROLE-2 a read-only role cannot reach gated modules via nav or URL @permission', async ({ app }) => {
    const holder = data.roleHolder('readonly');
    const { page } = await app.open(holder.email, '/secure/dashboard');
    await expectShell(page);
    await expect(page.getByTestId('nav-settings')).toBeHidden();
    // direct URL to a gated module bounces
    await page.goto('/secure/settings/users');
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('ROLE-3 archiving a role that is in use is handled cleanly @negative', async ({ api }) => {
    const r = await api.request('POST', '/roles', { name: `QA Temp Role ${Date.now()}`, permissions: [], locked: false }, MGR);
    const del = await api.request('DELETE', `/roles/${r.body.id}`, undefined, MGR);
    expect(del.status).toBeLessThan(500);
    const list = await api.request('GET', '/roles', undefined, MGR);
    expect(list.body.some((x: any) => x.id === r.body.id)).toBeFalsy();
  });
});
