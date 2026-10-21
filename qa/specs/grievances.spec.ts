/**
 * Staff & Quality — Grievances — GRV-1..4
 * Customer complaints: log, assign, resolve, close, with a timeline and due dates.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const SITE_ADMIN = 'siteadmin@local.test';
const OWNER = 'businesshead@local.test';
const CASHIER = 'cashier.harbourh70@qa.local';
const PAGE = '/secure/quality/grievances';

async function firstStoreId(api: any): Promise<number> {
  const s = await api.request('GET', '/grievances/stores', undefined, OWNER);
  expect(s.status).toBe(200);
  return s.body[0].id;
}

test.describe('Staff & Quality — Grievances @p1', () => {
  test('GRV-1 Business Head logs a grievance from the screen and it shows in the list @happy', async ({ app, api }) => {
    const { page } = await app.open(OWNER, PAGE);
    await expectShell(page);
    await expect(page.getByTestId('nav-quality')).toBeVisible();
    const summary = `QA grievance ${Date.now()}`;
    await page.getByTestId('gr-new').click();
    const storeSelect = page.getByTestId('gr-f-store');
    if (await storeSelect.count()) await storeSelect.selectOption({ index: 1 });
    await page.getByTestId('gr-f-category').selectOption('WRONG_ITEM');
    await page.getByTestId('gr-f-severity').selectOption('HIGH');
    await page.getByTestId('gr-f-summary').fill(summary);
    await page.getByTestId('gr-f-save').click();
    await expect(page.getByTestId('gr-detail')).toContainText(summary);
    await expect(page.getByTestId('gr-d-status')).toContainText('Open');
    await page.getByTestId('gr-search').fill(summary);
    await page.getByTestId('gr-search').press('Enter');
    await expect(page.getByTestId('gr-row')).toHaveCount(1);
  });

  test('GRV-2 lifecycle: start, resolve needs a resolution, close, then no further moves @integration', async ({ api }) => {
    const storeid = await firstStoreId(api);
    const made = await api.request('POST', '/grievances', { storeid, category: 'SERVICE', severity: 'LOW', summary: 'QA lifecycle ticket' }, OWNER);
    expect(made.status).toBe(201);
    const id = made.body.id;

    const noText = await api.request('PUT', `/grievances/${id}`, { status: 'RESOLVED' }, OWNER);
    expect(noText.status).toBe(400);
    expect((await api.request('PUT', `/grievances/${id}`, { status: 'IN_PROGRESS' }, OWNER)).body.status).toBe('IN_PROGRESS');
    expect((await api.request('PUT', `/grievances/${id}`, { status: 'RESOLVED', resolution: 'Replaced the item' }, OWNER)).body.status).toBe('RESOLVED');
    expect((await api.request('PUT', `/grievances/${id}`, { status: 'CLOSED' }, OWNER)).body.status).toBe('CLOSED');
    expect((await api.request('PUT', `/grievances/${id}`, { status: 'IN_PROGRESS' }, OWNER)).status).toBe(400);

    const note = await api.request('POST', `/grievances/${id}/notes`, { note: 'Called the customer back' }, OWNER);
    expect(note.status).toBe(201);
    const full = (await api.request('GET', `/grievances/${id}`, undefined, OWNER)).body;
    const texts = full.notes.map((n: any) => n.note);
    expect(texts).toEqual(expect.arrayContaining(['Logged', 'In progress', 'Resolved: Replaced the item', 'Closed', 'Called the customer back']));
  });

  test('GRV-3 bad input is rejected and the due date follows severity @edge', async ({ api }) => {
    const storeid = await firstStoreId(api);
    expect((await api.request('POST', '/grievances', { storeid, category: 'NOPE', summary: 'long enough' }, OWNER)).status).toBe(400);
    expect((await api.request('POST', '/grievances', { storeid, category: 'SERVICE', summary: 'abc' }, OWNER)).status).toBe(400);
    const high = await api.request('POST', '/grievances', { storeid, category: 'PRICING', severity: 'HIGH', summary: 'QA high severity' }, OWNER);
    const low = await api.request('POST', '/grievances', { storeid, category: 'PRICING', severity: 'LOW', summary: 'QA low severity' }, OWNER);
    const due = async (id: number) => new Date((await api.request('GET', `/grievances/${id}`, undefined, OWNER)).body.due_on).getTime();
    const gap = (await due(low.body.id)) - (await due(high.body.id));
    expect(Math.round(gap / 86400000)).toBe(6);
  });

  test('GRV-4 roles without access cannot open the screen or call the API @permission', async ({ app, api }) => {
    for (const who of [CASHIER, SITE_ADMIN]) {
      const { page } = await app.open(who, PAGE);
      await expect(page).toHaveURL(/\/login/);
      expect((await api.request('GET', '/grievances', undefined, who)).status).toBe(403);
      expect((await api.request('POST', '/grievances', { category: 'SERVICE', summary: 'not allowed' }, who)).status).toBe(403);
    }
  });
});
