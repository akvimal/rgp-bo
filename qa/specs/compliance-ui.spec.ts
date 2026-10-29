/**
 * Compliance and role views on screen - CR-UI-1..3
 * The Business Head opens the register and sees an ended licence on the ladder; a salesperson opens their own dashboard view; the grouped menu is a
 * per-business choice and shows Compliance under Oversight when it is on.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const day = (offset: number) => new Date(Date.now() + 5.5 * 3600000 + offset * 86400000).toISOString().slice(0, 10);

test('CR-UI-1 the register shows an ended licence, escalated, with the waiver actions for the Business Head', async ({ api, app }) => {
  const s = await api.request('POST', '/stores', { location: `CRU ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
  await api.request('PUT', `/stores/${s.body.id}/licenses`, { licenses: [{ licensetype: 'RETAIL_20_21', number: 'CRU-1', validfrom: day(-400), validto: day(-6) }] }, MGR);
  await api.request('POST', '/compliance/sync', {}, MGR);
  const { page } = await app.open(MGR, '/secure/compliance');
  const table = page.getByTestId('cr-table');
  await expect(table).toBeVisible();
  const row = table.locator('tr', { hasText: s.body.location.trim() }).first();
  await expect(row).toContainText('Licence renewal');
  await expect(row).toContainText('Escalated');
  await expect(row.getByRole('button', { name: 'Waive', exact: true })).toBeVisible();
});

test('CR-UI-2 a salesperson opens their own view of the dashboard', async ({ app }) => {
  const { page } = await app.open('sales1@local.test', '/secure/dashboard');
  await expect(page.getByTestId('sv-day')).toBeVisible();
  await expect(page.getByTestId('sv-goals')).toBeVisible();
  await expect(page.getByTestId('needs-strip')).toBeVisible();
  await expect(page.getByText('Purchase month')).toHaveCount(0);
});

test('CR-UI-3 the Business Head keeps the long-standing cards and the standard header and strip', async ({ app }) => {
  const { page } = await app.open(MGR, '/secure/dashboard');
  await expect(page.getByTestId('dash-scope')).toBeVisible();
  await expect(page.getByTestId('needs-strip')).toBeVisible();
  await expect(page.getByTestId('dash-kpis')).toBeVisible();
});
