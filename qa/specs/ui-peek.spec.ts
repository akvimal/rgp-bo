/**
 * The peek panel - PK-UI-1..3
 * A customer opens in a side panel from the list (the same way a bill does), the panel is kept in the address so Back closes it and a link reopens it,
 * and the full page and Edit are one click from it. (docs/planning/UI_PATTERNS.md)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
// a customer name takes letters, spaces and . ' - only (no digits), so the unique part is written in letters
const stamp = String(Date.now()).replace(/\d/g,(d) => 'abcdefghij'[+d]);
const mobile = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

test('PK-UI-1 View on the customer list opens a panel and the list stays', async ({ app, api }) => {
  const c = (await api.request('POST', '/customers', { name: `QA Peek ${stamp}`, mobile: mobile(), srctype: 'Walkin' }, MGR)).body;
  const { page } = await app.open(MGR, '/secure/customers/cust/list');
  await page.getByTestId('cust-search').fill(c.name);
  const row = page.locator('tbody tr', { hasText: c.name });
  await expect(row).toHaveCount(1);
  await row.getByTestId('cust-view').click();
  await expect(page.getByTestId('cpeek-title')).toContainText(c.name);
  await expect(page.getByTestId('cpeek-mobile')).toBeVisible();
  await expect(page.getByTestId('cpeek-months')).toBeVisible();
  // the list is still there behind it, with the search kept
  await expect(page.getByTestId('cust-search')).toHaveValue(c.name);
  await expect(page).toHaveURL(new RegExp(`peek=${c.id}`));
});

test('PK-UI-2 Back closes the panel and a link opens the list with it open', async ({ app, api }) => {
  const c = (await api.request('POST', '/customers', { name: `QA Peek Back ${stamp}`, mobile: mobile(), srctype: 'Walkin' }, MGR)).body;
  const { page } = await app.open(MGR, '/secure/customers/cust/list');
  await page.getByTestId('cust-search').fill(c.name);
  await page.locator('tbody tr', { hasText: c.name }).getByTestId('cust-name-link').click();
  await expect(page.getByTestId('cpeek-title')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('cpeek-title')).toHaveCount(0);
  await expect(page).toHaveURL(/cust\/list/);
  await page.goto(`/secure/customers/cust/list?peek=${c.id}`);
  await expect(page.getByTestId('cpeek-title')).toContainText(c.name);
});

test('PK-UI-3 Open full page and Edit go from the panel to the customer page', async ({ app, api }) => {
  const c = (await api.request('POST', '/customers', { name: `QA Peek Page ${stamp}`, mobile: mobile(), srctype: 'Walkin' }, MGR)).body;
  const { page } = await app.open(MGR, `/secure/customers/cust/list?peek=${c.id}`);
  await page.getByTestId('cpeek-full').click();
  await expect(page).toHaveURL(new RegExp(`cust/view/${c.id}`));
  await expect(page.getByTestId('cdv-name')).toContainText(c.name);
  await page.goto(`/secure/customers/cust/list?peek=${c.id}`);
  await page.getByTestId('cpeek-edit').click();
  await expect(page).toHaveURL(new RegExp(`cust/edit/${c.id}`));
});

test('PK-UI-4 a vendor opens in a panel with what is owed, and Edit goes to its page', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/purchases/vendors/list');
  const rows = page.getByTestId('vendor-row');
  test.skip((await rows.count()) === 0, 'no vendors in this data set');
  await rows.first().getByTestId('vendor-view').click();
  await expect(page.getByTestId('vpeek-money')).toBeVisible();
  await expect(page).toHaveURL(/peek=\d+/);
  await expect(rows.first()).toBeVisible();                                   // the list is still there
  await page.getByTestId('vpeek-full').click();
  await expect(page).toHaveURL(/vendors\/edit\/\d+/);
});

test('PK-UI-5 an invoice opens in a panel without reloading the list', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/purchases/invoices/list');
  const rows = page.getByTestId('inv-row');
  test.skip((await rows.count()) === 0, 'no invoices in this data set');
  const before = await rows.count();
  await rows.first().getByTestId('inv-view').click();
  await expect(page.getByTestId('ipeek-money')).toBeVisible();
  await expect(page.getByTestId('ipeek-items')).toBeVisible();
  await expect(rows).toHaveCount(before);                                     // opening a panel did not reload or re-page the list
  await page.goBack();
  await expect(page.getByTestId('ipeek-money')).toHaveCount(0);
});

test('PK-UI-6 a bill panel is kept in the address too', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/sales/list');
  const view = page.getByTestId('bill-view');
  test.skip((await view.count()) === 0, 'no bills today in this data set');
  await view.first().click();
  await expect(page.getByTestId('bill-details')).toBeVisible();
  await expect(page).toHaveURL(/peek=\d+/);
  await page.goBack();
  await expect(page.getByTestId('bill-details')).toHaveCount(0);
});
