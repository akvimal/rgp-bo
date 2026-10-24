/**
 * Suggestions for the shift checklists - AIC-1..3
 * From the last 30 days (exact numbers from the database, wording by the assistant when it is on) and from a situation described.
 * Nothing is saved until the owner adds an item to a list and saves it. The model is never called for real in these tests.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

const freshStore = async (api: any) => {
  const s = await api.request('POST', '/stores', { location: `AIC ${Date.now()}${Math.floor(Math.random() * 90 + 10)}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return s.body.id as number;
};

/** a shift that opens with 500 and closes counted at `counted`: out by the difference */
async function shiftOut(api: any, sid: number, counted: number) {
  const me = (await api.request('GET', '/auth/me', undefined, MGR)).body.id;
  const open = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 500, name: 'aic' }, MGR);
  expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);
  const close = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, { countedcash: counted, closedoperatorid: me, closetype: 'END_OF_DAY' }, MGR);
  expect(close.status, JSON.stringify(close.body)).toBeLessThan(300);
}

const wipe = async (api: any, sid: number) => {
  for (const kind of ['OPENING', 'OPENING_OPEN_STORE', 'CLOSING', 'HANDOVER']) await api.request('DELETE', `/store-cash/checklists?scope=store&storeid=${sid}&kind=${kind}`, undefined, MGR);
};

