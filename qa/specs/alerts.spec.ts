/**
 * Alerts (docs/planning/NOTIFICATIONS.md, phase 1) - ALRT-1..
 * The engine (rules -> notifications that open, update and clear themselves), who sees what, the owner's rules, Tamil,
 * and the bell and screens. The assistant's call to the model is covered by unit tests; here it is checked switched off.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const PASS = process.env.QA_ADMIN_PASS || 'admin123';
const STORE_HEAD = 3;
const SALES = 2;

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', { location: `AL ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true }, MGR);
  return { id: s.body.id as number, location: s.body.location as string };
}

async function user(api: any, storeId: number, roleid: number) {
  const email = `qa.al.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@local.test`;
  const r = await api.request('POST', '/users', { fullname: 'QA Alert User', email, password: PASS, phone: '9' + String(Date.now()).slice(-9), location: 'QA', roleid, storeids: [storeId] }, MGR);
  expect(r.status).toBeLessThan(300);
  return { email, id: r.body.id as number };
}

const licences = (api: any, id: number, rows: any[]) => api.request('PUT', `/stores/${id}/licenses`, { licenses: rows }, MGR);
const run = (api: any) => api.request('POST', '/alerts/run', {}, MGR);
const list = async (api: any, as = MGR, status = 'open') => (await api.request('GET', `/alerts/notifications?status=${status}&limit=200`, undefined, as)).body;
const forStore = (items: any[], location: string) => items.filter((n) => n.store === location.trim());

test.describe('Alerts: the engine @p1', () => {
  test('ALRT-1 a business starts with the built-in alerts; setting them up is the owner\'s @happy', async ({ api }) => {
    const rules = (await api.request('GET', '/alerts/rules', undefined, MGR)).body as any[];
    expect(rules.filter((r) => r.source === 'system').map((r) => r.kind).sort()).toEqual(
      ['approvals_pending', 'deposit_due', 'licence_expiring', 'registration_expiring', 'shift_open_long']);
    const s = await freshStore(api);
    const staff = await user(api, s.id, SALES);
    expect((await api.request('GET', '/alerts/rules', undefined, staff.email)).status).toBe(403);
    expect((await api.request('POST', '/alerts/rules', { kind: 'deposit_due' }, staff.email)).status).toBe(403);
    expect((await api.request('GET', '/alerts/notifications', undefined, staff.email)).status).toBe(200);   // their own list is theirs
  });

  test('ALRT-2 a licence ending soon raises one alert that updates, and clears itself when it is renewed @happy', async ({ api }) => {
    const s = await freshStore(api);
    expect((await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-1', validfrom: day(-300), validto: day(10) }])).status).toBeLessThan(300);
    await run(api); await run(api);                                                       // twice: still one alert
    const mine = forStore((await list(api)).items, s.location);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ code: 'licence_expiring', severity: 'warning', status: 'open' });
    expect(mine[0].title).toContain('licence ends on');
    expect(mine[0].params.days).toBe(10);

    // it lapses: the same alert becomes an expired one, louder
    await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-1', validfrom: day(-300), validto: day(-3) }]);
    await run(api);
    const lapsed = forStore((await list(api)).items, s.location);
    expect(lapsed).toHaveLength(1);
    expect(lapsed[0]).toMatchObject({ code: 'licence_expired', severity: 'critical' });
    expect(lapsed[0].id).toBe(mine[0].id);

    // renewed: the alert clears (it stays visible as resolved for a week)
    await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-1', validfrom: day(-300), validto: day(400) }]);
    await run(api);
    expect(forStore((await list(api)).items, s.location)).toHaveLength(0);
    const all = forStore((await list(api, MGR, 'all')).items, s.location);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('resolved');
  });

  test('ALRT-3 people see only their own alerts and act on them for themselves @happy', async ({ api }) => {
    const s = await freshStore(api), other = await freshStore(api);
    await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-3', validfrom: day(-300), validto: day(5) }]);
    const head = await user(api, s.id, STORE_HEAD);
    const headElsewhere = await user(api, other.id, STORE_HEAD);
    const sales = await user(api, s.id, SALES);
    await run(api);

    const seen = forStore((await list(api, head.email)).items, s.location);
    expect(seen).toHaveLength(1);                                                         // the Store Head of that store
    expect(forStore((await list(api, headElsewhere.email)).items, s.location)).toHaveLength(0);   // another store's head
    expect(forStore((await list(api, sales.email)).items, s.location)).toHaveLength(0);   // the rule names owners and store heads

    const id = seen[0].id;
    expect((await api.request('POST', `/alerts/notifications/${id}/read`, {}, sales.email)).status).toBe(404);   // not theirs to touch
    const before = (await list(api, head.email)).unread;
    expect((await api.request('POST', `/alerts/notifications/${id}/read`, {}, head.email)).status).toBeLessThan(300);
    expect((await list(api, head.email)).unread).toBe(before - 1);
    expect((await list(api, MGR)).unread).toBeGreaterThan(0);                              // the owner's own marks are separate

    expect((await api.request('POST', `/alerts/notifications/${id}/snooze`, { hours: 3 }, head.email)).status).toBe(400);
    expect((await api.request('POST', `/alerts/notifications/${id}/snooze`, { hours: 4 }, head.email)).status).toBeLessThan(300);
    expect(forStore((await list(api, head.email)).items, s.location)).toHaveLength(0);
    expect(forStore((await list(api, head.email, 'all')).items, s.location)[0].status).toBe('snoozed');
    expect(forStore((await list(api, MGR)).items, s.location)).toHaveLength(1);            // snoozing is for the one who snoozed

    expect((await api.request('POST', `/alerts/notifications/${id}/dismiss`, {}, MGR)).status).toBeLessThan(300);
    expect(forStore((await list(api, MGR)).items, s.location)).toHaveLength(0);
    await run(api);
    expect(forStore((await list(api, MGR)).items, s.location)).toHaveLength(0);            // the same cause does not nag again
  });

  test('ALRT-4 the owner\'s rules: checked, previewed, scoped to a store, switched off, removed @happy', async ({ api }) => {
    const s = await freshStore(api);
    await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-4', validfrom: day(-300), validto: day(50) }]);
    const post = (body: any) => api.request('POST', '/alerts/rules', body, MGR);

    expect((await post({ kind: 'nope' })).status).toBe(400);
    expect((await post({ kind: 'licence_expiring', params: { days: 0 } })).status).toBe(400);
    expect((await post({ kind: 'licence_expiring', params: { days: 400 } })).status).toBe(400);
    expect((await post({ kind: 'licence_expiring', recipients: { roles: ['everyone'] } })).status).toBe(400);
    expect((await post({ kind: 'licence_expiring', storeid: 999999 })).status).toBe(400);

    // 30 days (the built-in) does not catch a licence 50 days out; a rule for 60 days at this store does
    const pv = await api.request('POST', '/alerts/rules/preview', { kind: 'licence_expiring', params: { days: 60 }, storeid: s.id }, MGR);
    expect(pv.body.count).toBe(1);
    expect((await api.request('POST', '/alerts/rules/preview', { kind: 'licence_expiring', params: { days: 20 }, storeid: s.id }, MGR)).body.count).toBe(0);

    const made = await post({ kind: 'licence_expiring', name: 'Early licence warning', params: { days: 60 }, severity: 'critical', storeid: s.id, recipients: { roles: ['owners'] } });
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    expect(made.body).toMatchObject({ source: 'person', severity: 'critical', storeid: s.id, open: 1 });
    const items = forStore((await list(api)).items, s.location);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ severity: 'critical', rule: 'Early licence warning' });

    const off = await api.request('PUT', `/alerts/rules/${made.body.id}`, { active: false }, MGR);
    expect(off.body.active).toBe(false);
    expect(forStore((await list(api)).items, s.location)).toHaveLength(0);
    await api.request('PUT', `/alerts/rules/${made.body.id}`, { active: true }, MGR);
    expect(forStore((await list(api)).items, s.location)).toHaveLength(1);

    expect((await api.request('DELETE', `/alerts/rules/${made.body.id}`, undefined, MGR)).status).toBeLessThan(300);
    expect(forStore((await list(api)).items, s.location)).toHaveLength(0);
    const builtIn = ((await api.request('GET', '/alerts/rules', undefined, MGR)).body as any[]).find((r) => r.source === 'system')!;
    expect((await api.request('DELETE', `/alerts/rules/${builtIn.id}`, undefined, MGR)).status).toBe(400);
  });

  test('ALRT-5 alerts are written in the reader\'s language, English or Tamil @happy', async ({ api }) => {
    const s = await freshStore(api);
    await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-5', validfrom: day(-300), validto: day(7) }]);
    await run(api);
    try {
      expect((await api.request('PUT', '/alerts/prefs', { language: 'fr' }, MGR)).status).toBe(400);
      expect((await api.request('PUT', '/alerts/prefs', { language: 'ta' }, MGR)).body.language).toBe('ta');
      const ta = forStore((await list(api)).items, s.location)[0];
      expect(ta.title).toContain('உரிமம்');
      expect(ta.title).toContain(s.location.trim());
    } finally {
      await api.request('PUT', '/alerts/prefs', { language: 'en' }, MGR);
    }
    expect(forStore((await list(api)).items, s.location)[0].title).toContain('licence ends on');
  });

  test('ALRT-6 the assistant is off without a key: the form still works @edge', async ({ api }) => {
    const k = (await api.request('GET', '/alerts/kinds', undefined, MGR)).body;
    expect(k.kinds.map((x: any) => x.kind)).toContain('deposit_due');
    if (k.assistant) test.skip(true, 'an assistant key is set on this server');
    const d = await api.request('POST', '/alerts/rules/draft', { instruction: 'tell me when a shift stays open' }, MGR);
    expect(d.status).toBe(503);
    expect(JSON.stringify(d.body)).toContain('not switched on');
  });
});

test.describe('Alerts: choosing the assistant model @p1', () => {
  test('ALRT-10 the model choice belongs to the owner, and needs OpenRouter @edge', async ({ api }) => {
    const ai = await api.request('GET', '/alerts/ai', undefined, MGR);
    expect(ai.status).toBe(200);
    expect(ai.body).toHaveProperty('configured');
    if (ai.body.provider === 'openrouter') test.skip(true, 'OpenRouter is configured on this server');
    expect((await api.request('PUT', '/alerts/ai', { model: 'vendor/model' }, MGR)).status).toBe(400);
    const s = await freshStore(api);
    const staff = await user(api, s.id, SALES);
    expect((await api.request('GET', '/alerts/ai', undefined, staff.email)).status).toBe(403);
    expect((await api.request('PUT', '/alerts/ai', { model: 'vendor/model' }, staff.email)).status).toBe(403);
  });
});

test.describe('Alerts: screens @p1', () => {
  test('ALRT-7 the bell shows what needs attention; the page can snooze, dismiss and change language @happy', async ({ api, app }) => {
    const s = await freshStore(api);
    await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-7', validfrom: day(-300), validto: day(9) }]);
    await run(api);
    const { page } = await app.open(MGR, '/secure/dashboard');
    await expect(page.getByTestId('bell-count')).toBeVisible();
    await page.getByTestId('bell-button').click();
    await expect(page.getByTestId('bell-menu')).toContainText(s.location.trim());
    await page.getByTestId('bell-all').click();
    await expect(page).toHaveURL(/\/secure\/notifications$/);
    const row = page.getByTestId('np-item').filter({ hasText: s.location.trim() });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId('np-title')).toContainText('licence ends on');

    await page.getByTestId('np-language').selectOption('ta');
    await expect(page.getByTestId('np-item').filter({ hasText: s.location.trim() }).getByTestId('np-title')).toContainText('உரிமம்');
    await page.getByTestId('np-language').selectOption('en');
    await expect(page.getByTestId('np-item').filter({ hasText: s.location.trim() }).getByTestId('np-title')).toContainText('licence ends on');

    await page.getByTestId('np-item').filter({ hasText: s.location.trim() }).getByTestId('np-dismiss').click();
    await expect(page.getByTestId('np-item').filter({ hasText: s.location.trim() })).toHaveCount(0);
    await page.getByTestId('np-show-all').check();
    await expect(page.getByTestId('np-item').filter({ hasText: s.location.trim() })).toHaveAttribute('data-status', 'dismissed');
  });

  test('ALRT-8 Settings > Alerts lists the rules and sets one up with a preview @happy', async ({ api, app }) => {
    const s = await freshStore(api);
    await licences(api, s.id, [{ licensetype: 'RETAIL_20_21', number: 'AL-8', validfrom: day(-300), validto: day(45) }]);
    const { page } = await app.open(MGR, '/secure/settings/alerts');
    await expect(page.getByTestId('al-row').first()).toBeVisible();
    await expect(page.getByTestId('al-row').filter({ hasText: 'Bank deposit due' })).toHaveCount(1);
    const assistant = (await api.request('GET', '/alerts/kinds', undefined, MGR)).body.assistant;
    await expect(page.getByTestId('al-assistant')).toHaveCount(assistant ? 1 : 0);   // the box shows only when a key is set

    const name = `QA early ${Date.now()}`;
    await page.getByTestId('al-new').click();
    await page.getByTestId('al-kind').selectOption('licence_expiring');
    await page.getByTestId('al-name').fill(name);
    await page.getByTestId('al-param-days').fill('60');
    await page.getByTestId('al-store').selectOption({ label: s.location.trim() });
    await page.getByTestId('al-preview').click();
    await expect(page.getByTestId('al-preview-result')).toContainText('It would raise 1 alert right now');
    await page.getByTestId('al-save').click();
    await expect(page.getByTestId('al-message')).toBeVisible();
    const row = page.getByTestId('al-row').filter({ hasText: name });
    await expect(row).toContainText('60 days');
    await expect(row).toContainText(s.location.trim());
    await row.getByTestId('al-remove').click();
    await page.getByRole('button', { name: 'Remove' }).last().click();
    await expect(page.getByTestId('al-row').filter({ hasText: name })).toHaveCount(0);
  });

  test('ALRT-9 a sales login has a bell and a page, and no Alerts setup @edge', async ({ api, app }) => {
    const s = await freshStore(api);
    const staff = await user(api, s.id, SALES);
    const { page } = await app.open(staff.email, '/secure/notifications');
    await expect(page.getByTestId('bell-button')).toBeVisible();
    await expect(page.getByTestId('np-empty')).toBeVisible();
    await expect(page.getByTestId('nav-settings-alerts')).toHaveCount(0);
  });
});
