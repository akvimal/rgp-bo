/**
 * Job roles drive KPI and incentive, and hint at the login role - HRL-1..4
 * A KPI measure and an incentive band set can be for a job role; a person gets their job role's set, else their login role's, else the default.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STAFF_EMAIL = 'sales2@local.test';
const A = 'QA Link A';
const B = 'QA Link B';
const MEASURE = 'QA Link measure';
/** a past month, so nothing here touches the current payroll */
const P = (() => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 4); return d.toISOString().slice(0, 7); })();

async function staff(api: any) {
  const s = (await api.request('GET', '/hr/staff', undefined, MGR)).body || [];
  return s.find((x: any) => x.email === STAFF_EMAIL);
}
async function basicId(api: any) {
  return (await api.request('GET', '/hr/components', undefined, MGR)).body.find((c: any) => c.code === 'BASIC').id as number;
}
async function cleanup(api: any) {
  const s = await staff(api);
  if (s) await api.request('PUT', `/hr/staff/${s.id}`, { position_id: null }, MGR);
  const ms = (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body || [];
  for (const m of ms.filter((x: any) => x.name === MEASURE)) {
    await api.request('PUT', `/hr/kpi/metrics/${m.id}`, { name: m.name, max_points: m.max_points, source: 'MANUAL', rating_scale: 5, active: false }, MGR);
  }
  const ps = (await api.request('GET', '/hr/positions', undefined, MGR)).body || [];
  for (const p of ps.filter((x: any) => x.name.startsWith('QA Link'))) await api.request('DELETE', `/hr/positions/${p.id}`, undefined, MGR);
}
const mk = async (api: any, name: string, login_role?: string) =>
  (await api.request('POST', '/hr/positions', { name, login_role: login_role ?? null, lines: [{ component_id: await basicId(api), amount: 1000 }] }, MGR)).body.id as number;
const month = async (api: any, id: number) => (await api.request('GET', `/hr/kpi/month?period=${P}`, undefined, MGR)).body.find((r: any) => r.employee_id === id);

test('HRL-1 a KPI measure for a job role applies only to the people who hold it', async ({ api }) => {
  await cleanup(api);
  const s = await staff(api);
  test.skip(!s, 'the QA staff member has no record');
  const a = await mk(api, A), b = await mk(api, B);
  try {
    expect((await api.request('POST', '/hr/kpi/metrics', { name: MEASURE, max_points: 10, source: 'MANUAL', rating_scale: 5, applies_positions: [999999] }, MGR)).status).toBe(400);
    const m = await api.request('POST', '/hr/kpi/metrics', { name: MEASURE, max_points: 10, source: 'MANUAL', rating_scale: 5, applies_positions: [a] }, MGR);
    expect(m.status).toBe(201);
    const has = async () => ((await month(api, s.id))?.items || []).some((i: any) => i.name === MEASURE);
    await api.request('PUT', `/hr/staff/${s.id}`, { position_id: null }, MGR);
    expect(await has()).toBe(false);
    await api.request('PUT', `/hr/staff/${s.id}`, { position_id: b }, MGR);
    expect(await has()).toBe(false);
    await api.request('PUT', `/hr/staff/${s.id}`, { position_id: a }, MGR);
    expect(await has()).toBe(true);
  } finally {
    await cleanup(api);
  }
});

test('HRL-2 a job role has its own incentive bands, which win over the login role and the default; removing the job role removes them', async ({ api }) => {
  await cleanup(api);
  const s = await staff(api);
  test.skip(!s, 'the QA staff member has no record');
  const a = await mk(api, A);
  try {
    expect((await api.request('PUT', '/hr/kpi/bands', { role_name: 'Sales Staff', position_id: a, bands: [] }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/hr/kpi/bands', { position_id: 999999, bands: [] }, MGR)).status).toBe(400);
    const save = await api.request('PUT', '/hr/kpi/bands', { position_id: a, bands: [{ min_percent: 0, label: 'JR-set', incentive_percent: 7 }] }, MGR);
    expect(save.status).toBe(200);
    const all = (await api.request('GET', '/hr/kpi/bands', undefined, MGR)).body;
    expect(all.some((x: any) => x.position_id === a && x.label === 'JR-set')).toBe(true);
    await api.request('PUT', `/hr/staff/${s.id}`, { position_id: a }, MGR);
    expect((await month(api, s.id)).draft).toMatchObject({ band_label: 'JR-set', incentive_percent: 7 });
    // the manual scoring route picks the same set
    const active = (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body.filter((m: any) => m.active);
    const scored = await api.request('POST', '/hr/kpi/score', { employee_id: s.id, period: P, scores: active.map((m: any) => ({ metric_id: m.id, points: 0 })) }, MGR);
    expect(scored.status).toBeLessThan(300);
    expect(scored.body).toMatchObject({ band: 'JR-set', incentive_percent: 7 });
    await api.request('POST', '/hr/kpi/reopen', { employee_id: s.id, period: P }, MGR);
    await api.request('PUT', `/hr/staff/${s.id}`, { position_id: null }, MGR);
    expect((await month(api, s.id)).draft.band_label).not.toBe('JR-set');
  } finally {
    await cleanup(api);
  }
  const left = (await api.request('GET', '/hr/kpi/bands', undefined, MGR)).body;
  expect(left.some((x: any) => x.label === 'JR-set')).toBe(false);
});

test('HRL-3 the starter job roles are added once, carry the usual login role, and a login of that role is offered the job role', async ({ api }) => {
  const ps = (await api.request('GET', '/hr/positions', undefined, MGR)).body;
  const before = ps.length;
  const first = await api.request('POST', '/hr/starter', { roles: true }, MGR);
  expect(first.status).toBe(201);
  const again = await api.request('POST', '/hr/starter', { roles: true }, MGR);
  expect(again.body.roles).toEqual([]);
  const after = (await api.request('GET', '/hr/positions', undefined, MGR)).body;
  expect(after.length).toBe(before + first.body.roles.length);
  expect(after.find((p: any) => p.name === 'Store manager')).toMatchObject({ login_role: 'Store Head' });
  expect((await api.request('POST', '/hr/positions', { name: 'QA Link C', login_role: 'No such role', lines: [] }, MGR)).status).toBe(400);
  const cand = (await api.request('GET', '/hr/staff/candidates', undefined, MGR)).body;
  const head = cand.find((c: any) => c.role_name === 'Store Head');
  if (head) expect(head.suggested_position_id).toBe(after.find((p: any) => p.name === 'Store manager').id);
  for (const p of after.filter((x: any) => first.body.roles.includes(x.name) && !x.staff)) await api.request('DELETE', `/hr/positions/${p.id}`, undefined, MGR);
});

test('HRL-4 the Setup screens show the job role beside a measure and in the band choice', async ({ app, api }) => {
  await cleanup(api);
  const a = await mk(api, A);
  try {
    const { page } = await app.open(MGR, '/secure/hr/setup');
    await page.getByTestId('hr-sec-kpi-toggle').click();
    await expect(page.getByTestId('hr-set-band-role').locator('option', { hasText: A })).toHaveCount(1);
    await page.getByTestId('hr-set-band-role').selectOption({ label: A });
    await expect(page.getByTestId('hr-set-bands')).toBeVisible();
    expect(a).toBeGreaterThan(0);
  } finally {
    await cleanup(api);
  }
});

test('HRL-5 a leave type for a job role is offered, and accepted, only for the people who hold it', async ({ api }) => {
  await cleanup(api);
  const s = await staff(api);
  test.skip(!s, 'the QA staff member has no record');
  const a = await mk(api, A);
  const year = new Date().getFullYear();
  const lt = await api.request('POST', '/hr/leave/types', { name: 'QA Link leave', paid: true, annual_days: 3, applies_positions: [a] }, MGR);
  expect(lt.status).toBe(201);
  try {
    expect((await api.request('POST', '/hr/leave/types', { name: 'QA Link bad', paid: true, annual_days: 1, applies_positions: [999999] }, MGR)).status).toBe(400);
    const has = async () => (await api.request('GET', `/hr/leave/balances?year=${year}`, undefined, MGR)).body.some((r: any) => r.employee_id === s.id && r.type_id === lt.body.id);
    await api.request('PUT', `/hr/staff/${s.id}`, { position_id: null }, MGR);
    expect(await has()).toBe(false);
    const day = `${year + 1}-03-03`;
    const no = await api.request('POST', '/hr/leave/requests', { employee_id: s.id, leave_type_id: lt.body.id, from_date: day, to_date: day }, MGR);
    expect(no.status).toBe(400);
    expect(JSON.stringify(no.body)).toContain('does not apply');
    await api.request('PUT', `/hr/staff/${s.id}`, { position_id: a }, MGR);
    expect(await has()).toBe(true);
  } finally {
    await api.request('DELETE', `/hr/leave/types/${lt.body.id}`, undefined, MGR);
    await cleanup(api);
  }
});

test('HRL-6 designations already typed can be turned into job roles, giving each person theirs, and a second pass changes nothing', async ({ api }) => {
  await cleanup(api);
  const s = await staff(api);
  test.skip(!s, 'the QA staff member has no record');
  const was = (await api.request('GET', `/hr/staff/${s.id}`, undefined, MGR)).body.designation || '';
  try {
    await api.request('PUT', `/hr/staff/${s.id}`, { designation: 'QA Link Desig', position_id: null }, MGR);
    const groups = (await api.request('GET', '/hr/positions/designations', undefined, MGR)).body;
    expect(groups.find((g: any) => g.designation === 'QA Link Desig')).toMatchObject({ staff: 1, position_id: null });
    expect((await api.request('POST', '/hr/positions/designations', { designations: [] }, MGR)).status).toBe(400);
    const done = await api.request('POST', '/hr/positions/designations', { designations: ['qa link desig'] }, MGR);
    expect(done.status).toBe(201);
    expect(done.body).toMatchObject({ created: ['QA Link Desig'], assigned: 1 });
    const detail = (await api.request('GET', `/hr/staff/${s.id}`, undefined, MGR)).body;
    expect(detail.position).toBe('QA Link Desig');
    expect(detail.designation).toBe('QA Link Desig');
    const again = await api.request('POST', '/hr/positions/designations', { designations: ['QA Link Desig'] }, MGR);
    expect(again.body).toMatchObject({ created: [], assigned: 0 });
  } finally {
    await api.request('PUT', `/hr/staff/${s.id}`, { designation: was, position_id: null }, MGR);
    await cleanup(api);
  }
});
