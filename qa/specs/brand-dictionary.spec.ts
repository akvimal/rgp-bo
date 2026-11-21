/**
 * Brand dictionary at the counter: type an unfamiliar brand in the Check brand box in the Sales header, pick it, see its generic composition,
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

  test('BD-1 typing a brand in the Sales header box shows its composition in the Check brand dialog', async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, COUNTER, '/secure/sales/pos/new', { storeId: 1 });
    // the old button beside the bill's product search is gone: the box sits in the Sales header, before Pay later bills
    await expect(page.getByTestId('brand-check')).toHaveCount(0);
    const box = page.getByTestId('brand-check-input');
    await box.click();
    await box.pressSequentially('telma 40', { delay: 40 });
    const pick = page.getByTestId('brand-check-pick').first();
    await expect(pick).toContainText('Telma 40 mg oral tablet');
    await expect(pick).toContainText('Telmisartan 40 mg');            // the generic, shown before any extra click
    await pick.click();
    // the dialog opens on that brand: no brand input and no own-list picker
    await expect(page.getByRole('dialog')).toContainText('Check brand / find alternatives');
    await expect(page.getByTestId('alt-from-dict')).toBeVisible();
    await expect(page.getByTestId('alt-composition')).toContainText('Telmisartan');
    await expect(page.getByTestId('alt-brand')).toHaveCount(0);
    await expect(page.getByRole('dialog').locator('app-product-select')).toHaveCount(0);
    await expect(page.getByTestId('alt-source')).toContainText('Common Drug Codes for India');
    await expect(page.getByTestId('alt-source')).toContainText('CC BY 4.0');
    await ctx.close();
  });

  test('BD-5 the check is kept: picking a brand, or leaving a brand nothing matched, is counted in the weekly review @happy', async ({ browser }) => {
    const monday = (() => { const d = new Date(Date.now() + 5.5 * 3600000); const dow = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10); })();
    const lookups = async () => (await api('GET', `/review/week?weekstart=${monday}`)).body?.more?.lookups;
    const before = await lookups();
    test.skip(!before, 'this database has no brand check log (migration 177)');
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, COUNTER, '/secure/sales/pos/new', { storeId: 1 });
    const box = page.getByTestId('brand-check-input');
    await box.click();
    await box.pressSequentially('telma 40', { delay: 30 });
    await page.getByTestId('brand-check-pick').first().click();
    await expect(page.getByTestId('alt-from-dict')).toBeVisible();
    // the pick was kept (the log is sent right after the answer shows)
    await expect.poll(async () => (await lookups()).total).toBe(before.total + 1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // a brand that nothing matches, then the box is left without choosing anything
    await box.click();
    await box.pressSequentially('qzxvbnmq', { delay: 30 });
    await expect(page.getByTestId('brand-check-none')).toBeVisible();
    await page.getByTestId('pay-later-link').focus();
    await expect.poll(async () => (await lookups()).total).toBe(before.total + 2);
    const after = await lookups();
    expect(after.noMatch).toBeGreaterThanOrEqual(before.noMatch + 1);                       // the typed brand is a miss
    expect(after.top.some((t: any) => /qzxvbnmq/i.test(t.name))).toBe(true);
    await ctx.close();
  });

  test('BD-2 a short or unknown name says so', async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, COUNTER, '/secure/sales/pos/new', { storeId: 1 });
    const box = page.getByTestId('brand-check-input');
    await box.click();
    await box.pressSequentially('zz', { delay: 30 });
    await expect(page.getByTestId('brand-check-short')).toContainText('Type at least three letters.');
    await box.pressSequentially('qxnotabrand', { delay: 30 });
    await expect(page.getByTestId('brand-check-none')).toBeVisible();
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
    const box = page.getByTestId('brand-check-input');
    await box.click();
    await box.pressSequentially('augmentin duo 500', { delay: 30 });
    await page.getByTestId('brand-check-pick').filter({ hasText: 'Augmentin DUO 500 mg + 125 mg oral tablet' }).first().click();
    const row = page.locator('[data-testid=alt-same][data-product="969"]');
    await expect(row).toBeVisible();
    await row.getByTestId('alt-add').click();                          // a bill is open on this page, so Add to bill is offered
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('sale-line')).toContainText('Pantoprazole 10ml Capsule');
    await ctx.close();
  });

  test('BD-6 on a page with no open bill the dialog shows the result but offers no Add to bill', async ({ browser }) => {
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, COUNTER, '/secure/sales/pos/pay-later', { storeId: 1 });
    const box = page.getByTestId('brand-check-input');
    await box.click();
    await box.pressSequentially('telma 40', { delay: 30 });
    await page.getByTestId('brand-check-pick').first().click();
    await expect(page.getByTestId('alt-from-dict')).toBeVisible();
    await expect(page.getByTestId('alt-add')).toHaveCount(0);
    await ctx.close();
  });

  test('BD-4 the product form has a dosage form, and the product list can fill them from names', async ({ browser }) => {
    // any product in stock: give it a dosage form, then see the form on its edit page
    const stock = (await api('POST', '/stock/filter', { available: true, limit: 20, storeid: 1 })).body.find((x: any) => Number(x.balance) > 0);
    expect(stock).toBeTruthy();
    expect((await api('PUT', `/products/${stock.id}`, { dosageform: 'tablet' })).status).toBe(200);
    const ctx = await browser.newContext();
    const { page } = await openAs(ctx, MGR, `/secure/products/master/edit/${stock.id}`);
    await expect(page.getByTestId('prod-dosageform')).toHaveValue('tablet');
    await page.getByTestId('prod-dosageform').selectOption('capsule');
    await expect(page.getByTestId('prod-dosageform')).toHaveValue('capsule');
    await page.goto('/secure/products/master/list');
    await expect(page.getByTestId('prod-add')).toBeVisible();                 // the page is ready
    await page.getByTestId('prod-forms-open').click();
    await expect(page.getByTestId('prod-forms-panel')).toBeVisible();
    await expect(page.getByTestId('prod-forms-preview')).toContainText('have no dosage form', { timeout: 20000 });
    await page.getByTestId('prod-forms-close').click();
    await expect(page.getByTestId('prod-forms-panel')).toHaveCount(0);
    await ctx.close();
  });
});
