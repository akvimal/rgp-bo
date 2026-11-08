/**
 * Attendance by PIN and webcam photo on a registered store PC, its manager review, the payroll hold and the Rules tab — ATT-1..10.
 * The punch screen runs in Chromium with a fake webcam. The specs run in order: ATT-2 sets up the two staff, the store PC and their PINs.
 * One In and one Out a day per person is the rule, so re-running on the same day needs a fresh seed.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['camera'] });

const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';        // opens the punch screen on the store PC (has attendpunch.use)
const WORKER_A = 'sales1@local.test';             // punches through the API
const WORKER_B = 'sales2@local.test';             // punches through the screen, with a photo

/** a month well in the past, never the ones the HR specs use */
const R = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 5); return d.toISOString().slice(0, 7); })();

const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6000, 7)]).toString('base64');

const ids: Record<string, number> = {};
const pins: Record<string, string> = {};
let deviceToken = '';

/** a call with the store PC's secret (the shared api helper has no custom headers) */
async function call(api: any, method: string, path: string, body: unknown, email: string, device = true) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await api.token(email)}`, ...(device && deviceToken ? { 'x-device-token': deviceToken } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, body: parsed };
}

async function staffRecord(api: any, email: string): Promise<number> {
  const list = (await api.request('GET', '/hr/staff', undefined, MGR)).body;
  const found = list.find((s: any) => s.email === email);
  if (found) return found.id;
  const cand = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body;
  const user = cand.find((c: any) => c.email === email);
  expect(user, `${email} can be added to HR`).toBeTruthy();
  const add = await api.request('POST', '/hr/staff', { user_id: user.id, join_date: '2020-01-01', designation: 'Pharmacy assistant', weekly_off: 'SUNDAY' }, MGR);
  expect(add.status).toBeLessThan(300);
  return (await api.request('GET', '/hr/staff', undefined, MGR)).body.find((s: any) => s.email === email).id;
}

const storeId = () => { try { return data.storesOf(1)[0].id; } catch { return 1; } };

test.describe.configure({ mode: 'serial' });

test.describe('Attendance punch and review @p1', () => {
  test('ATT-1 the punch screen needs a registered store PC, and the review needs its own permission @negative', async ({ api }) => {
    // a login without the store PC's secret is refused
    expect((await call(api, 'GET', '/punch/staff', undefined, STOREHEAD, false)).status).toBe(403);
    expect((await call(api, 'POST', '/punch', { employee_id: 1, pin: '1234', photo: jpeg }, STOREHEAD, false)).status).toBe(403);
    // a sales login has neither the punch screen nor the review
    expect((await call(api, 'GET', '/punch/staff', undefined, WORKER_A, false)).status).toBe(403);
    expect((await api.request('GET', '/attendance-review', undefined, WORKER_A)).status).toBe(403);
    expect((await api.request('GET', '/attendance-review/rules', undefined, WORKER_A)).status).toBe(403);
    expect((await api.request('PUT', '/attendance-review/people/1/pin', {}, WORKER_A)).status).toBe(403);
    expect((await api.request('GET', '/attendance-review', undefined, MGR)).status).toBe(200);
  });

  test('ATT-2 the manager adds two staff, gives each a PIN and registers the store PC @happy', async ({ api }) => {
    ids.a = await staffRecord(api, WORKER_A);
    ids.b = await staffRecord(api, WORKER_B);
    for (const [k, id] of [['a', ids.a], ['b', ids.b]] as const) {
      const r = await api.request('PUT', `/attendance-review/people/${id}/pin`, { generate: true }, MGR);
      expect(r.status).toBeLessThan(300);
      expect(r.body.pin).toMatch(/^\d{4}$/);
      pins[k] = r.body.pin;
    }
    const reg = await api.request('POST', '/auth/device/register', { name: 'ATT QA PC ' + Date.now() % 100000, storeid: storeId() }, MGR);
    expect(reg.status).toBeLessThan(300);
    deviceToken = reg.body.token;
    expect(deviceToken).toBeTruthy();
    const staff = await call(api, 'GET', '/punch/staff', undefined, STOREHEAD);
    expect(staff.status).toBe(200);
    for (const id of [ids.a, ids.b]) expect(staff.body.staff.find((s: any) => s.id === id)).toBeTruthy();
  });

  test('ATT-3 a wrong PIN, a tiny photo and five tries lock a person out until the manager unlocks them @negative', async ({ api }) => {
    const wrong = pins.a === '1111' ? '2222' : '1111';
    expect((await call(api, 'POST', '/punch', { employee_id: ids.a, pin: pins.a, photo: 'data:image/jpeg;base64,AAAA' }, STOREHEAD)).status).toBe(400);   // photo too small
    expect((await call(api, 'POST', '/punch', { employee_id: ids.a, pin: '12', photo: jpeg }, STOREHEAD)).status).toBe(400);                                // not a PIN
    let last = 0;
    for (let i = 0; i < 5; i++) last = (await call(api, 'POST', '/punch', { employee_id: ids.a, pin: wrong, photo: jpeg }, STOREHEAD)).status;
    expect(last).toBeGreaterThanOrEqual(400);
    // even the right PIN is refused while locked
    const locked = await call(api, 'POST', '/punch', { employee_id: ids.a, pin: pins.a, photo: jpeg }, STOREHEAD);
    expect(locked.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(locked.body)).toMatch(/lock|minute|wait|too many/i);
    // the manager unlocks with a new PIN
    const fresh = await api.request('PUT', `/attendance-review/people/${ids.a}/pin`, { generate: true }, MGR);
    expect(fresh.status).toBeLessThan(300);
    pins.a = fresh.body.pin;
  });

  test('ATT-4 In is recorded once, a second tap is ignored, and the day waits for review @happy', async ({ api }) => {
    const inn = await call(api, 'POST', '/punch', { employee_id: ids.a, pin: pins.a, photo: jpeg }, STOREHEAD);
    expect(inn.status, JSON.stringify(inn.body)).toBeLessThan(300);
    const again = await call(api, 'POST', '/punch', { employee_id: ids.a, pin: pins.a, photo: jpeg }, STOREHEAD);
    expect(again.status).toBeGreaterThanOrEqual(400);                               // a double tap inside the minute
    const staff = (await call(api, 'GET', '/punch/staff', undefined, STOREHEAD)).body.staff.find((s: any) => s.id === ids.a);
    expect(staff.state).toBe('IN');
    const today = (await api.request('GET', '/attendance-review?status=all', undefined, MGR)).body;
    const row = today.items.find((i: any) => i.employee_id === ids.a && i.type === 'TODAY');
    expect(row, 'today shows, not yet due for review').toBeTruthy();
    expect(row.punches.length).toBe(1);
  });

  test('ATT-5 the counter punches in on the screen, and a webcam photo is taken @happy', async ({ app, api, context }) => {
    await context.addInitScript((t) => { try { localStorage.setItem('rgp_device', t as string); } catch { /* none */ } }, deviceToken);
    const { page } = await app.open(STOREHEAD, '/secure/attendance-punch');
    await expectShell(page);
    const name = (await call(api, 'GET', '/punch/staff', undefined, STOREHEAD)).body.staff.find((s: any) => s.id === ids.b).name;
    await page.getByTestId('ap-staff').filter({ hasText: name }).click();
    await expect(page.getByTestId('ap-camerror')).toHaveCount(0);
    await page.getByTestId('ap-pin').fill(pins.b);
    await page.getByTestId('ap-submit').click();
    await expect(page.getByTestId('ap-done')).toBeVisible({ timeout: 15_000 });
    const staff = (await call(api, 'GET', '/punch/staff', undefined, STOREHEAD)).body.staff.find((s: any) => s.id === ids.b);
    expect(staff.state).toBe('IN');
  });

  test('ATT-6 the manager sees the photo, and only a reviewer can fetch one @happy', async ({ app, api }) => {
    const { page } = await app.open(MGR, '/secure/attendance-review');
    await expectShell(page);
    await page.getByTestId('ar-status').selectOption('all');                        // regression: the filter applies at once
    await expect(page.getByTestId('ar-photos').first()).toBeVisible({ timeout: 15_000 });
    const mine = page.locator(`[data-testid=ar-item][data-emp="${ids.b}"]`).first();
    await expect(mine).toBeVisible();
    await mine.getByTestId('ar-photos').click();
    const img = mine.getByTestId('ar-photo').first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 10_000 }).toBeGreaterThan(0);   // regression: blocked blob URL
    // the photo's route is guarded
    const today = (await api.request('GET', '/attendance-review?status=all', undefined, MGR)).body;
    const punchId = today.items.find((i: any) => i.employee_id === ids.b).punches[0].id;
    expect((await api.request('GET', `/attendance-review/photo/${punchId}`, undefined, WORKER_A)).status).toBe(403);
    expect((await fetch(`${API}/attendance-review/photo/${punchId}`)).status).toBe(401);
    expect((await api.request('GET', `/attendance-review/photo/${punchId}`, undefined, MGR)).status).toBe(200);
  });

  test('ATT-7 a day is changed only with a reason, a real status and times in order @negative', async ({ api }) => {
    const day = (n: number) => `${R}-${String(n).padStart(2, '0')}`;
    // a change needs a reason and a real status
    expect((await api.request('POST', '/attendance-review/day', { employee_id: ids.a, date: day(3), action: 'SET', status: 'PRESENT' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/attendance-review/day', { employee_id: ids.a, date: day(3), action: 'SET', status: 'WALKED', note: 'cover for a colleague' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/attendance-review/day', { employee_id: ids.a, date: '2999-01-01', action: 'SET', status: 'PRESENT', note: 'future day' }, MGR)).status).toBe(400);
    // nothing to approve on a day with no punch
    expect((await api.request('POST', '/attendance-review/day', { employee_id: ids.a, date: day(3), action: 'APPROVE' }, MGR)).status).toBe(400);
    const ok = await api.request('POST', '/attendance-review/day', { employee_id: ids.a, date: day(3), action: 'SET', status: 'PRESENT', check_in: '09:00', check_out: '18:00', note: 'was at the counter' }, MGR);
    expect(ok.status).toBeLessThan(300);
    // out before in is refused
    expect((await api.request('POST', '/attendance-review/day', { employee_id: ids.a, date: day(4), action: 'SET', status: 'PRESENT', check_in: '18:00', check_out: '09:00', note: 'wrong way round' }, MGR)).status).toBe(400);
  });

  test('ATT-8 days nobody has reviewed hold the month back, the payroll page says whose, and clearing them frees it @happy', async ({ app, api }) => {
    // the month holds back while these two have working days with no punch and no review
    const hold = (await api.request('GET', `/hr/payroll/${R}/attendance-hold`, undefined, MGR)).body;
    expect(hold.days).toBeGreaterThan(0);
    const names = hold.people.map((p: any) => p.employee_id);
    expect(names).toEqual(expect.arrayContaining([ids.a, ids.b]));
    expect((await api.request('POST', `/hr/payroll/${R}/generate`, {}, MGR)).status).toBe(400);
    expect((await api.request('GET', `/hr/payroll/${R}/attendance-hold`, undefined, STOREHEAD)).status).toBe(403);

    const { page } = await app.open(MGR, '/secure/hr/payroll');
    await expectShell(page);
    await page.getByTestId('hr-pay-period').fill(R);
    await page.getByTestId('hr-pay-period').dispatchEvent('change');
    await expect(page.getByTestId('hr-pay-hold')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('hr-pay-generate')).toBeDisabled();
    await page.getByTestId('hr-pay-hold-link').click();
    await expect(page).toHaveURL(new RegExp(`attendance-review\\?period=${R}`));        // regression: a query string must not bounce to the login
    await expect(page.getByTestId('ar-period')).toHaveValue(R);

    // clear every open day of the two people
    for (const empId of [ids.a, ids.b]) {
      const items = (await api.request('GET', `/attendance-review?period=${R}&status=pending`, undefined, MGR)).body.items.filter((i: any) => i.employee_id === empId);
      for (const i of items) {
        const r = await api.request('POST', '/attendance-review/day', { employee_id: empId, date: i.date, action: 'SET', status: 'PRESENT', note: 'QA: reviewed' }, MGR);
        expect(r.status, `${i.date}: ${JSON.stringify(r.body)}`).toBeLessThan(300);
      }
    }
    const after = (await api.request('GET', `/hr/payroll/${R}/attendance-hold`, undefined, MGR)).body;
    expect(after.people.map((p: any) => p.employee_id)).not.toEqual(expect.arrayContaining([ids.a]));
    expect(after.people.map((p: any) => p.employee_id)).not.toEqual(expect.arrayContaining([ids.b]));
  });

  test('ATT-9 the Rules tab keeps the photo days and grace minutes within limits, and only the Business Head changes them @negative', async ({ api }) => {
    const rules = (await api.request('GET', '/attendance-review/rules', undefined, STOREHEAD)).body;
    expect(rules.can_edit).toBe(false);
    expect((await api.request('PUT', '/attendance-review/rules', { photo_days: 30, grace_minutes: 5 }, STOREHEAD)).status).toBe(403);
    for (const bad of [{ photo_days: 3, grace_minutes: 5 }, { photo_days: 400, grace_minutes: 5 }, { photo_days: 30, grace_minutes: -1 }, { photo_days: 30, grace_minutes: 61 }, { photo_days: 30.5, grace_minutes: 5 }, { photo_days: 'x', grace_minutes: 5 }]) {
      expect((await api.request('PUT', '/attendance-review/rules', bad, MGR)).status, JSON.stringify(bad)).toBe(400);
    }
    const mine = (await api.request('GET', '/attendance-review/rules', undefined, MGR)).body;
    expect(mine.can_edit).toBe(true);
    try {
      const saved = await api.request('PUT', '/attendance-review/rules', { photo_days: 45, grace_minutes: 5 }, MGR);
      expect(saved.status).toBeLessThan(300);
      const back = (await api.request('GET', '/attendance-review/rules', undefined, MGR)).body;
      expect([back.photo_days, back.grace_minutes]).toEqual([45, 5]);
    } finally {
      await api.request('PUT', '/attendance-review/rules', { photo_days: mine.photo_days, grace_minutes: mine.grace_minutes }, MGR);
    }
  });

  test('ATT-10 the Rules tab saves from the screen and a refused value shows its limits @happy', async ({ app, api }) => {
    const before = (await api.request('GET', '/attendance-review/rules', undefined, MGR)).body;
    const { page } = await app.open(MGR, '/secure/attendance-review');
    await expectShell(page);
    await page.getByTestId('ar-tab-rules').click();
    await expect(page.getByTestId('ar-rule-photo')).toBeVisible();
    await page.getByTestId('ar-rule-photo').fill('3');
    await page.getByTestId('ar-rule-save').click();
    await expect(page.getByTestId('ar-error')).toContainText('7 to 365');
    await page.getByTestId('ar-rule-photo').fill('50');
    await page.getByTestId('ar-rule-grace').fill('7');
    await page.getByTestId('ar-rule-save').click();
    await expect(page.getByTestId('ar-message')).toBeVisible();
    const now = (await api.request('GET', '/attendance-review/rules', undefined, MGR)).body;
    expect([now.photo_days, now.grace_minutes]).toEqual([50, 7]);
    await api.request('PUT', '/attendance-review/rules', { photo_days: before.photo_days, grace_minutes: before.grace_minutes }, MGR);
  });
});