test.describe('Checklist suggestions @p1', () => {
  test('AIC-1 the last 30 days give suggestions with their evidence; what is already on the list is not suggested again; only a Business Head may ask @happy', async ({ api }) => {
    const sid = await freshStore(api);
    try {
      const quiet = (await api.request('GET', `/store-cash/checklists/suggestions?scope=store&storeid=${sid}&ai=false`, undefined, MGR)).body;
      expect(quiet.facts).toEqual([]);                                                              // nothing has happened here
      expect(quiet.suggestions).toEqual([]);

      await shiftOut(api, sid, 480);                                                                // 20 short
      await shiftOut(api, sid, 530);                                                                // 30 over
      const r = (await api.request('GET', `/store-cash/checklists/suggestions?scope=store&storeid=${sid}&ai=false`, undefined, MGR)).body;
      expect(r.days).toBe(30);
      const f = r.facts.find((x: any) => x.id === 'cash_variance');
      expect(f, JSON.stringify(r.facts)).toBeTruthy();
      expect(f.text).toContain('at 2 of 2 closings');
      expect(f.text).toContain('1 short, 1 over');
      expect(f.text).toContain('₹50 in all');
      expect(f.text).toContain('the biggest ₹30');
      const s = r.suggestions.find((x: any) => x.facts.includes('cash_variance'));
      expect(s).toMatchObject({ list: 'CLOSING', source: 'rule' });
      expect(s.reason).toBe(f.text);                                                                // the evidence travels with the suggestion
      expect(r.assistant.used).toBe(false);                                                         // the numbers alone, no model

      // it is on the list now: it is not suggested again
      const list = (await api.request('GET', `/store-cash/checklists?storeid=${sid}`, undefined, MGR)).body.CLOSING.items;
      expect((await api.request('PUT', '/store-cash/checklists', { scope: 'store', storeid: sid, kind: 'CLOSING', items: [...list, { label: s.label }] }, MGR)).status).toBeLessThan(300);
      const again = (await api.request('GET', `/store-cash/checklists/suggestions?scope=store&storeid=${sid}&ai=false`, undefined, MGR)).body;
      expect(again.suggestions.some((x: any) => x.facts.includes('cash_variance'))).toBe(false);
      expect(again.facts.some((x: any) => x.id === 'cash_variance')).toBe(true);                    // the fact is still true; it just has an answer

      // a counter login cannot ask, and the business level works too
      expect((await api.request('GET', `/store-cash/checklists/suggestions?scope=business`, undefined, COUNTER)).status).toBe(403);
      expect((await api.request('GET', `/store-cash/checklists/suggestions?scope=business&ai=false`, undefined, MGR)).status).toBe(200);
    } finally { await wipe(api, sid); }
  });

  test('AIC-2 describing a situation needs the assistant: without it the answer says so, and short text is refused @edge', async ({ api }) => {
    const sid = await freshStore(api);
    try {
      const cfg = (await api.request('GET', `/store-cash/checklists/config?scope=store&storeid=${sid}`, undefined, MGR)).body;
      expect(cfg.assistant).toHaveProperty('configured');
      const draft = (instruction: string, user = MGR) => api.request('POST', '/store-cash/checklists/draft', { scope: 'store', storeid: sid, instruction }, user);
      expect((await draft('the safe was left open', COUNTER)).status).toBe(403);
      if (!cfg.assistant.configured) {
        const none = await draft('the safe was left open overnight twice');
        expect(none.status).toBe(503);
        expect(JSON.stringify(none.body)).toContain('not switched on');
      } else {
        expect((await draft('hi')).status).toBe(400);                                                // refused before any model is called
      }
    } finally { await wipe(api, sid); }
  });

  test('AIC-3 the Checklists tab shows the evidence, adds a suggestion to the draft without saving it, and describes a situation when the assistant is on @happy', async ({ api, app }) => {
    const sid = await freshStore(api);
    const stores = (await api.request('GET', '/stores', undefined, MGR)).body as any[];
    const mine = stores.find((s) => s.id === sid);
    try {
      const { page } = await app.open(MGR, '/secure/settings/store');
      // the assistant is made to look on, and the replies are stood in for: no model is called
      await page.route('**/store-cash/checklists/config**', async (route) => {
        const res = await route.fetch();
        const body = await res.json();
        await route.fulfill({ response: res, json: { ...body, assistant: { configured: true, model: 'test/model' } } });
      });
      await page.route('**/store-cash/checklists/suggestions**', (route) => route.fulfill({ json: {
        days: 30,
        facts: [{ id: 'cash_variance', text: 'The cash drawer was out by more than ₹1 at 6 of 20 closings in the last 30 days.' }],
        suggestions: [{ list: 'CLOSING', label: 'QA count the drawer twice', reason: 'The cash drawer was out by more than ₹1 at 6 of 20 closings in the last 30 days.', facts: ['cash_variance'], source: 'ai' }],
        assistant: { configured: true, model: 'test/model', used: true }, note: null,
      } }));
      await page.route('**/store-cash/checklists/draft', (route) => route.fulfill({ json: {
        suggestions: [{ list: 'OPENING', label: 'QA safe checked locked on arrival', reason: 'The safe was left open twice.', facts: [], source: 'ai' }],
        assistant: { configured: true, model: 'test/model', used: true },
      } }));

      await page.getByTestId('store-s-select').selectOption({ label: `${mine.business?.name} - ${mine.location}` });
      await page.getByTestId('store-s-tab-checklists').click();
      await expect(page.getByTestId('store-ck-assist')).toBeVisible();

      await page.getByTestId('store-ck-suggest').click();
      await expect(page.getByTestId('store-ck-facts')).toContainText('6 of 20 closings');
      await expect(page.getByTestId('store-ck-sug-0')).toContainText('QA count the drawer twice');
      await expect(page.getByTestId('store-ck-sug-0')).toContainText('Closing the store');
      await page.getByTestId('store-ck-sug-add-0').click();
      await expect(page.getByTestId('store-ck-sug-add-0')).toHaveText('Added');
      await expect(page.getByTestId('store-ck-CLOSING').locator('input').last()).toHaveValue('QA count the drawer twice');
      const before = (await api.request('GET', `/store-cash/checklists?storeid=${sid}`, undefined, MGR)).body.CLOSING;
      expect(before.source).toBe('default');                                                        // added to the draft, not saved
      await page.getByTestId('store-ck-save-CLOSING').click();
      await expect(page.getByTestId('store-ck-source-CLOSING')).toHaveText("This store's own list");
      expect((await api.request('GET', `/store-cash/checklists?storeid=${sid}`, undefined, MGR)).body.CLOSING.items.map((i: any) => i.label)).toContain('QA count the drawer twice');

      await page.getByTestId('store-ck-situation').fill('the safe was left open overnight twice');
      await page.getByTestId('store-ck-describe').click();
      await expect(page.getByTestId('store-ck-sug-0')).toContainText('QA safe checked locked on arrival');
      await expect(page.getByTestId('store-ck-sug-0')).toContainText('Opening the store');
    } finally { await wipe(api, sid); }
  });
});
