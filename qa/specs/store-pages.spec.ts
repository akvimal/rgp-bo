/**
 * Store pages — STORE-1..3
 * A product row on Store > Stock > Products opens its purchases, sales and customers; dates must arrive as dates (the cost
 * redaction once turned every date into an empty object, which broke the panel).
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const ISO = /^\d{4}-\d{2}-\d{2}/;

test.describe('Store pages @p1', () => {
  test('STORE-1 a product row opens its purchases, sales and customers, with dates @happy', async ({ app, api }) => {
    const list = (await api.request('POST', '/stock2', { criteria: { active: true, available: false, expired: false, starts: true } }, MGR)).body;
    const withSales = list.find((p: any) => p.last_sale_date) || list[0];
    const detail = (await api.request('GET', `/stock2/${withSales.id}`, undefined, MGR)).body;
    expect(typeof detail.purchases[0].invoice_date).toBe('string');                                  // not an empty object
    expect(detail.purchases[0].invoice_date).toMatch(ISO);
    expect(typeof detail.purchases[0].exp_date === 'string' || detail.purchases[0].exp_date === null).toBe(true);
    if (detail.sales.length) expect(detail.sales[0].sale_month).toMatch(ISO);
    if (detail.customers.length) expect(detail.customers[0].recent).toMatch(ISO);
    expect(JSON.stringify(detail)).not.toContain('"mrp_cost"');                                      // cost fields are never in this view

    const { page } = await app.open(MGR, '/secure/store/stock/products');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.locator('tr.row-hover', { hasText: withSales.title }).first().click().catch(async () => { await page.locator('tr.row-hover').first().click(); });
    await expect(page).toHaveURL(/products\/items\/\d+/);
    await expect(page.getByRole('tab', { name: 'Purchase' })).toBeVisible();
    await expect(page.locator('p-tabpanel table tbody tr').first()).toBeVisible();                      // the purchase rows render
    await expect(page.locator('p-tabpanel table tbody td').first()).toHaveText(/\d{2} [A-Z][a-z]{2} \d{4}/);   // a date, like 17 Oct 2026

    await page.getByRole('tab', { name: 'Sale' }).click();
    await expect(page.locator('p-tabpanel:visible table')).toBeVisible();
    await page.getByRole('tab', { name: 'Customer' }).click();
    await expect(page.locator('p-tabpanel:visible table')).toBeVisible();
    expect(errors.filter((e) => /InvalidPipeArgument|date/i.test(e)), errors.join(' | ')).toEqual([]);
  });

  test('STORE-2 a person without cost access still gets dates, and no cost fields, in the stock list @edge', async ({ api }) => {
    const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 20 }, COUNTER)).body;
    expect(rows.length).toBeGreaterThan(0);
    const withExpiry = rows.find((r: any) => r.exp_date !== null && r.exp_date !== undefined);
    if (withExpiry) expect(typeof withExpiry.exp_date).toBe('string');                                 // an empty object here broke the expiry in the POS list
    for (const r of rows) for (const k of ['mrp_cost', 'ptr_cost', 'ptr_value', 'oldprice', 'cost']) expect(r).not.toHaveProperty(k);
  });

  test('STORE-3 Transfers opens for a manager (its route was missing from the role paths) and the Cash ledger is paged @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/store/transfers');
    await expect(page).toHaveURL(/store\/transfers/);
    await expect(page.getByRole('heading', { name: 'Stock Transfers' })).toBeVisible();
    await page.goto('/secure/store/cash');
    await expect(page.locator('p-paginator').first()).toBeVisible();
  });
});
