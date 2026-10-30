/**
 * How the business is registered decides the payroll set-up - HRM-1..3
 * Proprietorship and the other non-limited forms get the lite set; limited companies get the compliance set and record a decision on each statutory item.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const codes = (rows: any[]) => rows.map((r) => r.code);
const setForm = (api: any, legalform: string) => api.request('PUT', '/businesses/mine', { legalform }, MGR);

test.afterEach(async ({ api }) => { await setForm(api, 'PROPRIETORSHIP'); });

test('HRM-1 a proprietorship gets the lite set, with the statutory items only as suggestions', async ({ api }) => {
  expect((await setForm(api, 'PROPRIETORSHIP')).status).toBeLessThan(300);
  const r = (await api.request('GET', '/hr/starter', undefined, MGR)).body;
  expect(r).toMatchObject({ mode: 'LITE', legal_form: 'PROPRIETORSHIP', statutory: [], statutory_progress: null });
  expect(codes(r.starter)).toEqual(['BASIC', 'DA', 'OTHERS', 'FIXED_DED', 'CL', 'SL', 'EL', 'LWP']);
  expect(codes(r.suggestions)).toEqual(expect.arrayContaining(['PF', 'ESI', 'PT', 'TDS', 'HRA']));
  for (const f of ['PARTNERSHIP', 'LLP', 'OTHER']) {
    await setForm(api, f);
    expect((await api.request('GET', '/hr/starter', undefined, MGR)).body.mode).toBe('LITE');
  }
});

test('HRM-2 a limited company gets the compliance set and must decide each statutory item', async ({ api }) => {
  expect((await setForm(api, 'NOT_A_FORM')).status).toBe(400);
  expect((await setForm(api, 'PRIVATE_LIMITED')).status).toBeLessThan(300);
  const r = (await api.request('GET', '/hr/starter', undefined, MGR)).body;
  expect(r).toMatchObject({ mode: 'COMPLIANCE', legal_form: 'PRIVATE_LIMITED' });
  expect(codes(r.starter)).toEqual(expect.arrayContaining(['BASIC', 'DA', 'HRA', 'SPECIAL', 'PF', 'ESI', 'PT', 'TDS', 'ML']));
  expect(codes(r.suggestions)).not.toContain('PF');
  expect(codes(r.statutory)).toEqual(['PF', 'ESI', 'PT', 'TDS', 'GRATUITY', 'BONUS']);
  expect(r.statutory_progress.total).toBe(6);

  expect((await api.request('PUT', '/hr/statutory/PF', {}, MGR)).status).toBe(400);
  expect((await api.request('PUT', '/hr/statutory/PF', { applies: false }, MGR)).status).toBe(400);
  expect((await api.request('PUT', '/hr/statutory/NOPE', { applies: true }, MGR)).status).toBe(400);
  expect((await api.request('PUT', '/hr/statutory/ESI', { applies: false, reason: 'Fewer than 10 employees' }, MGR)).status).toBe(200);
  expect((await api.request('PUT', '/hr/statutory/TDS', { applies: true, reg_no: 'chna12345b' }, MGR)).status).toBe(200);
  const after = (await api.request('GET', '/hr/starter', undefined, MGR)).body;
  expect(after.statutory.find((s: any) => s.code === 'ESI')).toMatchObject({ applies: false, reason: 'Fewer than 10 employees' });
  expect(after.statutory.find((s: any) => s.code === 'TDS')).toMatchObject({ applies: true, reg_no: 'CHNA12345B' });
  expect(after.statutory_progress.decided).toBeGreaterThanOrEqual(2);
});

test('HRM-3 the Setup screen shows the registration choice, the mode, and the statutory block only for a limited company', async ({ app, api }) => {
  await setForm(api, 'PROPRIETORSHIP');
  const { page } = await app.open(MGR, '/secure/settings/business-profile/setup');
  await expect(page.getByTestId('hr-legal-form-select')).toBeVisible();
  await expect(page.getByTestId('hr-mode')).toContainText('Lite');
  await expect(page.getByTestId('hr-statutory')).toHaveCount(0);
  await page.getByTestId('hr-legal-form-select').selectOption('PRIVATE_LIMITED');
  await expect(page.getByTestId('hr-mode')).toContainText('Compliance');
  await expect(page.getByTestId('hr-statutory')).toBeVisible();
  await page.getByTestId('hr-stat-applies-GRATUITY').selectOption({ label: 'Does not apply' });
  await page.getByTestId('hr-stat-reason-GRATUITY').fill('Fewer than 10 employees');
  await page.getByTestId('hr-stat-save-GRATUITY').click();
  await expect(page.getByTestId('hr-setup-message')).toContainText('saved');
});
