/**
 * Invoice totals check - TOT-1..5
 * The balance of an invoice, and the most a payment may be, follow its stored total. A Business Head can list the invoices whose stored total is not what
 * their lines come to, preview, and correct them; each correction is audited. (purchase-invoice.service.ts: totalCheck, totalFix)
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

async function flagged(api: any) {
  const r = await api.request('GET', '/purchases/total-check', undefined, MGR);
  expect(r.status).toBe(200);
  return (r.body.rows as any[]).filter((x) => x.kind === 'TOTAL' && x.paid <= x.expected - 1);
}

test('TOT-1 only a Business Head may check or correct invoice totals', async ({ api }) => {
  const a = await api.request('GET', '/purchases/total-check', undefined, HEAD);
  expect(a.status).toBe(403);
  const b = await api.request('POST', '/purchases/total-fix', { ids: [1], confirm: true }, HEAD);
  expect(b.status).toBe(403);
});

test('TOT-2 a preview changes nothing', async ({ api }) => {
  const rows = await flagged(api);
  test.skip(!rows.length, 'no invoice with a stored total off from its lines in this data');
  const r = rows[0];
  const pre = await api.request('POST', '/purchases/total-fix', { ids: [r.id], confirm: false }, MGR);
  expect(pre.status).toBe(201);
  expect(pre.body.written).toBe(false);
  expect(pre.body.results[0].action).toBe('would correct');
  const again = (await api.request('GET', `/purchases/total-check?invoiceid=${r.id}`, undefined, MGR)).body.rows[0];
  expect(again.total).toBe(r.total);
});

test('TOT-3 a correction sets the total to what the lines come to, and the invoice then passes the check', async ({ api }) => {
  const rows = await flagged(api);
  test.skip(!rows.length, 'no invoice with a stored total off from its lines in this data');
  const r = rows[0];
  const fix = await api.request('POST', '/purchases/total-fix', { ids: [r.id], confirm: true }, MGR);
  expect(fix.status).toBe(201);
  expect(fix.body.results[0]).toMatchObject({ action: 'corrected', to: r.expected });
  const after = (await api.request('GET', `/purchases/total-check?invoiceid=${r.id}`, undefined, MGR)).body.rows;
  expect(after.filter((x: any) => x.kind === 'TOTAL')).toHaveLength(0);
});

test('TOT-4 the invoice list has a Check totals panel for the Business Head', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/purchases/invoices/list');
  await page.getByTestId('inv-totals-open').click();
  await expect(page.getByTestId('inv-totals-panel')).toBeVisible();
  await expect(page.getByTestId('inv-totals-table').or(page.getByTestId('inv-totals-clear'))).toBeVisible();
  await expect(page.getByTestId('inv-totals-error')).toHaveCount(0);
});

test('TOT-5 an invoice whose payable total is off shows the warning with a Correct button; the Store Head is not shown the tool', async ({ app, api }) => {
  const rows = await flagged(api);
  test.skip(!rows.length, 'no invoice with a stored total off from its lines in this data');
  const { page } = await app.open(MGR, `/secure/purchases/invoices/items/${rows[0].id}`);
  await expect(page.getByTestId('invoice-total-issue')).toBeVisible();
  await expect(page.getByTestId('invoice-total-fix')).toContainText('Correct it to');
  const head = await app.open(HEAD, '/secure/purchases/invoices/list');
  await expect(head.page.getByTestId('inv-totals-open')).toHaveCount(0);
});
