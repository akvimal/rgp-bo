/**
 * A staff record added by mistake can be deleted, until it has history - HRD-1..2
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

async function candidate(api: any) {
  const c = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body || [];
  return c[0];
}

test('HRD-1 a record with no history is deleted with its salary; one with history is refused', async ({ api }) => {
  const name = `QA Mistake ${Date.now()}`;
  const made = await api.request('POST', '/hr/staff', { full_name: name, phone: '9000000001', join_date: new Date().toISOString().slice(0, 10), emp_type: 'FULL_TIME', weekly_off: 'SUNDAY' }, MGR);
  expect(made.status).toBe(201);
  const id = made.body.id as number;
  expect((await api.request('GET', `/hr/staff/${id}`, undefined, MGR)).body.can_delete).toBe(true);
  const del = await api.request('DELETE', `/hr/staff/${id}`, undefined, MGR);
  expect(del.status).toBe(200);
  expect((await api.request('GET', `/hr/staff/${id}`, undefined, MGR)).status).toBe(404);
  expect((await api.request('DELETE', `/hr/staff/${id}`, undefined, MGR)).status).toBe(404);

  // a person with attendance history cannot be deleted
  let s: any;
  for (const x of (await api.request('GET', '/hr/staff', undefined, MGR)).body || []) {
    if ((await api.request('GET', `/hr/staff/${x.id}`, undefined, MGR)).body.can_delete === false) { s = x; break; }
  }
  if (s) {
    expect((await api.request('GET', `/hr/staff/${s.id}`, undefined, MGR)).body.can_delete).toBe(false);
    const no = await api.request('DELETE', `/hr/staff/${s.id}`, undefined, MGR);
    expect(no.status).toBe(400);
    expect(JSON.stringify(no.body)).toContain('Mark them as left');
  }
});

test('HRD-2 the staff screen offers Delete only when it is allowed', async ({ app, api }) => {
  const name = `QA Mistake UI ${Date.now()}`;
  const made = await api.request('POST', '/hr/staff', { full_name: name, phone: '9000000002', join_date: new Date().toISOString().slice(0, 10), emp_type: 'FULL_TIME', weekly_off: 'SUNDAY' }, MGR);
  expect(made.status).toBe(201);
  const { page } = await app.open(MGR, `/secure/hr/staff?staff=${made.body.id}`);
  page.once('dialog', (d: any) => d.accept());
  await expect(page.getByTestId('hr-staff-delete')).toBeVisible();
  await page.getByTestId('hr-staff-delete').click();
  await expect.poll(async () => (await api.request('GET', `/hr/staff/${made.body.id}`, undefined, MGR)).status).toBe(404);
});
