/**
 * Customer inquiries — INQ-1..3
 * Recorded at the counter, assigned with a due date, closed with an outcome; closed and late ones feed the KPI measures.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const OTHER = 'sales2@local.test';

const today = () => new Date().toISOString().slice(0, 10);
const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const uid = async (api: any, email: string) => (await api.request('GET', '/auth/me', undefined, email)).body.id as number;

/** a store the counter user is mapped to */
async function counterStore(api: any) {
  const o = (await api.request('GET', '/inquiries/options', undefined, COUNTER)).body;
  expect(o.stores.length).toBeGreaterThan(0);
  return o.stores[0].id as number;
}

test.describe('Customer inquiries @p1', () => {
  test('INQ-1 record, validate, follow up and close an inquiry @happy', async ({ api }) => {
    const store = await counterStore(api);
    const raise = (b: any, who = COUNTER) => api.request('POST', '/inquiries', b, who);
    expect((await raise({ details: 'no store' })).status).toBe(400);
    expect((await raise({ store_id: store })).status).toBe(400);                                       // what was asked
    expect((await raise({ store_id: store, details: 'x', kind: 'NOPE' })).status).toBe(400);
    expect((await raise({ store_id: store, details: 'x', due_on: '2020-01-01' })).status).toBe(400);   // not in the past
    expect((await raise({ store_id: store, details: 'x', mobile: 'abc' })).status).toBe(400);
    expect((await raise({ store_id: store, details: 'x', assigned_to: (await uid(api, OTHER)) })).status).toBe(403);   // counter staff cannot hand it on

    const made = await raise({ store_id: store, kind: 'PRODUCT', product_text: 'QA Metformin 500 SR', details: 'Customer wants 3 strips, we are out', customer_name: 'QA Customer', mobile: '9876500099', due_on: days(2) });
    expect(made.status).toBeLessThan(300);
    const id = made.body.id;

    const mine = (await api.request('GET', '/inquiries?status=OPEN&mine=true', undefined, COUNTER)).body;
    expect(mine.find((r: any) => r.id === id)).toMatchObject({ status: 'OPEN', overdue: false, product_text: 'QA Metformin 500 SR' });
    expect((await api.request('GET', '/inquiries?status=OPEN', undefined, OTHER)).body.find((r: any) => r.id === id)).toBeUndefined();   // not theirs
    expect((await api.request('GET', '/inquiries?status=OPEN', undefined, MGR)).body.find((r: any) => r.id === id)).toBeTruthy();         // the Business Head sees all
    expect((await api.request('GET', '/inquiries/summary', undefined, COUNTER)).body.open).toBeGreaterThan(0);

    // someone else cannot close or change it
    expect((await api.request('POST', `/inquiries/${id}/close`, { outcome: 'ANSWERED' }, OTHER)).status).toBe(403);
    expect((await api.request('PUT', `/inquiries/${id}`, { details: 'hijack' }, OTHER)).status).toBe(403);
    expect((await api.request('PUT', `/inquiries/${id}`, { details: 'Customer wants 4 strips, we are out' }, COUNTER)).status).toBeLessThan(300);

    // closing needs an outcome, and a note for the endings that need an explanation
    const close = (b: any, who = COUNTER) => api.request('POST', `/inquiries/${id}/close`, b, who);
    expect((await close({})).status).toBe(400);
    expect((await close({ outcome: 'MAGIC' })).status).toBe(400);
    expect((await close({ outcome: 'NO_RESPONSE' })).status).toBe(400);
    expect((await close({ outcome: 'ORDERED', closing_note: 'ordered from the distributor, 2 days' })).status).toBeLessThan(300);
    expect((await close({ outcome: 'ORDERED' })).status).toBe(400);                                  // already closed
    expect((await api.request('PUT', `/inquiries/${id}`, { details: 'late edit' }, COUNTER)).status).toBe(400);
    const closed = (await api.request('GET', '/inquiries?status=CLOSED', undefined, COUNTER)).body.find((r: any) => r.id === id);
    expect(closed).toMatchObject({ status: 'CLOSED', outcome: 'ORDERED' });

    // only a manager reopens
    expect((await api.request('POST', `/inquiries/${id}/reopen`, {}, COUNTER)).status).toBe(403);
    expect((await api.request('POST', `/inquiries/${id}/reopen`, {}, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', '/inquiries?status=OPEN', undefined, COUNTER)).body.find((r: any) => r.id === id).status).toBe('OPEN');

    // a manager can hand it to someone mapped to the store
    const staff = (await api.request('GET', '/inquiries/options', undefined, MGR)).body.staff;
    expect(staff.length).toBeGreaterThan(0);
    expect((await api.request('POST', `/inquiries/${id}/assign`, { assigned_to: 99999999 }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/inquiries/${id}/assign`, { assigned_to: (await uid(api, COUNTER)) }, COUNTER)).status).toBe(403);
    await close({ outcome: 'DROPPED', closing_note: 'QA cleanup' });
  });

  test('INQ-2 closed and late inquiries feed the KPI @integration', async ({ api }) => {
    const store = await counterStore(api);
    const me = { id: await uid(api, COUNTER) };
    // the counter user needs a staff record for the KPI to find them
    const staff = (await api.request('GET', '/hr/staff', undefined, MGR)).body;
    let emp = staff.find((s: any) => s.email === COUNTER);
    if (!emp) {
      const created = await api.request('POST', '/hr/staff', { user_id: me.id, join_date: '2020-01-01' }, MGR);
      expect(created.status).toBeLessThan(300);
      emp = { id: created.body.id };
    }
    const closedM = await api.request('POST', '/hr/kpi/metrics', { name: 'QA Inquiries closed', max_points: 10, source: 'SYSTEM', system_key: 'INQUIRIES_CLOSED', rule: { kind: 'linear', target: 4, floor: 0 }, applies_roles: ['Sales Staff'] }, MGR);
    const lateM = await api.request('POST', '/hr/kpi/metrics', { name: 'QA Inquiries late', max_points: 10, source: 'SYSTEM', system_key: 'INQUIRIES_LATE', rule: { kind: 'steps', steps: [{ upto: 0, pct: 100 }, { upto: 1, pct: 50 }], otherwise: 0 }, applies_roles: ['Sales Staff'] }, MGR);
    expect(closedM.status).toBeLessThan(300);
    expect(lateM.status).toBeLessThan(300);

    const period = today().slice(0, 7);
    const figure = async (name: string) => (await api.request('GET', `/hr/kpi/month?period=${period}`, undefined, MGR)).body.find((r: any) => r.employee_id === emp.id).items.find((i: any) => i.name === name);
    const beforeClosed = (await figure('QA Inquiries closed')).raw as number;
    const beforeLate = (await figure('QA Inquiries late')).raw as number;

    // one closed on time, and the system sees it
    const a = await api.request('POST', '/inquiries', { store_id: store, details: 'QA on time', due_on: days(3) }, COUNTER);
    await api.request('POST', `/inquiries/${a.body.id}/close`, { outcome: 'ANSWERED' }, COUNTER);
    expect((await figure('QA Inquiries closed')).raw).toBe(beforeClosed + 1);
    expect((await figure('QA Inquiries closed')).points).toBeCloseTo(((beforeClosed + 1) / 4) * 10, 0);
    expect((await figure('QA Inquiries late')).raw).toBe(beforeLate);

    // one due today and closed today is not late; one closed by a manager after the fact still counts for the assignee only when they close it
    const b = await api.request('POST', '/inquiries', { store_id: store, details: 'QA due today', due_on: today() }, COUNTER);
    await api.request('POST', `/inquiries/${b.body.id}/close`, { outcome: 'SOLD' }, COUNTER);
    expect((await figure('QA Inquiries late')).raw).toBe(beforeLate);
    expect((await figure('QA Inquiries closed')).raw).toBe(beforeClosed + 2);
  });

  test('INQ-3 the Inquiries page: record and close at the counter @happy', async ({ app }) => {
    const { page } = await app.open(COUNTER, '/secure/inquiries');
    await expectShell(page);
    await expect(page.getByTestId('nav-inquiries')).toBeVisible();
    await page.getByTestId('inq-add').click();
    await expect(page.getByTestId('inq-form')).toBeVisible();
    const stores = page.getByTestId('inq-f-store');
    if (await stores.locator('option').count() > 1 && !(await stores.inputValue())) await stores.selectOption({ index: 1 });
    await page.getByTestId('inq-f-product').fill('QA Pantoprazole 40');
    await page.getByTestId('inq-f-details').fill('QA UI: asked for the 40 mg strip');
    await page.getByTestId('inq-save').click();
    await expect(page.getByTestId('inq-message')).toContainText('recorded');
    const row = page.getByTestId('inq-row').filter({ hasText: 'QA UI: asked for the 40 mg strip' });
    await expect(row).toBeVisible();

    await row.getByTestId('inq-close').click();
    await page.getByTestId('inq-c-outcome').selectOption('NOT_AVAILABLE');
    await page.getByTestId('inq-c-save').click();
    await expect(page.getByTestId('inq-message')).toContainText('closed');
    await page.getByTestId('inq-tab-closed').click();
    await expect(page.getByTestId('inq-row').filter({ hasText: 'QA UI: asked for the 40 mg strip' })).toContainText('Not available');

    // the KPI pages are in the menu for the people they are for
    await expect(page.getByTestId('nav-kpi-mine')).toBeVisible();
    await expect(page.getByTestId('nav-kpi-rate')).toHaveCount(0);
    const mgr = await app.open(MGR, '/secure/kpi/rate');
    await expectShell(mgr.page);
    await expect(mgr.page.getByTestId('nav-kpi-rate')).toBeVisible();
    await expect(mgr.page.getByTestId('kpi-period')).toBeVisible();
  });
});
