/**
 * HR and payroll step of the Setup screen - HRS-1..4
 * A starter pay structure by code (never overwrites), suggestions the owner ticks, the year's holidays the owner defines, and staff records for logins with none.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';

const codes = (rows: any[]) => rows.map((r) => r.code);

test('HRS-1 the offer shows the starter set and suggestions, marks what exists, and is for the Business Head only', async ({ api }) => {
  const r = await api.request('GET', '/hr/starter', undefined, MGR);
  expect(r.status).toBe(200);
  expect(codes(r.body.starter)).toEqual(expect.arrayContaining(['BASIC', 'HRA', 'OTHERS', 'FIXED_DED', 'CL', 'SL', 'EL', 'LWP']));
  expect(codes(r.body.suggestions)).toEqual(expect.arrayContaining(['PF', 'ESI', 'PT', 'TDS']));
  expect(r.body.starter.find((i: any) => i.code === 'BASIC').have).toBe(true);
  expect(r.body.progress).toEqual(expect.objectContaining({ components: expect.any(Number), leave_types: expect.any(Number), holidays: expect.any(Number) }));
  expect((await api.request('GET', '/hr/starter', undefined, HEAD)).status).toBe(403);
  expect((await api.request('POST', '/hr/starter', { starter: true }, HEAD)).status).toBe(403);
});

test('HRS-2 adding the starter set adds only what is missing, a suggestion only when asked for, and a second press adds nothing', async ({ api }) => {
  const clean = async () => {
    const comps = (await api.request('GET', '/hr/components', undefined, MGR)).body;
    for (const c of comps.filter((x: any) => x.code === 'PF')) await api.request('DELETE', `/hr/components/${c.id}`, undefined, MGR);
  };
  await clean();
  try {
    const a = await api.request('POST', '/hr/starter', { starter: true, codes: ['PF', 'NOPE'] }, MGR);
    expect(a.status).toBe(201);
    expect(a.body.added).toContain('PF');
    expect(a.body.added).not.toContain('NOPE');
    expect(a.body.added).not.toContain('BASIC');
    const comps = (await api.request('GET', '/hr/components', undefined, MGR)).body;
    expect(comps.find((c: any) => c.code === 'PF')).toMatchObject({ kind: 'DEDUCTION' });
    const again = await api.request('POST', '/hr/starter', { starter: true, codes: ['PF'] }, MGR);
    expect(again.body.added).toEqual([]);
  } finally {
    await clean();
  }
});

test('HRS-3 the Setup screen shows the step, adds a ticked suggestion and a holiday the owner defines, and lists the people with no record', async ({ app, api }) => {
  const year = new Date().getFullYear();
  const day = `${year}-12-30`;
  const cleanup = async () => {
    await api.request('DELETE', `/hr/holidays/${day}`, undefined, MGR);
    const comps = (await api.request('GET', '/hr/components', undefined, MGR)).body;
    for (const c of comps.filter((x: any) => x.code === 'ESI')) await api.request('DELETE', `/hr/components/${c.id}`, undefined, MGR);
  };
  await cleanup();
  try {
    const { page } = await app.open(MGR, '/secure/settings/business-profile/setup');
    await expect(page.getByTestId('hr-setup')).toBeVisible();
    await expect(page.getByTestId('hr-setup-checklist')).toContainText('Pay components');
    await page.getByTestId('hr-suggest-ESI').check();
    await page.getByTestId('hr-add-suggested').click();
    await expect(page.getByTestId('hr-setup-message')).toContainText('ESI');
    await expect(page.getByTestId('hr-suggest-ESI')).toBeDisabled();
    await page.getByTestId('hr-holiday-date').fill(day);
    await page.getByTestId('hr-holiday-name').fill('Year end');
    await page.getByTestId('hr-holiday-add').click();
    await expect(page.getByTestId('hr-holiday-row').filter({ hasText: 'Year end' })).toBeVisible();
    await expect(page.getByTestId('hr-people-none').or(page.getByTestId('hr-person').first())).toBeVisible();
  } finally {
    await cleanup();
  }
});

test('HRS-4 a pharmacy is offered the pharmacist allowance as a suggestion, not in the starter set', async ({ api }) => {
  const r = await api.request('GET', '/hr/starter', undefined, MGR);
  expect(codes(r.body.starter)).not.toContain('PHARMACIST');
  const biz = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
  expect(codes(r.body.suggestions).includes('PHARMACIST')).toBe(biz.businesstype !== 'general');
});
