/**
 * Job roles with a pay structure (HR > Setup) - HRP-1..4
 * A job role holds the standard amount of each pay component. It is a template: a first salary starts from it, and changing it never changes a salary already given.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const NAME = 'QA Cashier';
const STAFF_EMAIL = 'sales2@local.test';

async function cleanup(api: any) {
  const list = (await api.request('GET', '/hr/positions', undefined, MGR)).body || [];
  for (const p of list.filter((x: any) => x.name.startsWith('QA '))) {
    await api.request('PUT', `/hr/staff/${(await staffId(api)) || 0}`, { position_id: null }, MGR).catch(() => null);
    await api.request('DELETE', `/hr/positions/${p.id}`, undefined, MGR);
  }
}
async function staffId(api: any) {
  const s = (await api.request('GET', '/hr/staff', undefined, MGR)).body || [];
  return s.find((x: any) => x.email === STAFF_EMAIL)?.id || 0;
}
async function comp(api: any, code: string) {
  const c = (await api.request('GET', '/hr/components', undefined, MGR)).body.find((x: any) => x.code === code);
  return c.id as number;
}

test('HRP-1 a job role holds a pay structure; it needs a name and an earning, and only the Business Head defines it', async ({ api }) => {
  await cleanup(api);
  const basic = await comp(api, 'BASIC');
  const fixed = await comp(api, 'FIXED_DED');
  expect((await api.request('GET', '/hr/positions', undefined, HEAD)).status).toBe(403);
  expect((await api.request('POST', '/hr/positions', { name: '', lines: [{ component_id: basic, amount: 100 }] }, MGR)).status).toBe(400);
  expect((await api.request('POST', '/hr/positions', { name: NAME, lines: [] }, MGR)).status).toBe(400);
  expect((await api.request('POST', '/hr/positions', { name: NAME, lines: [{ component_id: fixed, amount: 100 }] }, MGR)).status).toBe(400);
  expect((await api.request('POST', '/hr/positions', { name: NAME, lines: [{ component_id: 999999, amount: 100 }] }, MGR)).status).toBe(400);
  const ok = await api.request('POST', '/hr/positions', { name: NAME, lines: [{ component_id: basic, amount: 12000 }, { component_id: fixed, amount: 500 }, { component_id: basic, amount: 12500 }] }, MGR);
  expect(ok.status).toBe(201);
  expect((await api.request('POST', '/hr/positions', { name: NAME.toLowerCase(), lines: [{ component_id: basic, amount: 1 }] }, MGR)).status).toBe(400);
  const p = (await api.request('GET', '/hr/positions', undefined, MGR)).body.find((x: any) => x.name === NAME);
  expect(p.lines.find((l: any) => l.code === 'BASIC').amount).toBe(12500);
  expect(p.lines).toHaveLength(2);
  await cleanup(api);
});

test('HRP-2 a staff member holds a job role; a role in use cannot be deleted, only made inactive, and an inactive one is not offered', async ({ api }) => {
  await cleanup(api);
  const basic = await comp(api, 'BASIC');
  const id = (await api.request('POST', '/hr/positions', { name: NAME, lines: [{ component_id: basic, amount: 12000 }] }, MGR)).body.id;
  const sid = await staffId(api);
  test.skip(!sid, 'the QA staff member has no record');
  expect((await api.request('PUT', `/hr/staff/${sid}`, { position_id: 999999 }, MGR)).status).toBe(400);
  expect((await api.request('PUT', `/hr/staff/${sid}`, { position_id: id }, MGR)).status).toBe(200);
  expect((await api.request('GET', `/hr/staff/${sid}`, undefined, MGR)).body.position).toBe(NAME);
  const del = await api.request('DELETE', `/hr/positions/${id}`, undefined, MGR);
  expect(del.body).toMatchObject({ removed: false, deactivated: true });
  const other = (await api.request('POST', '/hr/positions', { name: 'QA Other', lines: [{ component_id: basic, amount: 1 }] }, MGR)).body.id;
  await api.request('PUT', `/hr/positions/${other}`, { name: 'QA Other', active: false, lines: [{ component_id: basic, amount: 1 }] }, MGR);
  expect((await api.request('PUT', `/hr/staff/${sid}`, { position_id: other }, MGR)).status).toBe(400);
  expect((await api.request('PUT', `/hr/staff/${sid}`, { position_id: id }, MGR)).status).toBe(200);   // keeping the one already held is fine
  await api.request('PUT', `/hr/staff/${sid}`, { position_id: null }, MGR);
  await cleanup(api);
});

test('HRP-3 the Setup screen adds a job role with amounts, shows its earnings, and removes it', async ({ app, api }) => {
  await cleanup(api);
  try {
    const { page } = await app.open(MGR, '/secure/hr/setup');
    await page.getByTestId('hr-sec-position-toggle').click();
    await page.getByTestId('hr-pos-new-name').fill(NAME);
    await page.getByTestId('hr-pos-new-amt-BASIC').fill('12000');
    await page.getByTestId('hr-pos-add').click();
    await expect(page.getByTestId('hr-message')).toContainText('Job role added');
    const row = page.getByTestId('hr-pos-row').filter({ has: page.locator(`input[data-testid="hr-pos-name"]`) }).filter({ hasText: 'earnings 12,000' });
    await expect(row).toHaveCount(1);
    await row.getByTestId('hr-pos-remove').click();
    await expect(page.getByTestId('hr-message')).toContainText('removed');
  } finally {
    await cleanup(api);
  }
});

test('HRP-4 a first salary starts from the job role, and changing the structure later leaves the salary alone', async ({ app, api }) => {
  await cleanup(api);
  const sid = await staffId(api);
  test.skip(!sid, 'the QA staff member has no record');
  const basic = await comp(api, 'BASIC');
  const id = (await api.request('POST', '/hr/positions', { name: NAME, lines: [{ component_id: basic, amount: 12000 }] }, MGR)).body.id;
  const before = (await api.request('GET', `/hr/staff/${sid}`, undefined, MGR)).body;
  try {
    await api.request('PUT', `/hr/staff/${sid}`, { position_id: id }, MGR);
    const { page } = await app.open(MGR, `/secure/hr/staff?staff=${sid}`);
    await page.getByTestId('hr-rev-add').click();
    await expect(page.getByTestId('hr-rev-structure')).toContainText(NAME);
    // the last revision of the QA staff member, if any, is kept; the button then fills from the structure
    await page.getByTestId('hr-rev-use-structure').click();
    await expect(page.getByTestId('hr-rev-BASIC')).toHaveValue('12000');
    await api.request('PUT', `/hr/positions/${id}`, { name: NAME, lines: [{ component_id: basic, amount: 20000 }] }, MGR);
    const after = (await api.request('GET', `/hr/staff/${sid}`, undefined, MGR)).body;
    expect(after.revisions).toEqual(before.revisions);
  } finally {
    await api.request('PUT', `/hr/staff/${sid}`, { position_id: null }, MGR);
    await cleanup(api);
  }
});
