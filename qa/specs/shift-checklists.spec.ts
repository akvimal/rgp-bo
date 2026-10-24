/**
 * The shift checklists, set by the business and by a store - CKL-1..3
 * Four lists (opening, taking up a shift while the store is open, closing, handover). A store's own list replaces the business's, which
 * replaces the standard one. The server insists only on the counts that matter and are still on the list in force.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const KINDS = ['OPENING', 'OPENING_OPEN_STORE', 'CLOSING', 'HANDOVER'];

const effective = async (api: any, sid: number) => (await api.request('GET', `/store-cash/checklists?storeid=${sid}`, undefined, MGR)).body;
const freshStore = async (api: any) => {
  const s = await api.request('POST', '/stores', { location: `CKL ${Date.now()}${Math.floor(Math.random() * 90 + 10)}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return s.body.id as number;
};
const wipe = async (api: any, sid: number) => {
  for (const kind of KINDS) {
    await api.request('DELETE', `/store-cash/checklists?scope=store&storeid=${sid}&kind=${kind}`, undefined, MGR);
    await api.request('DELETE', `/store-cash/checklists?scope=business&kind=${kind}`, undefined, MGR);
  }
};

test.describe('Shift checklists @p1', () => {
  test('CKL-1 the lists fall back from the store to the business to the standard, are edited by a Business Head only, and are checked @happy', async ({ api }) => {
    const sid = await freshStore(api);
    try {
      const std = await effective(api, sid);
      for (const k of KINDS) expect(std[k].source, k).toBe('default');
      expect(std.CLOSING.items.map((i: any) => i.key)).toEqual(['drawer_counted', 'expenses_recorded', 'digital_received', 'cash_secured']);
      expect(std.OPENING.items.map((i: any) => i.key)).toContain('digital_machine_ready');

      // a counter login can read the lists in force but not edit them
      expect((await api.request('GET', `/store-cash/checklists?storeid=${sid}`, undefined, COUNTER)).status).toBe(200);
      expect((await api.request('GET', '/store-cash/checklists/config?scope=business', undefined, COUNTER)).status).toBe(403);
      expect((await api.request('PUT', '/store-cash/checklists', { scope: 'business', kind: 'CLOSING', items: [{ label: 'Anything at all' }] }, COUNTER)).status).toBe(403);

      // the business writes a list; stores follow it
      const biz = await api.request('PUT', '/store-cash/checklists', { scope: 'business', kind: 'CLOSING', items: [{ key: 'drawer_counted', label: 'Drawer counted twice' }, { label: 'Back office locked' }] }, MGR);
      expect(biz.status, JSON.stringify(biz.body)).toBeLessThan(300);
      let e = await effective(api, sid);
      expect(e.CLOSING.source).toBe('business');
      expect(e.CLOSING.items.map((i: any) => i.label)).toEqual(['Drawer counted twice', 'Back office locked']);
      expect(e.CLOSING.items[0].key).toBe('drawer_counted');                                     // a reworded standard item keeps its key
      expect(e.CLOSING.items[1].key).toMatch(/^c_[0-9a-f]{6}$/);                                   // a new one gets its own
      expect(e.OPENING.source).toBe('default');                                                   // other lists are untouched

      // the store writes its own, which replaces the business's
      expect((await api.request('PUT', '/store-cash/checklists', { scope: 'store', storeid: sid, kind: 'CLOSING', items: [{ key: 'drawer_counted', label: 'Count the drawer' }] }, MGR)).status).toBeLessThan(300);
      e = await effective(api, sid);
      expect(e.CLOSING.source).toBe('store');
      expect(e.CLOSING.items).toHaveLength(1);
      const cfg = (await api.request('GET', `/store-cash/checklists/config?scope=store&storeid=${sid}`, undefined, MGR)).body;
      expect(cfg.lists.CLOSING.own).toBe(true);
      expect(cfg.lists.OPENING.own).toBe(false);
      expect(cfg.lists.OPENING.inheritedfrom).toBe('default');

      // taken back: the store follows the business again, and the business the standard list
      await api.request('DELETE', `/store-cash/checklists?scope=store&storeid=${sid}&kind=CLOSING`, undefined, MGR);
      expect((await effective(api, sid)).CLOSING.source).toBe('business');
      await api.request('DELETE', '/store-cash/checklists?scope=business&kind=CLOSING', undefined, MGR);
      expect((await effective(api, sid)).CLOSING.source).toBe('default');

      // what is written is checked
      const put = (items: any, kind = 'CLOSING') => api.request('PUT', '/store-cash/checklists', { scope: 'business', kind, items }, MGR);
      expect((await put([{ label: 'ab' }])).status).toBe(400);                                    // too short
      expect((await put([{ label: 'Same thing' }, { label: 'same thing' }])).status).toBe(400);   // twice
      expect((await put(Array.from({ length: 16 }, (_, i) => ({ label: `Item number ${i}` })))).status).toBe(400);
      expect((await put([{ label: 'Fine item' }], 'LUNCH')).status).toBe(400);                    // not a list
      expect((await put([])).status).toBeLessThan(300);                                           // an empty list is allowed: nothing to tick
      expect((await effective(api, sid)).CLOSING.items).toEqual([]);
    } finally { await wipe(api, sid); }
  });

  test('CKL-2 the server insists only on the counts that are still on the list in force @edge', async ({ api }) => {
    const sid = await freshStore(api);
    const me = (await api.request('GET', '/auth/me', undefined, MGR)).body.id;
    try {
      const open = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 300, name: 'ckl', openingchecklist: ['float_counted'] }, MGR);
      expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);
      const close = (keys: string[]) => api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, { countedcash: 300, closedoperatorid: me, closetype: 'END_OF_DAY', closingchecklist: keys }, MGR);

      expect((await close(['drawer_counted'])).status).toBe(400);                                 // the standard list needs the cash secured too
      // this store drops "cash secured": it is no longer asked for
      expect((await api.request('PUT', '/store-cash/checklists', { scope: 'store', storeid: sid, kind: 'CLOSING', items: [{ key: 'drawer_counted', label: 'Drawer counted' }, { label: 'Lights off' }] }, MGR)).status).toBeLessThan(300);
      expect((await close([])).status).toBe(400);
      const done = await close(['drawer_counted']);
      expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    } finally { await wipe(api, sid); }
  });

  test('CKL-3 Settings > Store > Checklists edits a store\'s lists and the business\'s, and says where each comes from @happy', async ({ api, app }) => {
    const sid = await freshStore(api);
    const stores = (await api.request('GET', '/stores', undefined, MGR)).body as any[];
    const mine = stores.find((s) => s.id === sid);
    try {
      const { page } = await app.open(MGR, '/secure/settings/store');
      await page.getByTestId('store-s-select').selectOption({ label: `${mine.business?.name} - ${mine.location}` });
      await page.getByTestId('store-s-tab-checklists').click();
      const closing = page.getByTestId('store-ck-CLOSING');
      await expect(closing).toBeVisible();
      await expect(page.getByTestId('store-ck-source-CLOSING')).toHaveText('Standard list');

      await closing.getByTestId('store-ck-add-CLOSING').click();
      await closing.locator('input').last().fill('QA back office locked');
      await closing.getByTestId('store-ck-save-CLOSING').click();
      await expect(page.getByTestId('store-ck-message')).toContainText('Saved');
      await expect(page.getByTestId('store-ck-source-CLOSING')).toHaveText("This store's own list");
      expect((await effective(api, sid)).CLOSING.items.map((i: any) => i.label)).toContain('QA back office locked');

      await closing.getByTestId('store-ck-remove-CLOSING-0').click();                            // take the first standard item off ...
      await closing.getByTestId('store-ck-save-CLOSING').click();
      await expect(page.getByTestId('store-ck-message')).toContainText('Saved');
      expect((await effective(api, sid)).CLOSING.items.map((i: any) => i.key)).not.toContain('drawer_counted');

      await closing.getByTestId('store-ck-reset-CLOSING').click();                               // ... and go back to the business's
      await expect(page.getByTestId('store-ck-source-CLOSING')).toHaveText('Standard list');
      expect((await effective(api, sid)).CLOSING.source).toBe('default');

      // the business's own list
      await page.getByTestId('store-ck-scope').selectOption('business');
      await page.getByTestId('store-ck-add-OPENING').click();
      await page.getByTestId('store-ck-OPENING').locator('input').last().fill('QA business wide item');
      await page.getByTestId('store-ck-save-OPENING').click();
      await expect(page.getByTestId('store-ck-source-OPENING')).toHaveText("The business's list");
      expect((await effective(api, sid)).OPENING.source).toBe('business');                       // the store follows it
    } finally { await wipe(api, sid); }
  });
});
