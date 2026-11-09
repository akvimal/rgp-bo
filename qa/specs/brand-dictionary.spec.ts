/**
 * Brand dictionary at the counter: type an unfamiliar brand in the POS search, press "Check brand", see its generic composition,
 * and the matching stock. Needs a database with the CDCI brand list imported (npm run import:drugref in api-v2) and migration 176.
 * Uses real typing and clicks (no page scripting).
 */
import { test, expect } from '@playwright/test';
import { openAs, apiLogin } from '../fixtures/auth.js';

const COUNTER = process.env.QA_COUNTER_EMAIL || 'sales2@local.test';
const MGR = process.env.QA_MGR_EMAIL || 'businesshead@local.test';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function api(method: string, path: string, body?: any, who = MGR) {
  const { token } = await apiLogin(who);
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}

test.describe('Brand dictionary in the POS', () => {
  test.beforeAll(async () => {
    const s = await api('GET', '/sale-alternatives/brands?q=', undefined, COUNTER);
    test.skip(!s.body?.available, 'no brand list is loaded in this database');
  });

  test('BD-1 typing a brand and pressing Check brand shows its generic composition', async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, COUNTER, '/secure/sales/pos/new', { storeId: 1 });
    const search = page.locator('app-stock-select input');
    await search.click();
    await search.pressSequentially('telma 40', { delay: 40 });
    await page.getByTestId('brand-check').click();
    // the dialog opens with what was typed, focused, and already searching
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByTestId('alt-brand')).toHaveValue('telma 40');
    await expect(page.getByTestId('alt-brand')).toBeFocused();
    const pick = page.getByTestId('alt-brand-pick').first();
    await expect(pick).toContainText('Telma 40 mg oral tablet');
    await expect(pick).toContainText('Telmisartan 40 mg');            // the generic, shown before any extra click
    await pick.click();
    await expect(page.getByTestId('alt-from-dict')).toBeVisible();
    await expect(page.getByTestId('alt-brand-none')).toHaveCount(0);
    await expect(page.getByTestId('alt-source')).toContainText('Common Drug Codes for India');
    await expect(page.getByTestId('alt-source')).toContainText('CC BY 4.0');
    await ctx.close();
  });

  test('BD-2 a short or unknown name says so, and the box can be typed in again', async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, COUNTER, '/secure/sales/pos/new', { storeId: 1 });
    await page.getByTestId('brand-check').click();                    // nothing typed in the search
    const box = page.getByTestId('alt-brand');
    await box.pressSequentially('zz', { delay: 30 });
    await expect(page.getByText('Type at least three letters.')).toBeVisible();
    await box.pressSequentially('qxnotabrand', { delay: 30 });
    await expect(page.getByTestId('alt-brand-none')).toBeVisible();
    await ctx.close();
  });

  test('BD-3 stock with the same composition and form is offered and goes onto the bill', async ({ browser }) => {
    // needs a shop product (id 969 in the dev scratch database) whose composition is amoxicillin 500 + clavulanic acid 125
    const p = await api('GET', '/products/969');
    test.skip(!/Pantoprazole 10ml Capsule/.test(String(p.body?.title || '')), 'the stocked amoxicillin + clavulanic acid test product (id 969) is not in this database');
    const upd = await api('PUT', '/products/969', { dosageform: 'tablet' });
    expect(upd.status).toBe(200);
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, COUNTER, '/secure/sales/pos/new', { storeId: 1 });
    const search = page.locator('app-stock-select input');
    await search.click();
    await search.pressSequentially('augmentin duo 500', { delay: 30 });
    await page.getByTestId('brand-check').click();
    await page.getByTestId('alt-brand-pick').filter({ hasText: 'Augmentin DUO 500 mg + 125 mg oral tablet' }).first().click();
    const row = page.locator('[data-testid=alt-same][data-product="969"]');
    await expect(row).toBeVisible();
    await row.getByTestId('alt-add').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('sale-line')).toContainText('Pantoprazole 10ml Capsule');
    await ctx.close();
  });

  test('BD-4 the product form has a dosage form, and the product list can fill them from names', async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, MGR, '/secure/products/master/edit/969');
    await expect(page.getByTestId('prod-dosageform')).toHaveValue('tablet');
    await page.getByTestId('prod-dosageform').selectOption('capsule');
    await expect(page.getByTestId('prod-dosageform')).toHaveValue('capsule');
    await page.goto('/secure/products/master/list');
    await page.getByTestId('prod-forms-open').click();
    await expect(page.getByTestId('prod-forms-panel')).toBeVisible();
    await expect(page.getByTestId('prod-forms-preview')).toContainText('have no dosage form');
    await page.getByTestId('prod-forms-close').click();
    await expect(page.getByTestId('prod-forms-panel')).toHaveCount(0);
    await ctx.close();
  });
});
