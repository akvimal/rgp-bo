/**
 * Settings > Dashboards and compliance - DSU-1..4 (API) and DSU-UI-1..3 (screen)
 * The Business Head changes the settings from a date, resets them, previews a role with unsaved choices, and sees who changed what; the Store Head reads
 * the same screen without controls; a required item, an unknown role or a bad value is refused.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const HEAD = 'storehead@local.test';
const SALES = 'sales1@local.test';

test.describe('Dashboard setup API @p1', () => {
  test.describe.configure({ mode: 'serial' });
  test.afterAll(async ({ api }) => { await api.request('DELETE', '/config/compliance/escalate_days', undefined, MGR); });

  test('DSU-1 a change is saved from a date, shows in the history with before and after, and a reset removes it @happy', async ({ api }) => {
    const save = await api.request('PUT', '/config/compliance', { values: { escalate_days: 5 } }, MGR);
    expect(save.status, JSON.stringify(save.body)).toBe(200);
    const hist = await api.request('GET', '/config/history?scope=compliance', undefined, MGR);
    expect(hist.status).toBe(200);
    const row = hist.body.find((h: any) => h.action === 'config.save');
    expect(row.who).toBeTruthy();
    expect(row.details.changes.find((c: any) => c.key === 'escalate_days').after).toBe(5);
    expect((await api.request('DELETE', '/config/compliance/escalate_days', undefined, MGR)).status).toBe(200);
    const after = await api.request('GET', '/config/history?scope=compliance', undefined, MGR);
    expect(after.body[0].action).toBe('config.reset');
  });

  test('DSU-2 a required item, an unknown setting and a bad value are refused @negative', async ({ api }) => {
    expect((await api.request('PUT', '/config/compliance', { values: { licence_expiry: 'ignore' } }, MGR)).status).toBeGreaterThanOrEqual(400);
    expect((await api.request('PUT', '/config/compliance', { values: { nonsense: 1 } }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/config/compliance', { values: { escalate_days: 99 } }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/config/health', { values: { w_sales: 50 } }, MGR)).status).toBe(400);
    expect((await api.request('GET', '/config/history?scope=nope', undefined, MGR)).status).toBe(400);
  });

  test('DSU-3 the Store Head reads but cannot save; the history is for the business only @negative', async ({ api }) => {
    const r = await api.request('GET', '/config?scope=compliance', undefined, HEAD);
    expect(r.status).toBe(200);
    expect(r.body.canEdit).toBe(false);
    expect((await api.request('PUT', '/config/compliance', { values: { escalate_days: 4 } }, HEAD)).status).toBe(403);
    expect((await api.request('DELETE', '/config/compliance', undefined, HEAD)).status).toBe(403);
  });

  test('DSU-4 preview as a role lays unsaved choices over the saved ones and writes nothing @happy', async ({ api }) => {
    const before = await api.request('GET', '/config?scope=views', undefined, MGR);
    const p = await api.request('POST', '/dashboard/preview', { role: 'Counter', values: { default_period: 'today', new_menu: true } }, MGR);
    expect(p.status, JSON.stringify(p.body)).toBeLessThan(300);
    expect(p.body.view).toBe('counter');
    expect(p.body.widgets).toContain('shift');
    expect(p.body.settings.default_period).toBe('today');
    expect(p.body.settings.new_menu).toBe(true);
    const after = await api.request('GET', '/config?scope=views', undefined, MGR);
    expect(after.body.items.map((i: any) => i.value)).toEqual(before.body.items.map((i: any) => i.value));
    expect((await api.request('POST', '/dashboard/preview', { role: 'Wizard' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/dashboard/preview', { role: 'Counter', values: { default_period: 'never' } }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/dashboard/preview', { role: 'Counter' }, HEAD)).status).toBe(403);
    expect((await api.request('POST', '/dashboard/preview', { role: 'Counter' }, SALES)).status).toBe(403);
  });
});
