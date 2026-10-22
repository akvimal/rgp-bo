/**
 * Mini HR — HR-1..13
 * Staff, salary revisions, leave, attendance, KPI, and the monthly payroll with pay stubs (Business Head only).
 * The specs run in order: HR-2 creates the staff record the later ones use. Re-running needs a fresh seed.
 */
import { test, expect, data } from '../fixtures/index.js';
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
/** three months back: payroll for it is never approved by these specs */
const Q = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 7); })();
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
    // grouped into collapsible sections: the first is open, the rest open on demand
    await expect(page.getByTestId('hr-sec-pay-body')).toBeVisible();
    await expect(page.getByTestId('hr-sec-kpi-body')).toHaveCount(0);
    await page.getByTestId('hr-sec-collapse').click();
    await expect(page.getByTestId('hr-sec-pay-body')).toHaveCount(0);
    await page.getByTestId('hr-sec-expand').click();
    await expect(page.getByTestId('hr-set-metrics')).toBeVisible();
    await expect(page.getByTestId('hr-set-bands')).toBeVisible();
    await expect(page.getByTestId('hr-set-holidays')).toBeVisible();
    await expect(page.getByTestId('hr-set-components')).toBeVisible();
    await expect(page.getByTestId('hr-set-types')).toBeVisible();
    await expect(page.getByTestId('hr-set-comp-remove').first()).toBeVisible();
    await expect(page.getByTestId('hr-set-type-remove').first()).toBeVisible();

    // other roles have no menu entry or page
    const sh = await app.open(STOREHEAD, '/secure/dashboard');
    await expect(sh.page.getByTestId('nav-hr')).toHaveCount(0);
  });

  test('HR-7 Settings > Users shows the staff record of each login and starts one for those without @happy', async ({ app, api }) => {
    await employee(api);
    const { page } = await app.open(MGR, '/secure/settings/users');
    await expectShell(page);
    const linked = page.locator(`[data-testid=user-row][data-user-email="${STAFF_EMAIL}"]`);
    await expect(linked.getByTestId('user-staff-open')).toBeVisible();
    const free = page.locator(`[data-testid=user-row][data-user-email="${COUNTER}"]`);
    await free.getByTestId('user-staff-add').click();
    await page.waitForURL(/\/secure\/hr\/staff\?user=/);
    await expect(page.getByTestId('hr-f-user')).toBeVisible();
    expect(await page.getByTestId('hr-f-user').evaluate((el: any) => el.selectedOptions[0].textContent)).toContain(COUNTER);

    // the form is grouped, and the stores are the login's own mappings
    for (const sec of ['employment', 'stores', 'personal', 'bank']) await expect(page.getByTestId(`hr-sec-${sec}`)).toBeVisible();
    const cand = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body.find((c: any) => c.email === COUNTER);
    expect(cand.stores.length).toBeGreaterThan(0);
    for (const st of cand.stores) await expect(page.getByTestId('hr-f-stores')).toContainText(st.name);
    const outside = (await api.request('GET', '/hr/stores', undefined, MGR)).body.find((st: any) => !cand.stores.some((m: any) => m.id === st.id));
    if (outside) {
      const bad = await api.request('POST', '/hr/staff', { user_id: cand.id, join_date: '2025-01-01', store_id: outside.id }, MGR);
      expect(bad.status).toBe(400);
    }

    // roles without HR access are not offered the column
    const sh = await app.open(STOREHEAD, '/secure/settings/users');
    await expect(sh.page.getByTestId('user-row-staff')).toHaveCount(0);
  });

  test('HR-8 staff without a login, and a weekly off on any day @edge', async ({ app, api }) => {
    const store = data.storesOf(1)[0].id;
    const add = (b: any) => api.request('POST', '/hr/staff', { join_date: '2025-01-01', ...b }, MGR);
    expect((await add({})).status).toBe(400);                                          // neither a login nor a name
    expect((await add({ full_name: 'QA Cleaner', weekly_off: 'FUNDAY' })).status).toBe(400);
    expect((await add({ full_name: 'QA Cleaner', phone: 'abc' })).status).toBe(400);

    const made = await add({ full_name: 'QA Cleaner', phone: '9876500011', store_id: store, emp_type: 'PART_TIME', weekly_off: 'WEDNESDAY' });
    expect(made.status).toBeLessThan(300);
    const list = (await api.request('GET', '/hr/staff', undefined, MGR)).body;
    const row = list.find((r: any) => r.id === made.body.id);
    expect(row.name).toBe('QA Cleaner');
    expect(row.has_login).toBe(false);

    // the weekly off is Wednesday, so a Tuesday-to-Thursday leave is two days
    const types = (await api.request('GET', '/hr/leave/types', undefined, MGR)).body;
    const CL = types.find((t: any) => t.code === 'CL').id;
    const leave = await api.request('POST', '/hr/leave/requests', { employee_id: made.body.id, leave_type_id: CL, from_date: TUE(), to_date: THU(), reason: 'QA' }, MGR);
    expect(leave.status).toBeLessThan(300);
    expect(leave.body.days).toBe(2);
    const onOff = await api.request('POST', '/hr/leave/requests', { employee_id: made.body.id, leave_type_id: CL, from_date: WED(), to_date: WED() }, MGR);
    expect(onOff.status).toBe(400);

    // a name can be corrected for someone with no login
    expect((await api.request('PUT', `/hr/staff/${made.body.id}`, { full_name: 'QA Cleaner Two' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', `/hr/staff/${made.body.id}`, undefined, MGR)).body.name).toBe('QA Cleaner Two');

    const { page } = await app.open(MGR, '/secure/hr');
    await expectShell(page);
    await page.getByTestId('hr-staff-add').click();
    await page.getByTestId('hr-f-nologin').check();
    await expect(page.getByTestId('hr-f-name')).toBeVisible();
    await expect(page.getByTestId('hr-f-user')).toHaveCount(0);
    await expect(page.getByTestId('hr-f-weeklyoff').locator('option')).toHaveCount(8);
  });

  test('HR-9 a part-timer has working days and hours on the staff record @edge', async ({ app, api }) => {
    const add = (b: any) => api.request('POST', '/hr/staff', { join_date: '2025-01-01', full_name: 'QA Parttimer', ...b }, MGR);
    expect((await add({ work_days: ['MONDAY'] })).status).toBe(400);                                   // full time by default
    expect((await add({ emp_type: 'PART_TIME', work_days: ['FUNDAY'] })).status).toBe(400);
    expect((await add({ emp_type: 'PART_TIME', work_start: '09:00' })).status).toBe(400);              // both times or neither
    expect((await add({ emp_type: 'PART_TIME', work_start: '13:00', work_end: '09:00' })).status).toBe(400);
    expect((await add({ emp_type: 'PART_TIME', work_start: '9am', work_end: '1pm' })).status).toBe(400);

    const made = await add({ emp_type: 'PART_TIME', work_days: ['MONDAY', 'TUESDAY', 'THURSDAY'], work_start: '09:00', work_end: '13:00' });
    expect(made.status).toBeLessThan(300);
    const got = (await api.request('GET', `/hr/staff/${made.body.id}`, undefined, MGR)).body;
    expect(got.work_days).toEqual(['MONDAY', 'TUESDAY', 'THURSDAY']);
    expect([got.work_start, got.work_end]).toEqual(['09:00', '13:00']);

    // Monday to Thursday, but Wednesday is not a working day: three days of leave
    const types = (await api.request('GET', '/hr/leave/types', undefined, MGR)).body;
    const CL = types.find((t: any) => t.code === 'CL').id;
    const ask = (from: string, to: string) => api.request('POST', '/hr/leave/requests', { employee_id: made.body.id, leave_type_id: CL, from_date: from, to_date: to }, MGR);
    const lv = await ask(MON(), THU());
    expect(lv.status).toBeLessThan(300);
    expect(lv.body.days).toBe(3);
    expect((await ask(WED(), WED())).status).toBe(400);                                                // not a working day

    // the grid carries the hours
    const grid = (await api.request('GET', `/hr/attendance?period=${P}`, undefined, MGR)).body;
    const me = grid.staff.find((r: any) => r.id === made.body.id);
    expect(me.work_start).toBe('09:00');

    // moving to full time clears the schedule; a schedule cannot be put back on a full-timer
    expect((await api.request('PUT', `/hr/staff/${made.body.id}`, { emp_type: 'FULL_TIME' }, MGR)).status).toBeLessThan(300);
    const ft = (await api.request('GET', `/hr/staff/${made.body.id}`, undefined, MGR)).body;
    expect(ft.work_days).toBeNull();
    expect(ft.work_start).toBeNull();
    expect((await api.request('PUT', `/hr/staff/${made.body.id}`, { work_start: '09:00', work_end: '13:00' }, MGR)).status).toBe(400);

    // the form shows the schedule only for part time
    const { page } = await app.open(MGR, '/secure/hr');
    await expectShell(page);
    await page.getByTestId('hr-staff-add').click();
    await expect(page.getByTestId('hr-sec-schedule')).toHaveCount(0);
    await page.locator('select').filter({ has: page.locator('option[value="PART_TIME"]') }).selectOption('PART_TIME');
    await expect(page.getByTestId('hr-sec-schedule')).toBeVisible();
    await expect(page.getByTestId('hr-f-wd-MONDAY')).toBeVisible();
  });

  test('HR-10 a login can be linked to a staff record later @edge', async ({ app, api }) => {
    const add = (b: any) => api.request('POST', '/hr/staff', { join_date: '2025-01-01', ...b }, MGR);
    const cands = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body;
    const cand = cands.find((c: any) => c.email === COUNTER);
    expect(cand).toBeTruthy();

    const a = await add({ full_name: 'QA Joiner One' });
    const b = await add({ full_name: 'QA Joiner Two' });
    const link = (id: number, user_id: any) => api.request('POST', `/hr/staff/${id}/login`, { user_id }, MGR);

    expect((await link(a.body.id, null)).status).toBe(400);                   // nothing chosen
    expect((await link(a.body.id, 99999999)).status).toBe(400);                // no such login
    // a base store outside the login's stores is refused at link time
    const outside = (await api.request('GET', '/hr/stores', undefined, MGR)).body.find((st: any) => !cand.stores.some((m: any) => m.id === st.id));
    if (outside) {
      const c = await add({ full_name: 'QA Joiner Three', store_id: outside.id });
      expect((await link(c.body.id, cand.id)).status).toBe(400);
    }

    expect((await link(a.body.id, cand.id)).status).toBeLessThan(300);
    const got = (await api.request('GET', `/hr/staff/${a.body.id}`, undefined, MGR)).body;
    expect(got.has_login).toBe(true);
    expect(got.email).toBe(COUNTER);
    expect(got.name).not.toBe('QA Joiner One');                                // the login's name takes over
    expect((await link(a.body.id, cand.id)).status).toBe(400);                 // already linked
    expect((await link(b.body.id, cand.id)).status).toBe(400);                 // the login is taken
    expect((await api.request('POST', `/hr/staff/${a.body.id}/login`, { user_id: cand.id }, STOREHEAD)).status).toBe(403);

    // the HR page offers the link on a record without a login
    const { page } = await app.open(MGR, '/secure/hr');
    await expectShell(page);
    await page.getByTestId('hr-staff-row').filter({ hasText: 'QA Joiner Two' }).click();
    await expect(page.getByTestId('hr-link-login')).toBeVisible();
    await expect(page.getByTestId('hr-link-save')).toBeDisabled();
  });

  test('HR-11 setup items are limited to roles, and bands are a set per role @edge', async ({ api }) => {
    await employee(api);
    const roles = (await api.request('GET', '/hr/roles', undefined, MGR)).body.map((r: any) => r.name);
    expect(roles).toEqual(expect.arrayContaining(['Business Head', 'Store Head', 'Sales Staff']));
    expect(roles).not.toContain('Site Admin');

    // a pay component for Store Heads cannot go on a Sales Staff salary
    expect((await api.request('POST', '/hr/components', { name: 'QA Bad Role', kind: 'EARNING', applies_roles: ['Nope'] }, MGR)).status).toBe(400);
    const sh = await api.request('POST', '/hr/components', { name: 'QA SH Allowance', kind: 'EARNING', applies_roles: ['Store Head'] }, MGR);
    expect(sh.status).toBeLessThan(300);
    const comps = (await api.request('GET', '/hr/components', undefined, MGR)).body;
    expect(comps.find((c: any) => c.id === sh.body.id).applies_roles).toEqual(['Store Head']);
    const rev = await api.request('POST', `/hr/staff/${empId}/revisions`, { effective_from: '2031-01-01', lines: [{ component_id: comp.BASIC, amount: 1000 }, { component_id: sh.body.id, amount: 10 }] }, MGR);
    expect(rev.status).toBe(400);
    expect(JSON.stringify(rev.body)).toContain('does not apply');

    // so is a leave type
    const lt = await api.request('POST', '/hr/leave/types', { name: 'QA SH Leave', paid: true, annual_days: 3, applies_roles: ['Store Head'] }, MGR);
    expect(lt.status).toBeLessThan(300);
    const ask = await api.request('POST', '/hr/leave/requests', { employee_id: empId, leave_type_id: lt.body.id, from_date: MON(), to_date: MON() }, MGR);
    expect(ask.status).toBe(400);
    expect((await api.request('GET', '/hr/leave/types', undefined, MGR)).body.find((t: any) => t.id === lt.body.id).applies_roles).toEqual(['Store Head']);

    // bands: a set for one role, the default for the rest
    expect((await api.request('PUT', '/hr/kpi/bands', { role_name: 'Bogus', bands: [{ min_percent: 0, label: 'x', incentive_percent: 0 }] }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/hr/kpi/bands', { role_name: 'Sales Staff', bands: [{ min_percent: 0, label: 'Low', incentive_percent: 0 }, { min_percent: 50, label: 'Own', incentive_percent: 7 }] }, MGR)).status).toBeLessThan(300);
    const bands = (await api.request('GET', '/hr/kpi/bands', undefined, MGR)).body;
    expect(bands.filter((b: any) => b.role_name === 'Sales Staff').length).toBe(2);
    expect(bands.filter((b: any) => !b.role_name).length).toBeGreaterThan(0);                  // the default set is untouched
  });

  test('HR-12 KPI: system measures, manager ratings, overrides, finalising, and the staff view @happy', async ({ api }) => {
    await employee(api);
    const metric = (b: any) => api.request('POST', '/hr/kpi/metrics', { max_points: 10, ...b }, MGR);
    // rules have to make sense for the measure
    expect((await metric({ name: 'QA no key', source: 'SYSTEM', rule: { kind: 'linear', target: 0, floor: 3 } })).status).toBe(400);
    expect((await metric({ name: 'QA steps on sales', source: 'SYSTEM', system_key: 'SALES_VALUE', rule: { kind: 'steps', steps: [{ upto: 1, pct: 100 }] } })).status).toBe(400);
    expect((await metric({ name: 'QA wrong way', source: 'SYSTEM', system_key: 'ABSENT_DAYS', rule: { kind: 'linear', target: 5, floor: 1 } })).status).toBe(400);
    expect((await metric({ name: 'QA steps down', source: 'SYSTEM', system_key: 'ABSENT_DAYS', rule: { kind: 'steps', steps: [{ upto: 2, pct: 50 }, { upto: 1, pct: 100 }] } })).status).toBe(400);
    expect((await metric({ name: 'QA scale', source: 'MANUAL', rating_scale: 1 })).status).toBe(400);

    // the earlier QA measures (HR-4) would otherwise wait for ratings
    for (const m of (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body.filter((x: any) => ['QA Service', 'QA Accuracy'].includes(x.name))) {
      await api.request('PUT', `/hr/kpi/metrics/${m.id}`, { name: m.name, max_points: m.max_points, active: false }, MGR);
    }
    const sys = await metric({ name: 'QA Absence', source: 'SYSTEM', system_key: 'ABSENT_DAYS', rule: { kind: 'steps', steps: [{ upto: 0, pct: 100 }, { upto: 2, pct: 50 }], otherwise: 0 }, applies_roles: ['Sales Staff'] });
    const man = await metric({ name: 'QA Housekeeping', source: 'MANUAL', rating_scale: 5, applies_roles: ['Sales Staff'] });
    const other = await metric({ name: 'QA SH Only', source: 'MANUAL', applies_roles: ['Store Head'] });
    for (const m of [sys, man, other]) expect(m.status).toBeLessThan(300);

    const day = `${Q}-12`;
    expect((await api.request('PUT', '/hr/attendance', { employee_id: empId, date: day, status: 'ABSENT' }, MGR)).status).toBeLessThan(300);

    const row = async () => (await api.request('GET', `/hr/kpi/month?period=${Q}`, undefined, MGR)).body.find((x: any) => x.employee_id === empId);
    let r = await row();
    const item = (name: string) => r.items.find((i: any) => i.name === name);
    expect(item('QA Absence')).toMatchObject({ source: 'SYSTEM', raw: 1, points: 5, state: 'SCORED' });      // one day absent: 50%
    expect(item('QA Housekeeping').state).toBe('PENDING');
    expect(item('QA SH Only')).toBeUndefined();                                                              // another role's measure
    expect(r.pending).toContain('QA Housekeeping');

    // ratings: managers only, within the scale, manual measures only
    const rate = (who: string, b: any) => api.request('PUT', '/kpi/rate', { employee_id: empId, period: Q, metric_id: man.body.id, ...b }, who);
    expect((await rate(COUNTER, { rating: 3 })).status).toBe(403);                                           // counter staff cannot rate
    expect((await rate(MGR, { rating: 6 })).status).toBe(400);
    expect((await rate(MGR, { rating: 3, metric_id: sys.body.id })).status).toBe(400);                       // system measure
    expect((await rate(MGR, { rating: 3, metric_id: other.body.id })).status).toBe(400);                     // does not apply
    expect((await api.request('GET', `/kpi/rate?period=${Q}`, undefined, COUNTER)).status).toBe(403);
    expect((await api.request('GET', `/kpi/rate?period=${Q}`, undefined, STOREHEAD)).status).toBe(200);

    // cannot finalise while a rating is missing, unless told to leave it out
    const miss = await api.request('POST', '/hr/kpi/finalise', { period: Q, employee_id: empId }, MGR);
    expect(miss.body.finalised).toBe(0);
    expect(JSON.stringify(miss.body.skipped)).toContain('QA Housekeeping');

    expect((await rate(MGR, { rating: 3, note: 'tidy most days' })).status).toBeLessThan(300);
    r = await row();
    expect(item('QA Housekeeping')).toMatchObject({ rating: 3, points: 6, state: 'SCORED', note: 'tidy most days' });

    // an override needs a reason and stays within the maximum
    const ov = (b: any) => api.request('POST', '/hr/kpi/override', { employee_id: empId, period: Q, metric_id: sys.body.id, ...b }, MGR);
    expect((await ov({ points: 8 })).status).toBe(400);
    expect((await ov({ points: 11, reason: 'x' })).status).toBe(400);
    expect((await ov({ points: 8, reason: 'covered a family emergency' })).status).toBeLessThan(300);
    r = await row();
    expect(item('QA Absence')).toMatchObject({ points: 5, override_points: 8, final_points: 8 });
    expect(r.draft.percent).toBe(70);

    // finalise: frozen, with the role's own band; then locked until reopened
    const fin = await api.request('POST', '/hr/kpi/finalise', { period: Q, employee_id: empId }, MGR);
    expect(fin.body.finalised).toBe(1);
    r = await row();
    expect(r).toMatchObject({ finalised: true, percent: 70, band_label: 'Own', incentive_percent: 7 });
    expect((await rate(MGR, { rating: 5 })).status).toBe(400);
    expect((await ov({ points: 9, reason: 'again' })).status).toBe(400);

    // the staff member sees it, with the evidence; nobody else's, and a login without a staff record sees nothing
    const mine = (await api.request('GET', '/kpi/mine', undefined, STAFF_EMAIL)).body;
    expect(mine.staff).toBe(true);
    const mo = mine.months.find((m: any) => m.period === Q);
    expect(mo.percent).toBe(70);
    expect(mo.scores.find((x: any) => x.name === 'QA Absence')).toMatchObject({ evidence: '1 day absent', overridden: true });
    expect((await api.request('GET', '/kpi/mine', undefined, STOREHEAD)).status).toBe(200);

    expect((await api.request('POST', '/hr/kpi/reopen', { period: Q, employee_id: empId }, MGR)).status).toBeLessThan(300);
    expect((await rate(MGR, { rating: 4 })).status).toBeLessThan(300);
    expect((await api.request('GET', '/kpi/mine', undefined, STAFF_EMAIL)).body.months.find((m: any) => m.period === Q)).toBeUndefined();   // no longer final
  });

  test('HR-13 pay components and leave types can be removed; ones already in use are made inactive @edge', async ({ api, app }) => {
    await employee(api);
    const comps = async () => (await api.request('GET', '/hr/components', undefined, MGR)).body;
    const types = async () => (await api.request('GET', '/hr/leave/types', undefined, MGR)).body;

    // never used: gone for good
    const c = await api.request('POST', '/hr/components', { name: 'QA Throwaway', kind: 'EARNING' }, MGR);
    expect((await api.request('DELETE', `/hr/components/${c.body.id}`, undefined, MGR)).body).toMatchObject({ removed: true });
    expect((await comps()).find((x: any) => x.id === c.body.id)).toBeUndefined();
    const t = await api.request('POST', '/hr/leave/types', { name: 'QA Throwaway', paid: true, annual_days: 1 }, MGR);
    expect((await api.request('DELETE', `/hr/leave/types/${t.body.id}`, undefined, MGR)).body).toMatchObject({ removed: true });
    expect((await types()).find((x: any) => x.id === t.body.id)).toBeUndefined();

    // in the salary / leave history: cannot be deleted, so it goes inactive
    const basic = (await comps()).find((x: any) => x.code === 'BASIC');
    const gone = await api.request('DELETE', `/hr/components/${basic.id}`, undefined, MGR);
    expect(gone.body).toMatchObject({ removed: false, deactivated: true });
    expect(gone.body.uses).toBeGreaterThan(0);
    expect((await comps()).find((x: any) => x.id === basic.id).active).toBe(false);
    await api.request('PUT', `/hr/components/${basic.id}`, { name: basic.name, kind: basic.kind, active: true }, MGR);   // put it back for the other specs
    const cl = (await types()).find((x: any) => x.code === 'CL');
    expect((await api.request('DELETE', `/hr/leave/types/${cl.id}`, undefined, MGR)).body).toMatchObject({ removed: false, deactivated: true });
    await api.request('PUT', `/hr/leave/types/${cl.id}`, { name: cl.name, paid: cl.paid, annual_days: cl.annual_days, active: true }, MGR);

    expect((await api.request('DELETE', '/hr/components/99999999', undefined, MGR)).status).toBe(404);
    expect((await api.request('DELETE', `/hr/components/${basic.id}`, undefined, 'storehead@local.test')).status).toBe(403);

    // the page offers it
    const { page } = await app.open(MGR, '/secure/hr/setup');
    await expect(page.getByTestId('hr-set-comp-row').first()).toBeVisible();
    await api.request('POST', '/hr/components', { name: 'QA Page Remove', kind: 'EARNING' }, MGR);
    await page.reload();
    const names = () => page.getByTestId('hr-set-comp-row').evaluateAll((rows: any[]) => rows.map(r => (r.querySelector('input') as HTMLInputElement).value));
    const idx = (await names()).indexOf('QA Page Remove');
    expect(idx).toBeGreaterThanOrEqual(0);
    await page.getByTestId('hr-set-comp-row').nth(idx).getByTestId('hr-set-comp-remove').click();
    await expect(page.getByTestId('hr-message')).toContainText('removed');
    await expect.poll(names).not.toContain('QA Page Remove');
  });
});
