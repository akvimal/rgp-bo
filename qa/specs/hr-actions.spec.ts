/**
 * The HR permission carries one action per area - RHA-1..6 (MENU_AND_PERMISSIONS step D, HR).
 * A role holding only one action can do that and nothing else; the old view and manage boxes open nothing; pay stays out of the staff list
 * without the pay view.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const madeRoles: number[] = [];
const madeUsers: number[] = [];

/** a role holding only the HR page with these actions, and a login with it */
async function loginWith(api: any, actions: string[]) {
  const hr = { resource: 'hr', path: '/secure/hr', policies: actions.map((action) => ({ action })) };
  const role = await api.request('POST', '/roles', { name: `QA Hr ${stamp()}`, permissions: [hr], locked: false }, MGR);
  expect(role.status).toBeLessThan(300);
  madeRoles.push(role.body.id);
  const email = `qa.rha.${stamp()}@local.test`;
  const user = await api.request('POST', '/users', { fullname: 'QA RHA', email, password: PASS, phone: '9000000010', location: 'x', roleid: role.body.id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(user.status).toBeLessThan(300);
  madeUsers.push(user.body.id);
  return email;
}

const status = async (api: any, method: string, path: string, email: string, body?: unknown) => (await api.request(method, path, body, email)).status;

test.afterAll(async ({ api }) => {
  for (const id of madeUsers.splice(0)) await api.request('DELETE', `/users/${id}`, undefined, MGR);
  for (const id of madeRoles.splice(0)) await api.request('DELETE', `/roles/${id}`, undefined, MGR);
});

test.describe('HR actions @p1', () => {
  test('RHA-1 the old HR view and manage boxes open nothing; only the owner roles do by name @negative', async ({ api }) => {
    const email = await loginWith(api, ['view', 'manage']);
    for (const path of ['/hr/staff', '/hr/attendance', '/hr/payroll', '/hr/leave/types', '/hr/bonuses', '/hr/kpi/bands']) {
      expect(await status(api, 'GET', path, email), path).toBe(403);
    }
    expect(await status(api, 'GET', '/hr/staff', MGR)).toBe(200);
  });

  test('RHA-2 staff.view lists the staff without their earnings, and changes nothing @permission', async ({ api }) => {
    const email = await loginWith(api, ['staff.view']);
    const list = await api.request('GET', '/hr/staff', undefined, email);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThan(0);
    list.body.forEach((p: any) => expect(Object.keys(p)).not.toContain('monthly_earnings'));
    const one = await api.request('GET', `/hr/staff/${list.body[0].id}`, undefined, email);
    expect(one.status).toBe(200);
    expect(one.body.revisions).toEqual([]);
    expect(await status(api, 'POST', '/hr/staff', email, {})).toBe(403);                            // view is not manage
    expect(await status(api, 'GET', `/hr/staff/${list.body[0].id}/accounts`, email)).toBe(403);    // bank details are pay
    expect(await status(api, 'GET', '/hr/payroll', email)).toBe(403);
    // the owner still sees earnings
    const owner = await api.request('GET', '/hr/staff', undefined, MGR);
    expect(owner.body.some((p: any) => 'monthly_earnings' in p)).toBe(true);
  });

  test('RHA-3 pay.view adds earnings and bank details; changing them is pay.manage @permission', async ({ api }) => {
    const email = await loginWith(api, ['staff.view', 'pay.view']);
    const list = await api.request('GET', '/hr/staff', undefined, email);
    expect(list.body.some((p: any) => 'monthly_earnings' in p)).toBe(true);
    const id = list.body[0].id;
    expect(await status(api, 'GET', `/hr/staff/${id}/accounts`, email)).toBe(200);
    expect(await status(api, 'GET', '/hr/components', email)).toBe(200);
    expect(await status(api, 'PUT', `/hr/staff/${id}/accounts`, email, {})).toBe(403);
    expect(await status(api, 'POST', `/hr/staff/${id}/revisions`, email, {})).toBe(403);
    expect(await status(api, 'POST', '/hr/components', email, {})).toBe(403);
  });

  test('RHA-4 payroll: viewing, running and approving are three separate actions @permission', async ({ api }) => {
    const viewer = await loginWith(api, ['payroll.view']);
    expect(await status(api, 'GET', '/hr/payroll', viewer)).toBe(200);
    expect(await status(api, 'POST', '/hr/payroll/2099-01/generate', viewer, {})).toBe(403);
    const runner = await loginWith(api, ['payroll.view', 'payroll.run']);
    expect(await status(api, 'POST', '/hr/payroll/2099-01/generate', runner, {})).not.toBe(403);    // allowed to try; the period itself may be refused
    expect(await status(api, 'POST', '/hr/payroll/2099-01/approve', runner, {})).toBe(403);
    expect(await status(api, 'POST', '/hr/payroll/2099-01/reopen', runner, {})).toBe(403);
    const approver = await loginWith(api, ['payroll.approve']);
    expect(await status(api, 'POST', '/hr/payroll/2099-01/approve', approver, {})).not.toBe(403);
  });

  test('RHA-5 attendance, leave, KPI and bonus each open only their own area @permission', async ({ api }) => {
    const att = await loginWith(api, ['attendance.manage']);
    expect(await status(api, 'GET', '/hr/attendance?period=2026-09', att)).toBe(200);
    expect(await status(api, 'GET', '/hr/leave/types', att)).toBe(403);
    expect(await status(api, 'GET', '/hr/bonuses', att)).toBe(403);
    const leave = await loginWith(api, ['leave.manage']);
    expect(await status(api, 'GET', '/hr/leave/types', leave)).toBe(200);
    expect(await status(api, 'GET', '/hr/holidays', leave)).toBe(200);
    expect(await status(api, 'GET', '/hr/attendance', leave)).toBe(403);
    const kpi = await loginWith(api, ['kpi.setup']);
    expect(await status(api, 'GET', '/hr/kpi/bands', kpi)).toBe(200);
    expect(await status(api, 'GET', '/hr/ai/status', kpi)).toBe(200);
    expect(await status(api, 'GET', '/hr/payroll', kpi)).toBe(403);
    const bonus = await loginWith(api, ['bonus.manage']);
    expect(await status(api, 'GET', '/hr/bonuses?period=2026-09', bonus)).not.toBe(403);       // allowed; a request with no period is a 400, not a refusal
    expect(await status(api, 'GET', '/hr/kpi/bands', bonus)).toBe(403);
  });

  test('RHA-6 the HR pages show only the tabs the role holds, and send a closed tab to the first open one @happy', async ({ app, api }) => {
    const email = await loginWith(api, ['view', 'payroll.view', 'staff.view']);
    const a = await app.open(email, '/secure/hr');
    await expectShell(a.page);
    await expect(a.page.getByTestId('hr-tab-staff')).toBeVisible();
    await expect(a.page.getByTestId('hr-tab-payroll')).toBeVisible();
    for (const t of ['bonus', 'kpi', 'leave', 'attendance', 'setup']) await expect(a.page.getByTestId(`hr-tab-${t}`), t).toHaveCount(0);
    await a.page.goto('/secure/hr/bonus');
    await a.page.waitForURL(/\/secure\/hr\/staff/);
    // a role with only payroll.view lands on the payroll tab from the HR root
    const payOnly = await loginWith(api, ['view', 'payroll.view']);
    const b = await app.open(payOnly, '/secure/hr');
    await b.page.waitForURL(/\/secure\/hr\/payroll/);
    await expect(b.page.getByTestId('hr-tab-staff')).toHaveCount(0);
  });
});
