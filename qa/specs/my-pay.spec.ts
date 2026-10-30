/**
 * A staff member's own pay structure and its revision history - MYP-1..2
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
const day = (offset: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
const cleanup: (() => Promise<any>)[] = [];

test.afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f().catch(() => {}); });

async function staff(api: any) {
  const roles = (await api.request('GET', '/roles', undefined, MGR)).body as any[];
  const email = `qa.myp.${stamp()}@local.test`;
  const u = await api.request('POST', '/users', { fullname: 'QA My Pay', email, password: PASS, phone: '9000000007', location: 'x', roleid: roles.find((r) => r.name === 'Sales Staff').id, storeids: [data.storesOf(1)[0].id] }, MGR);
  expect(u.status).toBeLessThan(300);
  cleanup.push(() => api.request('DELETE', `/users/${u.body.id}`, undefined, MGR));
  const e = await api.request('POST', '/hr/staff', { user_id: u.body.id, join_date: '2020-01-01', emp_type: 'FULL_TIME', weekly_off: 'SUNDAY' }, MGR);
  expect(e.status).toBe(201);
  cleanup.push(() => api.request('DELETE', `/hr/staff/${e.body.id}`, undefined, MGR));
  return { email, empId: e.body.id as number };
}

test('MYP-1 a staff member sees the pay in force, what is coming and what changed, but not the owner reason', async ({ api }) => {
  const { email, empId } = await staff(api);
  const comps = (await api.request('GET', '/hr/components', undefined, MGR)).body as any[];
  const earn = comps.filter((c) => c.kind === 'EARNING' && c.active !== false).slice(0, 2);
  expect(earn.length).toBe(2);
  const rev = (from: string, a: number, b: number, reason: string) =>
    api.request('POST', `/hr/staff/${empId}/revisions`, { effective_from: from, reason, lines: [{ component_id: earn[0].id, amount: a }, { component_id: earn[1].id, amount: b }] }, MGR);
  expect((await rev('2020-01-01', 10000, 1000, 'joining')).status).toBe(201);
  expect((await rev(day(-30), 11000, 1000, 'PRIVATE-NOTE-ABOUT-APPRAISAL')).status).toBe(201);
  expect((await rev(day(60), 12000, 1500, 'next year')).status).toBe(201);

  const mine = await api.request('GET', '/my-hr/pay', undefined, email);
  expect(mine.status).toBe(200);
  expect(mine.body.on_payroll).toBe(true);
  expect(mine.body.current.gross).toBe(12000);
  expect(mine.body.upcoming.map((u: any) => u.gross)).toEqual([13500]);
  expect(mine.body.history.map((h: any) => h.gross)).toEqual([12000, 11000]);
  const change = mine.body.history[0].changes.find((c: any) => c.name === earn[0].name);
  expect(change).toMatchObject({ from: 10000, to: 11000 });
  expect(JSON.stringify(mine.body)).not.toContain('PRIVATE-NOTE');
  expect(JSON.stringify(mine.body)).not.toContain('reason');
});

test('MYP-2 the My pay tab shows the pay in force and the history', async ({ app, api }) => {
  const { email, empId } = await staff(api);
  const comps = (await api.request('GET', '/hr/components', undefined, MGR)).body as any[];
  const basic = comps.find((c) => c.code === 'BASIC');
  expect((await api.request('POST', `/hr/staff/${empId}/revisions`, { effective_from: '2020-01-01', lines: [{ component_id: basic.id, amount: 15000 }] }, MGR)).status).toBe(201);
  const { page } = await app.open(email, '/secure/my-hr');
  await page.getByTestId('myhr-tab-pay').click();
  await expect(page.getByTestId('myhr-pay-gross')).toContainText('15,000.00');
  await expect(page.getByTestId('myhr-pay-step')).toHaveCount(1);
});
