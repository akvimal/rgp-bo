/**
 * Edit KPI measure - KPI-ED-1..2
 * The description is a multi-row box (two rows at least, 500 characters), and a measure can be switched into or out of a gate when it is edited.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const stamp = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[+d]);

async function openEdit(app: any, name: string) {
  const { page } = await app.open(MGR, '/secure/hr/setup');
  await page.getByTestId('hr-set-tab-kpi').click();
  await page.getByTestId('hr-set-metric-row').filter({ hasText: name }).getByTestId('hr-set-metric-edit').click();
  await expect(page.getByTestId('hr-set-metric-form')).toBeVisible();
  return page;
}

test('KPI-ED-1 the description is a box of two rows at least that takes a long text', async ({ app, api }) => {
  const name = `QA Desc ${stamp}`;
  const long = 'A long description of what good looks like. '.repeat(9).trim();      // about 400 characters
  const made = await api.request('POST', '/hr/kpi/metrics', { name, max_points: 10, description: 'short' }, MGR);
  expect(made.status).toBe(201);
  const page = await openEdit(app, name);
  const box = page.getByTestId('hr-set-metric-desc');
  expect(await box.evaluate((el: HTMLElement) => el.tagName)).toBe('TEXTAREA');
  expect(await box.evaluate((el: HTMLTextAreaElement) => el.rows)).toBeGreaterThanOrEqual(2);
  await box.fill(long);
  expect(await box.evaluate((el: HTMLTextAreaElement) => el.rows)).toBeGreaterThan(2);          // it grows with the text
  await page.getByTestId('hr-set-metric-save').click();
  await expect.poll(async () => ((await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body.find((m: any) => m.id === made.body.id) || {}).description?.length).toBe(long.length);
  await api.request('DELETE', `/hr/kpi/metrics/${made.body.id}`, undefined, MGR);
});

test('KPI-ED-2 a manual gate can be switched to a scored measure when editing, and back', async ({ app, api }) => {
  const name = `QA Gate Switch ${stamp}`;
  const made = await api.request('POST', '/hr/kpi/metrics', { name, is_gate: true, source: 'MANUAL' }, MGR);
  expect(made.status).toBe(201);
  const get = async () => (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body.find((m: any) => m.id === made.body.id);
  expect(await get()).toMatchObject({ is_gate: true, max_points: 0 });

  let page = await openEdit(app, name);
  const gate = page.getByTestId('hr-set-metric-gate');
  await expect(gate).toBeEnabled();                                         // it was locked when editing
  await expect(gate).toBeChecked();
  await gate.uncheck();
  await expect(page.getByTestId('hr-set-metric-max')).toBeVisible();        // a scored measure has points
  await page.getByTestId('hr-set-metric-save').click();
  await expect.poll(async () => (await get())?.is_gate).toBe(false);
  expect((await get()).max_points).toBeGreaterThan(0);
  expect((await get()).rating_scale).toBeGreaterThan(2);

  page = await openEdit(app, name);
  await page.getByTestId('hr-set-metric-gate').check();
  await page.getByTestId('hr-set-metric-save').click();
  await expect.poll(async () => (await get())?.is_gate).toBe(true);
  expect(await get()).toMatchObject({ max_points: 0, rating_scale: 2 });
  await api.request('DELETE', `/hr/kpi/metrics/${made.body.id}`, undefined, MGR);
});
