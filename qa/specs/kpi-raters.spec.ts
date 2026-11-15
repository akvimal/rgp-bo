/**
 * Who rates a KPI measure - KPI-RT-1..5
 * A manual measure can name the job roles that may rate it. The Business Head can always rate; a measure with no list is rated, as before, by whoever holds the
 * KPI rating permission (Store Head, Business Head). A named job role gets the Rate staff screen with only the measures it may rate, and no scores.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const RATER = 'sales1@local.test';             // a Sales Staff login: no KPI rating permission by role
const TARGET = 'sales2@local.test';
const stamp = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[+d]);
const period = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);

test.describe.serial('KPI raters', () => {
  let pos = 0, byRole = 0, byManager = 0, raterEmp = 0, targetEmp = 0, was: number | null = null;

  test.beforeAll(async ({ api }) => {
    const staff = (await api.request('GET', '/hr/staff', undefined, MGR)).body as any[];
    raterEmp = staff.find((s) => s.email === RATER).id;
    targetEmp = staff.find((s) => s.email === TARGET).id;
    was = staff.find((s) => s.id === raterEmp).position_id ?? null;
    pos = (await api.request('POST', '/hr/positions', { name: `QA Rater ${stamp}`, login_role: 'Sales Staff' }, MGR)).body.id;
    expect((await api.request('PUT', `/hr/staff/${raterEmp}`, { position_id: pos }, MGR)).status).toBe(200);
    byRole = (await api.request('POST', '/hr/kpi/metrics', { name: `QA RB Role ${stamp}`, max_points: 10, source: 'MANUAL', rater_positions: [pos] }, MGR)).body.id;
    byManager = (await api.request('POST', '/hr/kpi/metrics', { name: `QA RB Manager ${stamp}`, max_points: 10, source: 'MANUAL' }, MGR)).body.id;
  });

  test.afterAll(async ({ api }) => {
    await api.request('PUT', `/hr/staff/${raterEmp}`, { position_id: was }, MGR);
    for (const id of [byRole, byManager]) await api.request('DELETE', `/hr/kpi/metrics/${id}`, undefined, MGR);
    await api.request('DELETE', `/hr/positions/${pos}`, undefined, MGR);
  });

  const rate = (api: any, who: string, metric: number) => api.request('PUT', '/kpi/rate', { employee_id: targetEmp, period, metric_id: metric, rating: 4 }, who);

  test('KPI-RT-1 the measure lists the job roles that rate it', async ({ api }) => {
    const all = (await api.request('GET', '/hr/kpi/metrics', undefined, MGR)).body as any[];
    expect(all.find((m) => m.id === byRole).rater_positions).toEqual([pos]);
    expect(all.find((m) => m.id === byManager).rater_positions ?? null).toBeNull();
  });

  test('KPI-RT-2 a person whose job role is named can rate that measure, and not the others', async ({ api }) => {
    expect((await rate(api, RATER, byRole)).status).toBe(200);
    const other = await rate(api, RATER, byManager);
    expect(other.status).toBe(403);
    expect(other.body.message).toMatch(/rated by a manager/i);
  });

  test('KPI-RT-3 a Store Head is kept off a measure that names other job roles, and keeps the open ones; the Business Head rates any', async ({ api }) => {
    const blocked = await rate(api, HEAD, byRole);
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toContain(`QA Rater ${stamp}`);
    expect((await rate(api, HEAD, byManager)).status).toBe(200);
    expect((await rate(api, MGR, byRole)).status).toBe(200);
    expect((await rate(api, MGR, byManager)).status).toBe(200);
  });

  test('KPI-RT-4 the named job role sees only its own measures, with no scores', async ({ api }) => {
    const me = (await api.request('GET', '/auth/me', undefined, RATER)).body;
    expect(me.permissions.some((p: any) => p.resource === 'kpirate')).toBe(true);        // the Rate staff screen opens for them
    const rows = (await api.request('GET', `/kpi/rate?period=${period}`, undefined, RATER)).body as any[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.percent).toBeNull();
      for (const i of r.items) expect(i.can_rate).toBe(true);
      expect(r.items.some((i: any) => i.metric_id === byManager)).toBe(false);
    }
    expect(rows.some((r) => r.items.some((i: any) => i.metric_id === byRole))).toBe(true);
    // a manager still sees the whole sheet with scores and the locked measures
    const sheet = (await api.request('GET', `/kpi/rate?period=${period}`, undefined, HEAD)).body as any[];
    const mine = sheet.find((r) => r.employee_id === targetEmp);
    expect(mine.items.find((i: any) => i.metric_id === byRole).can_rate).toBe(false);
    expect(mine.items.find((i: any) => i.metric_id === byManager).can_rate).toBe(true);
  });

  test('KPI-RT-5 the setup form has a Rated by list for a rated measure, and the Rate staff screen opens for the named job role', async ({ app }) => {
    const owner = await app.open(MGR, '/secure/hr/setup');
    await owner.page.getByTestId('hr-set-tab-kpi').click();
    await expect(owner.page.getByTestId('hr-set-metric-row').filter({ hasText: `QA RB Role ${stamp}` })).toContainText(`QA Rater ${stamp}`);
    await owner.page.getByTestId('hr-set-metric-row').filter({ hasText: `QA RB Role ${stamp}` }).getByTestId('hr-set-metric-edit').click();
    await expect(owner.page.getByTestId('hr-set-metric-raters')).toBeVisible();
    await owner.page.getByTestId('hr-set-metric-source').selectOption('SYSTEM');
    await expect(owner.page.getByTestId('hr-set-metric-raters')).toHaveCount(0);        // a system measure has no raters
    const rater = await app.open(RATER, '/secure/kpi/rate');
    await expect(rater.page).toHaveURL(/\/secure\/kpi\/rate/);
    await expect(rater.page.getByTestId('kpi-person').first()).toBeVisible();
    await expect(rater.page.getByTestId(`kpi-rating-${byRole}`).first()).toBeEnabled();
    await expect(rater.page.getByTestId(`kpi-rating-${byManager}`)).toHaveCount(0);
  });
});
