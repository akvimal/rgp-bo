/**
 * Mini HR — HR-1..6
 * Staff, salary revisions, leave, attendance, KPI, and the monthly payroll with pay stubs (Business Head only).
 * The specs run in order: HR-2 creates the staff record the later ones use. Re-running needs a fresh seed.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';
const COUNTER = 'sales1@local.test';
const STAFF_EMAIL = 'sales2@local.test';

/** two months back: always in the past, never the current month */
const P = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 2); return d.toISOString().slice(0, 7); })();
/** the first Monday of that month, and the days after it */
const day = (n: number) => {
  let d = new Date(`${P}-01T00:00:00Z`);
  while (d.getUTCDay() !== 1) d = new Date(d.getTime() + 86400000);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
};
const MON = () => day(0), TUE = () => day(1), WED = () => day(2), THU = () => day(3), FRI = () => day(4);

let empId = 0;
const comp: Record<string, number> = {};

async function employee(api: any) {
  if (empId) return empId;
  const list = (await api.request('GET', '/hr/staff', undefined, MGR)).body;
  empId = list.find((s: any) => s.email === STAFF_EMAIL)?.id || 0;
  return empId;
}

test.describe('HR @p1', () => {
  test('HR-1 only the Business Head can use HR @negative', async ({ api }) => {
    for (const who of [COUNTER, STOREHEAD]) {
      expect((await api.request('GET', '/hr/staff', undefined, who)).status).toBe(403);
      expect((await api.request('GET', `/hr/payroll/${P}`, undefined, who)).status).toBe(403);
      expect((await api.request('POST', `/hr/payroll/${P}/generate`, {}, who)).status).toBe(403);
      expect((await api.request('GET', '/hr/kpi/month?period=' + P, undefined, who)).status).toBe(403);
    }
    expect((await api.request('GET', '/hr/staff', undefined, MGR)).status).toBe(200);
  });

  test('HR-2 a staff record, validated, with dated salary revisions @happy', async ({ api }) => {
    const comps = (await api.request('GET', '/hr/components', undefined, MGR)).body;
    for (const c of comps) comp[c.code] = c.id;
    expect(Object.keys(comp)).toEqual(expect.arrayContaining(['BASIC', 'DA', 'OTHERS']));

    const cand = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body;
    const user = cand.find((c: any) => c.email === STAFF_EMAIL);
    expect(user).toBeTruthy();

    const add = (b: any) => api.request('POST', '/hr/staff', { user_id: user.id, join_date: '2020-01-01', designation: 'Pharmacy assistant', ...b }, MGR);
    expect((await add({ join_date: undefined })).status).toBe(400);                      // joining date needed
    expect((await add({ pan: 'BADPAN' })).status).toBe(400);
    expect((await add({ ifsc: 'X1' })).status).toBe(400);
    expect((await add({ aadhaar_last4: '12345' })).status).toBe(400);
    const ok = await add({ pan: 'ABCDE1234F', bank_name: 'QA Bank', account_no: '1234567890', ifsc: 'SBIN0001234', weekly_off: 'SUNDAY' });
    expect(ok.status).toBeLessThan(300);
    empId = ok.body.id;
    expect(ok.body.emp_code).toMatch(/^E\d{3}$/);
    expect((await add({})).status).toBe(400);                                            // one record per login

    const rev = (b: any) => api.request('POST', `/hr/staff/${empId}/revisions`, b, MGR);
    expect((await rev({ effective_from: '2020-01-01', lines: [] })).status).toBe(400);
    expect((await rev({ effective_from: '2020-01-01', lines: [{ component_id: comp.FIXED_DED, amount: 100 }] })).status).toBe(400);   // a salary needs an earning
    const first = await rev({ effective_from: '2020-01-01', reason: 'Joining', lines: [{ component_id: comp.BASIC, amount: 15000 }, { component_id: comp.DA, amount: 3000 }, { component_id: comp.OTHERS, amount: 2000 }] });
    expect(first.status).toBeLessThan(300);
    expect((await rev({ effective_from: '2020-01-01', lines: [{ component_id: comp.BASIC, amount: 1 }] })).status).toBe(400);   // same date twice

    const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const rise = await rev({ effective_from: future, reason: 'Increment', lines: [{ component_id: comp.BASIC, amount: 17000 }, { component_id: comp.DA, amount: 3000 }, { component_id: comp.OTHERS, amount: 2000 }] });
    expect(rise.status).toBeLessThan(300);
    expect((await api.request('DELETE', `/hr/revisions/${first.body.id}`, undefined, MGR)).status).toBe(400);   // history stays
    expect((await api.request('DELETE', `/hr/revisions/${rise.body.id}`, undefined, MGR)).status).toBeLessThan(300);

    const detail = (await api.request('GET', `/hr/staff/${empId}`, undefined, MGR)).body;
    expect(detail.revisions).toHaveLength(1);
    const row = (await api.request('GET', '/hr/staff', undefined, MGR)).body.find((s: any) => s.id === empId);
    expect(row.monthly_earnings).toBe(20000);
  });

  test('HR-3 leave: types, overlap, entitlement, approval and cancellation @edge', async ({ api }) => {
    await employee(api);
    const types = (await api.request('GET', '/hr/leave/types', undefined, MGR)).body;
    const CL = types.find((t: any) => t.code === 'CL').id;
    const LWP = types.find((t: any) => t.code === 'LWP').id;
    expect(types.find((t: any) => t.code === 'LWP').paid).toBe(false);
    expect((await api.request('PUT', `/hr/leave/types/${CL}`, { name: 'Casual leave', paid: false, annual_days: 12 }, MGR)).status).toBe(400);   // paid cannot flip

    const ask = (b: any) => api.request('POST', '/hr/leave/requests', { employee_id: empId, ...b }, MGR);
    expect((await ask({ leave_type_id: CL, from_date: TUE(), to_date: MON() })).status).toBe(400);              // backwards
    expect((await ask({ leave_type_id: CL, from_date: MON(), to_date: TUE(), half_day: true })).status).toBe(400);   // half day is one day
    const sunday = new Date(new Date(MON()).getTime() - 86400000).toISOString().slice(0, 10);
    expect((await ask({ leave_type_id: CL, from_date: sunday, to_date: sunday })).status).toBe(400);              // weekly off is not leave

    const two = await ask({ leave_type_id: CL, from_date: MON(), to_date: TUE(), reason: 'QA family event' });
    expect(two.status).toBeLessThan(300);
    expect(two.body.days).toBe(2);
    expect((await ask({ leave_type_id: LWP, from_date: TUE(), to_date: WED() })).status).toBe(400);               // overlaps the first
    expect((await api.request('POST', `/hr/leave/requests/${two.body.id}/decision`, { action: 'reject' }, MGR)).status).toBe(400);   // a reason is needed
    expect((await api.request('POST', `/hr/leave/requests/${two.body.id}/decision`, { action: 'approve' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', `/hr/leave/requests/${two.body.id}/decision`, { action: 'approve' }, MGR)).status).toBe(400);   // decided once

    const lwp = await ask({ leave_type_id: LWP, from_date: WED(), to_date: WED() });
    expect((await api.request('POST', `/hr/leave/requests/${lwp.body.id}/decision`, { action: 'approve' }, MGR)).status).toBeLessThan(300);

    // a paid type with a one-day entitlement cannot take two days
    const code = 'QA' + String(Date.now()).slice(-6);
    const t = await api.request('POST', '/hr/leave/types', { name: code, paid: true, annual_days: 1 }, MGR);
    expect(t.status).toBeLessThan(300);
    const over = await ask({ leave_type_id: t.body.id, from_date: THU(), to_date: FRI() });
    expect(over.status).toBeLessThan(300);
    const refused = await api.request('POST', `/hr/leave/requests/${over.body.id}/decision`, { action: 'approve' }, MGR);
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toContain('left this year');
    expect((await api.request('POST', `/hr/leave/requests/${over.body.id}/decision`, { action: 'cancel' }, MGR)).status).toBeLessThan(300);

    const bal = (await api.request('GET', `/hr/leave/balances?year=${P.slice(0, 4)}`, undefined, MGR)).body.find((b: any) => b.employee_id === empId && b.code === 'CL');
    expect(bal.used).toBeGreaterThanOrEqual(2);
  });

  test('HR-4 KPI measures, bands and a monthly score @happy', async ({ api }) => {
    await employee(api);
    const m1 = await api.request('POST', '/hr/kpi/metrics', { name: 'QA Service', max_points: 10 }, MGR);
    const m2 = await api.request('POST', '/hr/kpi/metrics', { name: 'QA Accuracy', max_points: 10 }, MGR);
    expect(m1.status).toBeLessThan(300);
    expect((await api.request('POST', '/hr/kpi/metrics', { name: 'x', max_points: 0 }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/hr/kpi/bands', { bands: [{ min_percent: 0, label: 'A', incentive_percent: 0 }, { min_percent: 0, label: 'B', incentive_percent: 1 }] }, MGR)).status).toBe(400);   // same start
    expect((await api.request('PUT', '/hr/kpi/bands', { bands: [{ min_percent: 0, label: 'Low', incentive_percent: 0 }, { min_percent: 70, label: 'Good', incentive_percent: 5 }, { min_percent: 90, label: 'Excellent', incentive_percent: 10 }] }, MGR)).status).toBeLessThan(300);

    const all = (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body.filter((m: any) => m.active);
    const score = (pts: number) => api.request('POST', '/hr/kpi/score', { employee_id: empId, period: P, scores: all.map((m: any) => ({ metric_id: m.id, points: Math.min(pts, m.max_points) })) }, MGR);
    expect((await score(99)).status).toBeLessThan(300);                                  // capped to each maximum by the test, so valid
    const bad = await api.request('POST', '/hr/kpi/score', { employee_id: empId, period: P, scores: all.map((m: any) => ({ metric_id: m.id, points: m.max_points + 1 })) }, MGR);
    expect(bad.status).toBe(400);
    const r = await score(99);
    expect(r.body.percent).toBe(100);
    expect(r.body.band).toBe('Excellent');
    expect(r.body.incentive_percent).toBe(10);
    void m2;

    const month = (await api.request('GET', `/hr/kpi/month?period=${P}`, undefined, MGR)).body.find((x: any) => x.employee_id === empId);
    expect(month.band_label).toBe('Excellent');
    expect(month).toHaveProperty('bills');
  });

  test('HR-5 attendance and the monthly payroll, locking, staff-credit recovery and pay stub @happy', async ({ api, request }) => {
    await employee(api);
    const mark = (date: string, status: string | null) => api.request('PUT', '/hr/attendance', { employee_id: empId, date, status }, MGR);
    expect((await mark(THU(), 'ABSENT')).status).toBeLessThan(300);
    expect((await mark(FRI(), 'HALF_DAY')).status).toBeLessThan(300);
    expect((await mark(THU(), 'BOGUS')).status).toBe(400);
    expect((await mark(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), 'PRESENT')).status).toBe(400);   // future
    expect((await mark('2019-12-31', 'PRESENT')).status).toBe(400);                                                        // before joining
    const grid = (await api.request('GET', `/hr/attendance?period=${P}`, undefined, MGR)).body;
    const me = grid.staff.find((s: any) => s.id === empId);
    expect(me.marks[THU()]).toBe('ABSENT');
    expect(me.leave[MON()].paid).toBe(true);
    expect(me.leave[WED()].paid).toBe(false);

    // something to recover from the salary
    const sc = (await api.request('GET', '/users', undefined, MGR)).body.find((u: any) => u.email === STAFF_EMAIL).id;
    await api.request('POST', `/staff-credit/${sc}/adjustment`, { amount: 500, note: 'QA payroll balance' }, MGR);
    const owed = (await api.request('GET', `/staff-credit/summary?period=${P}`, undefined, MGR)).body.find((r: any) => r.user_id === sc).outstanding as number;
    expect(owed).toBeGreaterThanOrEqual(500);

    const gen = await api.request('POST', `/hr/payroll/${P}/generate`, {}, MGR);
    expect(gen.status).toBeLessThan(300);
    const line = gen.body.run.lines.find((l: any) => l.employee_id === empId);
    expect(line.unpaid_days).toBe(2.5);                    // absent 1 + half day 0.5 + unpaid leave 1; the paid casual leave costs nothing
    expect(line.payable_days).toBe(27.5);
    expect(line.earnings_paid).toBeCloseTo(18333.33, 1);
    expect(line.kpi_incentive).toBeCloseTo(1833.33, 1);    // Excellent: 10% of the earnings
    expect(line.staff_credit_recovery).toBeCloseTo(owed, 1);
    expect(line.net).toBeCloseTo(18333.33 + 1833.33 - owed, 1);

    // edits are checked
    expect((await api.request('PUT', `/hr/payroll/lines/${line.id}`, { extra_deduction: 999999 }, MGR)).status).toBe(400);              // net would be negative
    expect((await api.request('PUT', `/hr/payroll/lines/${line.id}`, { adjustment: 250 }, MGR)).status).toBe(400);                       // an adjustment needs a note
    expect((await api.request('PUT', `/hr/payroll/lines/${line.id}`, { staff_credit_recovery: owed + 1000 }, MGR)).status).toBe(400);    // more than owed
    const edit = await api.request('PUT', `/hr/payroll/lines/${line.id}`, { extra_deduction: 100, adjustment: 250, adjustment_note: 'QA arrears' }, MGR);
    expect(edit.status).toBeLessThan(300);
    expect(edit.body.net).toBeCloseTo(line.net - 100 + 250, 1);

    const stub = (await api.request('GET', `/hr/payroll/stub/${line.id}`, undefined, MGR)).body;
    expect(stub.name).toBeTruthy();
    expect(stub.account_no).toBe('XXXX7890');              // the account number is masked
    expect(stub.net).toBeCloseTo(edit.body.net, 1);

    // approving writes the recovery and locks the month
    expect((await api.request('POST', `/hr/payroll/${P}/approve`, {}, MGR)).status).toBeLessThan(300);
    const after = (await api.request('GET', `/staff-credit/summary?period=${P}`, undefined, MGR)).body.find((r: any) => r.user_id === sc).outstanding as number;
    expect(after).toBeCloseTo(owed - line.staff_credit_recovery, 1);
    expect((await api.request('POST', `/hr/payroll/${P}/generate`, {}, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/hr/payroll/lines/${line.id}`, { extra_deduction: 1 }, MGR)).status).toBe(400);
    expect((await mark(THU(), 'PRESENT')).status).toBe(400);                                                                              // attendance is locked too
    const lv = (await api.request('GET', `/hr/leave/requests?period=${P}&employee=${empId}`, undefined, MGR)).body.find((r: any) => r.status === 'APPROVED');
    expect((await api.request('POST', `/hr/leave/requests/${lv.id}/decision`, { action: 'cancel' }, MGR)).status).toBe(400);              // and leave

    const token = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }) })).json()).token;
    const xl = await fetch(`${process.env.QA_API_URL}/hr/payroll/${P}/export`, { headers: { authorization: `Bearer ${token}` } });
    expect(xl.status).toBe(200);
    expect(xl.headers.get('content-type')).toContain('spreadsheetml');
    void request;

    // reopen takes the recovery back
    expect((await api.request('POST', `/hr/payroll/${P}/reopen`, { reason: 'x' }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/hr/payroll/${P}/reopen`, { reason: 'QA correction' }, MGR)).status).toBeLessThan(300);
    const back = (await api.request('GET', `/staff-credit/summary?period=${P}`, undefined, MGR)).body.find((r: any) => r.user_id === sc).outstanding as number;
    expect(back).toBeCloseTo(owed, 1);
    expect((await api.request('POST', `/hr/payroll/${P}/approve`, {}, MGR)).status).toBeLessThan(300);   // leave it approved
  });

  test('HR-6 the HR pages: menu, staff, attendance, leave, KPI, payroll with a pay stub, setup @happy', async ({ app, api }) => {
    await employee(api);
    const { page } = await app.open(MGR, '/secure/hr');
    await expectShell(page);
    await expect(page.locator('#main h1').first()).toHaveText('HR');
    await expect(page.getByTestId('nav-hr')).toBeVisible();

    await expect(page.getByTestId('hr-staff-row').first()).toBeVisible();
    await page.getByTestId('hr-staff-row').first().click();
    await expect(page.getByTestId('hr-rev-table')).toBeVisible();
    await expect(page.getByTestId('hr-staff-back')).toBeVisible();

    await page.getByTestId('hr-tab-attendance').click();
    await page.getByTestId('hr-att-period').fill(P);
    await expect(page.locator(`[data-testid=hr-att-row][data-emp="${empId}"]`)).toBeVisible();

    await page.getByTestId('hr-tab-leave').click();
    await expect(page.getByTestId('hr-leave-row').first()).toBeVisible();

    await page.getByTestId('hr-tab-kpi').click();
    await page.getByTestId('hr-kpi-period').fill(P);
    await expect(page.getByTestId('hr-kpi-row').first()).toContainText('Excellent');

    await page.getByTestId('hr-tab-payroll').click();
    await page.getByTestId('hr-pay-period').fill(P);
    await expect(page.getByTestId('hr-pay-status')).toHaveText('Approved');
    await page.locator(`[data-testid=hr-pay-row][data-emp="${empId}"]`).getByTestId('hr-pay-stub').click();
    await expect(page.getByTestId('hr-stub')).toContainText('Net pay');
    await expect(page.getByTestId('hr-stub-print')).toBeVisible();

    await page.getByTestId('hr-tab-setup').click();
    const values = (id: string) => page.getByTestId(id).locator('input.form-control').evaluateAll((els: any[]) => els.map(e => e.value));
    await expect.poll(() => values('hr-set-components')).toContain('Basic');
    await expect.poll(() => values('hr-set-types')).toContain('Casual leave');

    // other roles have no menu entry or page
    const sh = await app.open(STOREHEAD, '/secure/dashboard');
    await expect(sh.page.getByTestId('nav-hr')).toHaveCount(0);
  });
});
