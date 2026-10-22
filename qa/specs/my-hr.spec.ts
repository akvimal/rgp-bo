/**
 * My HR — MYHR-1..3
 * A staff member sees only their own HR: details, released pay slips, leave (and can apply), attendance, staff credit.
 * The Business Head and the Store Head of the person's store decide leave; nobody decides their own.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';
const COUNTER = 'sales1@local.test';
const STAFF = 'sales2@local.test';          // given a staff record, a salary and an approved payroll by the HR specs
const PASS = process.env.QA_ADMIN_PASS || 'admin123';

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** a working day (not a Sunday) this many days ahead */
function workday(ahead: number) {
  const d = new Date(Date.now() + ahead * 86400000);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

async function makeUser(api: any, storeIds: number[], tag: string) {
  const email = `qa.mh${tag}.${Date.now()}@local.test`;   // short: the email column is narrow
  const r = await api.request('POST', '/users', { fullname: `QA MyHR ${tag}`, email, password: PASS, phone: '9000008888', location: 'x', roleid: 2, storeids: storeIds }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return email;
}

async function makeStaff(api: any, email: string) {
  const cand = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body.find((c: any) => c.email === email);
  expect(cand).toBeTruthy();
  const r = await api.request('POST', '/hr/staff', { user_id: cand.id, join_date: '2020-01-01', designation: 'QA staff' }, MGR);
  expect(r.status).toBeLessThan(300);
  return r.body.id as number;
}

const storeOf = async (api: any, who: string) => (await api.request('GET', '/stores/context', undefined, who)).body.stores.map((s: any) => s.id) as number[];

test.describe('My HR @p1', () => {
  test('MYHR-1 a person sees only their own details, released pay slips, leave, attendance and credit @happy', async ({ api }) => {
    // no staff record: nothing to show, nothing to do
    const stray = await makeUser(api, [(await storeOf(api, STOREHEAD))[0]], 'nostaff');
    expect((await api.request('GET', '/my-hr/summary', undefined, stray)).body.staff).toBe(false);
    expect((await api.request('GET', '/my-hr/payslips', undefined, stray)).body.rows).toEqual([]);
    expect((await api.request('POST', '/my-hr/leave', { leave_type_id: 1, from_date: workday(10), to_date: workday(10) }, stray)).status).toBe(404);

    const sum = (await api.request('GET', '/my-hr/summary', undefined, STAFF)).body;
    test.skip(!sum.staff, 'the HR specs have not given this login a staff record');
    expect(sum.credit).toHaveProperty('outstanding');

    // details: bank / PAN / Aadhaar come back in part only; address and emergency contact can be changed
    const prof = (await api.request('GET', '/my-hr/profile', undefined, STAFF)).body;
    expect(prof.emp_code).toBeTruthy();
    if (prof.account_no) { expect(prof.account_no).toMatch(/^X+\d{4}$/); expect(prof.account_no).not.toContain('1234567890'); }
    if (prof.pan) expect(prof.pan).not.toContain('ABCDE');
    expect(prof).not.toHaveProperty('aadhaar_last4');
    expect((await api.request('PUT', '/my-hr/profile', { address: 'x', emergency_phone: 'call me' }, STAFF)).status).toBe(400);
    expect((await api.request('PUT', '/my-hr/profile', { address: 'QA Street 1', emergency_name: 'QA Relative', emergency_phone: '9876500055' }, STAFF)).status).toBeLessThan(300);
    expect((await api.request('GET', '/my-hr/profile', undefined, STAFF)).body).toMatchObject({ address: 'QA Street 1', emergency_name: 'QA Relative' });

    // pay slips: only approved months, only their own
    const slips = (await api.request('GET', '/my-hr/payslips', undefined, STAFF)).body.rows;
    for (const s of slips) {
      const one = (await api.request('GET', `/my-hr/payslips/${s.id}`, undefined, STAFF)).body;
      expect(one.net).toBeCloseTo(s.net, 2);
      expect(one.account_no === null || /^X+\d{4}$/.test(one.account_no)).toBe(true);
    }
    expect((await api.request('GET', '/my-hr/payslips/99999999', undefined, STAFF)).status).toBe(404);
    const lineOfSomeoneElse = (await api.request('GET', `/hr/payroll/${slips[0]?.period ?? '2000-01'}`, undefined, MGR)).body?.lines?.find((l: any) => !slips.some((s: any) => s.id === l.id));
    if (lineOfSomeoneElse) expect((await api.request('GET', `/my-hr/payslips/${lineOfSomeoneElse.id}`, undefined, STAFF)).status).toBe(404);

    // attendance and credit come from their own record
    const att = (await api.request('GET', `/my-hr/attendance?period=${iso(new Date()).slice(0, 7)}`, undefined, STAFF)).body;
    expect(att.staff).toBe(true);
    expect(att.me).toBeTruthy();
    expect(att.totals).toHaveProperty('present');
    const cr = (await api.request('GET', '/my-hr/credit', undefined, STAFF)).body;
    expect(typeof cr.outstanding).toBe('number');
    expect(Array.isArray(cr.rows)).toBe(true);

    // leave: balance, apply, no clash, withdraw
    const ov = (await api.request('GET', '/my-hr/leave', undefined, STAFF)).body;
    expect(ov.types.length).toBeGreaterThan(0);
    const type = ov.types.find((t: any) => t.paid) || ov.types[0];
    const apply = (b: any) => api.request('POST', '/my-hr/leave', { leave_type_id: type.id, ...b }, STAFF);
    expect((await apply({ from_date: iso(new Date(Date.now() - 30 * 86400000)), to_date: iso(new Date(Date.now() - 30 * 86400000)) })).status).toBe(400);   // too far back
    expect((await apply({ from_date: workday(20), to_date: workday(19) })).status).toBe(400);
    const d = workday(40);
    const made = await apply({ from_date: d, to_date: d, reason: 'QA family event' });
    expect(made.status).toBeLessThan(300);
    expect(made.body.days).toBe(1);
    expect((await apply({ from_date: d, to_date: d })).status).toBe(400);                                       // already asked for
    expect((await api.request('GET', '/my-hr/leave', undefined, STAFF)).body.requests.some((r: any) => r.id === made.body.id && r.status === 'PENDING')).toBe(true);
    expect((await api.request('POST', `/my-hr/leave/${made.body.id}/cancel`, {}, COUNTER)).status).toBe(404);   // not someone else's to withdraw
    expect((await api.request('POST', `/my-hr/leave/${made.body.id}/cancel`, {}, STAFF)).status).toBeLessThan(300);
    expect((await api.request('POST', `/my-hr/leave/${made.body.id}/cancel`, {}, STAFF)).status).toBe(400);     // already withdrawn
  });

  test('MYHR-2 leave goes to the Business Head or the Store Head of the person\'s store, never their own @integration', async ({ api }) => {
    const headStores = await storeOf(api, STOREHEAD);
    const allStores = await storeOf(api, MGR);
    const mine = await makeUser(api, [headStores[0]], 'mine');
    await makeStaff(api, mine);
    const d = workday(50);
    const asked = await api.request('POST', '/my-hr/leave', { leave_type_id: (await api.request('GET', '/my-hr/leave', undefined, mine)).body.types[0].id, from_date: d, to_date: d, reason: 'QA trip' }, mine);
    expect(asked.status).toBeLessThan(300);
    const id = asked.body.id;

    // the Store Head sees it; a counter user cannot reach the inbox; the staff member cannot decide it
    const inbox = (await api.request('GET', '/leave-approvals', undefined, STOREHEAD)).body;
    expect(inbox.find((r: any) => r.id === id)).toMatchObject({ status: 'PENDING', days: 1 });
    expect((await api.request('GET', '/leave-approvals/count', undefined, STOREHEAD)).body.n).toBeGreaterThan(0);
    expect((await api.request('GET', '/leave-approvals', undefined, COUNTER)).status).toBe(403);
    expect((await api.request('POST', `/leave-approvals/${id}/decision`, { action: 'approve' }, mine)).status).toBe(403);

    // staff of another store are not the Store Head's to decide
    const elsewhere = allStores.find(s => !headStores.includes(s));
    if (elsewhere) {
      const far = await makeUser(api, [elsewhere], 'far');
      await makeStaff(api, far);
      const farAsk = await api.request('POST', '/my-hr/leave', { leave_type_id: (await api.request('GET', '/my-hr/leave', undefined, far)).body.types[0].id, from_date: d, to_date: d }, far);
      expect((await api.request('GET', '/leave-approvals', undefined, STOREHEAD)).body.some((r: any) => r.id === farAsk.body.id)).toBe(false);
      expect((await api.request('POST', `/leave-approvals/${farAsk.body.id}/decision`, { action: 'approve' }, STOREHEAD)).status).toBe(403);
      expect((await api.request('GET', '/leave-approvals', undefined, MGR)).body.some((r: any) => r.id === farAsk.body.id)).toBe(true);   // the Business Head sees all
    }

    // declining needs a reason; approving shows to the person, and they can no longer withdraw it
    expect((await api.request('POST', `/leave-approvals/${id}/decision`, { action: 'reject' }, STOREHEAD)).status).toBe(400);
    expect((await api.request('POST', `/leave-approvals/${id}/decision`, { action: 'approve', note: 'enjoy' }, STOREHEAD)).status).toBeLessThan(300);
    const after = (await api.request('GET', '/my-hr/leave', undefined, mine)).body.requests.find((r: any) => r.id === id);
    expect(after).toMatchObject({ status: 'APPROVED', decision_note: 'enjoy' });
    expect((await api.request('GET', '/my-hr/summary', undefined, mine)).body.recentDecisions.some((r: any) => r.id === id)).toBe(true);
    expect((await api.request('POST', `/my-hr/leave/${id}/cancel`, {}, mine)).status).toBe(400);
    expect((await api.request('GET', '/leave-approvals?status=APPROVED', undefined, STOREHEAD)).body.some((r: any) => r.id === id)).toBe(true);
  });

  test('MYHR-3 the My HR page and the leave inbox in the menu @happy', async ({ app, api }) => {
    const mine = await makeUser(api, [(await storeOf(api, STOREHEAD))[0]], 'ui');
    await makeStaff(api, mine);

    const { page } = await app.open(mine, '/secure/my-hr');
    await expectShell(page);
    await expect(page.getByTestId('nav-my-hr')).toBeVisible();
    await expect(page.getByTestId('nav-leave-approvals')).toHaveCount(0);
    await expect(page.getByTestId('myhr-home')).toBeVisible();
    await page.getByTestId('myhr-tab-profile').click();
    await expect(page.getByTestId('myhr-profile')).toContainText('QA staff');
    await page.getByTestId('myhr-tab-payslips').click();
    await expect(page.getByTestId('myhr-noslips')).toBeVisible();                   // nothing released for a new person
    await page.getByTestId('myhr-tab-leave').click();
    await page.getByTestId('myhr-leave-apply').click();
    await page.getByTestId('myhr-l-type').selectOption({ index: 1 });
    await page.getByTestId('myhr-l-from').fill(workday(60));
    await page.getByTestId('myhr-l-to').fill(workday(60));
    await page.getByTestId('myhr-l-reason').fill('QA from the page');
    await page.getByTestId('myhr-l-send').click();
    await expect(page.getByTestId('myhr-message')).toContainText('Asked for');
    const row = page.getByTestId('myhr-request').first();
    await expect(row).toHaveAttribute('data-status', 'PENDING');
    await row.getByTestId('myhr-withdraw').click();
    await expect(page.getByTestId('myhr-message')).toContainText('withdrawn');
    await page.getByTestId('myhr-tab-attendance').click();
    await expect(page.getByTestId('myhr-attendance')).toBeVisible();
    await page.getByTestId('myhr-tab-credit').click();
    await expect(page.getByTestId('myhr-owed')).toBeVisible();

    const sh = await app.open(STOREHEAD, '/secure/leave-approvals');
    await expectShell(sh.page);
    await expect(sh.page.getByTestId('nav-leave-approvals')).toBeVisible();
    await expect(sh.page.getByTestId('la-tab-pending')).toBeVisible();
    const cn = await app.open(COUNTER, '/secure/dashboard');
    await expect(cn.page.getByTestId('nav-leave-approvals')).toHaveCount(0);
  });
});
