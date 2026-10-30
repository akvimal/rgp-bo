/**
 * Owners, partners and directors against payroll - HRO-1..3
 * An owner or partner is never on payroll; a director is only when the company pays a salary. Payroll and KPI skip anyone not on payroll.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const setForm = (api: any, legalform: string) => api.request('PUT', '/businesses/mine', { legalform }, MGR);
/** a past month, so nothing touches the current payroll */
const P = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 5); return d.toISOString().slice(0, 7); })();
const made: number[] = [];
const person = async (api: any, name: string, extra: any = {}) =>
  api.request('POST', '/hr/staff', { full_name: `QA ${name} ${Date.now()}`, phone: '9000000003', join_date: '2020-01-01', emp_type: 'FULL_TIME', weekly_off: 'SUNDAY', ...extra }, MGR);

test.afterEach(async ({ api }) => {
  for (const id of made.splice(0)) await api.request('DELETE', `/hr/staff/${id}`, undefined, MGR);
  await setForm(api, 'PROPRIETORSHIP');
  const ps = (await api.request('GET', '/hr/positions', undefined, MGR)).body || [];
  for (const p of ps.filter((x: any) => x.name === 'Cashier' && !x.staff)) await api.request('DELETE', `/hr/positions/${p.id}`, undefined, MGR);
});

test('HRO-1 in a proprietorship an owner is never on payroll, a director is refused, and an employee is on payroll by default', async ({ api }) => {
  await setForm(api, 'PROPRIETORSHIP');
  const emp = await person(api, 'Employee');
  expect(emp.status).toBe(201);
  made.push(emp.body.id);
  expect((await api.request('GET', `/hr/staff/${emp.body.id}`, undefined, MGR)).body).toMatchObject({ relationship: 'EMPLOYEE', on_payroll: true });

  const own = await person(api, 'Owner', { relationship: 'OWNER', on_payroll: true });
  expect(own.status).toBe(201);
  made.push(own.body.id);
  expect((await api.request('GET', `/hr/staff/${own.body.id}`, undefined, MGR)).body).toMatchObject({ relationship: 'OWNER', on_payroll: false });
  const basic = (await api.request('GET', '/hr/components', undefined, MGR)).body.find((c: any) => c.code === 'BASIC');
  if (basic) {
    const rev = await api.request('POST', `/hr/staff/${own.body.id}/revisions`, { effective_from: '2020-02-01', lines: [{ component_id: basic.id, amount: 1000 }] }, MGR);
    expect(rev.status).toBe(400);
    expect(JSON.stringify(rev.body)).toContain('not on payroll');
  }
  expect((await person(api, 'Director', { relationship: 'DIRECTOR' })).status).toBe(400);
  expect((await person(api, 'Boss', { relationship: 'BOSS' })).status).toBe(400);
  const row = ((await api.request('GET', '/hr/staff', undefined, MGR)).body as any[]).find((r) => r.id === own.body.id);
  expect(row).toMatchObject({ relationship: 'OWNER', on_payroll: false });
});

test('HRO-2 in a limited company a director is off payroll until salaried, and an owner is refused; payroll and KPI leave out anyone not on payroll', async ({ api }) => {
  await setForm(api, 'PRIVATE_LIMITED');
  expect((await person(api, 'Owner', { relationship: 'OWNER' })).status).toBe(400);
  const dir = await person(api, 'Director', { relationship: 'DIRECTOR' });
  expect(dir.status).toBe(201);
  made.push(dir.body.id);
  expect((await api.request('GET', `/hr/staff/${dir.body.id}`, undefined, MGR)).body).toMatchObject({ relationship: 'DIRECTOR', on_payroll: false });
  const inKpi = async (id: number) => ((await api.request('GET', `/hr/kpi/month?period=${P}`, undefined, MGR)).body as any[]).some((r) => r.employee_id === id);
  expect(await inKpi(dir.body.id)).toBe(false);

  expect((await api.request('PUT', `/hr/staff/${dir.body.id}`, { relationship: 'DIRECTOR', on_payroll: true }, MGR)).status).toBe(200);
  expect((await api.request('GET', `/hr/staff/${dir.body.id}`, undefined, MGR)).body).toMatchObject({ on_payroll: true });
  expect(await inKpi(dir.body.id)).toBe(true);

  expect((await api.request('PUT', `/hr/staff/${dir.body.id}`, { on_payroll: false }, MGR)).status).toBe(200);
  expect(await inKpi(dir.body.id)).toBe(false);
});

test('HRO-3 the Setup screen marks the owner, offers owner or director by registration, and adds suggested job roles', async ({ app, api }) => {
  await setForm(api, 'PROPRIETORSHIP');
  const cand = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body as any[];
  const me = cand.find((c) => c.is_you);
  const { page } = await app.open(MGR, '/secure/hr/setup');
  if (me) {
    const row = page.getByTestId('hr-person').filter({ has: page.getByText('You', { exact: true }) });
    await expect(row).toBeVisible();
    await expect(page.getByTestId(`hr-person-rel-${me.id}`)).toHaveValue('OWNER');
    await expect(page.getByTestId(`hr-person-add-${me.id}`)).toContainText('not on payroll');
    await expect(page.getByTestId(`hr-person-rel-${me.id}`).locator('option[value="DIRECTOR"]')).toHaveCount(0);
  }
  await page.getByTestId('hr-role-suggest-Cashier').check();
  await page.getByTestId('hr-add-role-suggested').click();
  await expect(page.getByTestId('hr-setup-message')).toContainText('Cashier');
  const ps = (await api.request('GET', '/hr/positions', undefined, MGR)).body as any[];
  expect(ps.some((p) => p.name === 'Cashier')).toBe(true);
  const again = await api.request('POST', '/hr/starter', { role_names: ['cashier', 'NOT A ROLE'] }, MGR);
  expect(again.body.roles).toEqual([]);
});
