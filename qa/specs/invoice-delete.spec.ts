/**
 * Deleting a draft purchase invoice — PDEL-1..2
 * An invoice created with no lines (or entered by mistake) can be deleted from the list or its own page.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

async function draft(api: any) {
  const vendor = (await api.request('GET', '/vendors?status=usable', undefined, MGR)).body[0];
  const made = await api.request('POST', '/purchases', { vendorid: vendor.id, invoiceno: `QA-DEL-${Date.now()}`, invoicedate: '2026-09-04' }, MGR);
  expect(made.status).toBeLessThan(300);
  return made.body;
}

test.describe('Delete a draft purchase invoice @p1', () => {
  test('PDEL-1 a draft with no lines is deleted, audited, and gone from the list; others cannot @happy', async ({ api }) => {
    const inv = await draft(api);
    expect((await api.request('DELETE', `/purchases/${inv.id}`, undefined, SALES)).status).toBe(403);       // needs the delete permission
    const del = await api.request('DELETE', `/purchases/${inv.id}`, undefined, MGR);
    expect(del.status).toBeLessThan(300);
    expect((await api.request('GET', `/purchases/${inv.id}`, undefined, MGR)).body?.id ?? null).toBeNull();
    expect((await api.request('DELETE', `/purchases/${inv.id}`, undefined, MGR)).status).toBe(404);
    expect((await api.request('DELETE', '/purchases/abc', undefined, MGR)).status).toBe(400);
  });

  test('PDEL-2 the list and the invoice page both offer Delete for a draft @happy', async ({ app, api }) => {
    const a = await draft(api);
    const { page } = await app.open(MGR, '/secure/purchases/invoices/list');
    await page.getByTestId('inv-chip-draft').click();
    const row = page.locator('tr', { hasText: a.invoiceno });
    await row.getByTestId('inv-delete').click();
    await page.getByTestId('inv-delete-confirm').click();
    await expect(page.locator('tr', { hasText: a.invoiceno })).toHaveCount(0);

    const b = await draft(api);
    await page.goto(`/secure/purchases/invoices/items/${b.id}`);
    await page.getByTestId('invoice-delete').click();
    await page.getByTestId('invoice-delete-yes').click();
    await expect(page).toHaveURL(/invoices\/list/);
    expect((await api.request('GET', `/purchases/${b.id}`, undefined, MGR)).body?.id ?? null).toBeNull();
  });
});
