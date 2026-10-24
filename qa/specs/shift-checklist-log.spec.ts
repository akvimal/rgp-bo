/**
 * What was ticked at each shift - REC-1..3
 * Opening and closing keep the list as it stood (each item with its wording), which items were ticked and when, and who did it.
 * It shows on the shift report and on the My shift page. A checklist changed later does not rewrite what was recorded.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

const freshStore = async (api: any) => {
  const s = await api.request('POST', '/stores', { location: `REC ${Date.now()}${Math.floor(Math.random() * 90 + 10)}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return s.body.id as number;
};
const wipe = async (api: any, sid: number) => {
  for (const kind of ['OPENING', 'OPENING_OPEN_STORE', 'CLOSING', 'HANDOVER']) {
    await api.request('DELETE', `/store-cash/checklists?scope=store&storeid=${sid}&kind=${kind}`, undefined, MGR);
    await api.request('DELETE', `/store-cash/checklists?scope=business&kind=${kind}`, undefined, MGR);
  }
};
const report = async (api: any, shiftId: number) => (await api.request('GET', `/store-cash/shifts/${shiftId}/report`, undefined, MGR)).body;

test.describe('Shift checklist record @p1', () => {
  test('REC-1 opening and closing record each item with its wording, whether it was ticked, when, and who did it @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const me = (await api.request('GET', '/auth/me', undefined, MGR)).body;
    try {
      const earlier = new Date(Date.now() - 5 * 60000).toISOString();
      const open = await api.request('POST', '/store-cash/shifts', {
        storeid: sid, openingcash: 400, name: 'rec', assigneduserid: me.id,
        openingchecklist: ['float_counted', 'terminal_working'], openingchecklistat: { float_counted: earlier, terminal_working: new Date(Date.now() - 2 * 86400000).toISOString() },
      }, MGR);
      expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);

      let r = await report(api, open.body.id);
      expect(r.checklists).toHaveLength(1);
      const o = r.checklists[0];
      expect(o).toMatchObject({ phase: 'OPEN', kind: 'OPENING', operator: me.fullname, doneby: me.fullname });
      expect(o.items.map((i: any) => i.key)).toEqual(['float_counted', 'previous_reconciled', 'prior_deposit_secured', 'entrance_unlocked', 'terminal_working', 'digital_machine_ready']);
      const byKey = (items: any[], k: string) => items.find((i) => i.key === k);
      expect(byKey(o.items, 'float_counted')).toMatchObject({ ticked: true, label: 'Opening float counted and matches the system' });
      expect(byKey(o.items, 'float_counted').at).toBe(earlier);                                      // the moment it was ticked, as the page reported it
      expect(Math.abs(Date.parse(byKey(o.items, 'terminal_working').at) - Date.now())).toBeLessThan(120000);   // a time far from now is not believed
      expect(byKey(o.items, 'entrance_unlocked')).toMatchObject({ ticked: false, at: null });         // on the list, not ticked
      expect(Date.now() - Date.parse(o.doneon)).toBeLessThan(120000);

      // the My shift page's summary carries it too
      const sm = (await api.request('GET', `/store-cash/shifts/${open.body.id}/summary`, undefined, MGR)).body;
      expect(sm.checklists).toHaveLength(1);

      // the checklist is reworded afterwards: what was recorded keeps its wording
      expect((await api.request('PUT', '/store-cash/checklists', { scope: 'store', storeid: sid, kind: 'OPENING', items: [{ key: 'float_counted', label: 'Float counted twice' }] }, MGR)).status).toBeLessThan(300);

      const close = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, {
        countedcash: 400, closedoperatorid: me.id, closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted', 'cash_secured'],
        closingchecklistat: { drawer_counted: new Date().toISOString() },
      }, MGR);
      expect(close.status, JSON.stringify(close.body)).toBeLessThan(300);
      r = await report(api, open.body.id);
      expect(r.checklists.map((c: any) => c.phase)).toEqual(['OPEN', 'CLOSE']);
      expect(byKey(r.checklists[0].items, 'float_counted').label).toBe('Opening float counted and matches the system');   // the past is not rewritten
      const c = r.checklists[1];
      expect(c).toMatchObject({ kind: 'CLOSING', operator: me.fullname });
      expect(c.items.filter((i: any) => i.ticked).map((i: any) => i.key)).toEqual(['drawer_counted', 'cash_secured']);
      expect(byKey(c.items, 'expenses_recorded')).toMatchObject({ ticked: false });                    // an API caller may skip what the server does not insist on

      // a later shift the same day is "taking up": its own list, and it is recorded as such
      const second = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 400, name: 'rec2', assigneduserid: me.id, openingchecklist: ['float_counted'] }, MGR);
      expect(second.status).toBeLessThan(300);
      const r2 = await report(api, second.body.id);
      expect(r2.checklists[0].kind).toBe('OPENING_OPEN_STORE');
    } finally { await wipe(api, sid); }
  });

  test('REC-2 a shift opened with no checklist sent has nothing recorded @edge', async ({ api }) => {
    const sid = await freshStore(api);
    try {
      const open = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 300, name: 'rec-none' }, MGR);
      expect(open.status).toBeLessThan(300);
      expect((await report(api, open.body.id)).checklists).toEqual([]);
    } finally { await wipe(api, sid); }
  });

  test('REC-3 the shift report shows who ticked what, and when @happy', async ({ api, app }) => {
    const sid = await freshStore(api);
    const me = (await api.request('GET', '/auth/me', undefined, MGR)).body;
    try {
      const open = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 250, name: 'rec-ui', assigneduserid: me.id, openingchecklist: ['float_counted', 'terminal_working'] }, MGR);
      expect(open.status).toBeLessThan(300);
      const { page } = await app.open(MGR, '/secure/store/shifts', { storeId: sid });
      const row = page.locator(`[data-testid=shift-row][data-shift-id="${open.body.id}"]`);
      await expect(row).toBeVisible();
      await row.getByTestId('shift-action').first().click();
      const box = page.getByTestId('shift-report-checklist-OPEN');
      await expect(box).toBeVisible();
      await expect(box).toContainText('Opening the store');
      await expect(box).toContainText(`by ${me.fullname}`);
      await expect(box).toContainText('Opening float counted and matches the system');
      await expect(box).toContainText('Entrance shutter/door unlocked');
      await expect(box).toContainText('not ticked');                                                  // what was left unticked is said so
      await expect(box.locator('.bi-check-circle-fill')).toHaveCount(2);

    } finally { await wipe(api, sid); }
  });

  test('REC-4 the My shift page lists what was ticked under the open shift @happy', async ({ api, app }) => {
    const CASHIER = 'sales1@local.test';
    const stock = (await api.request('POST', '/stock/filter', { available: true, limit: 50 }, CASHIER)).body.find((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 5 && Number(x.sale_price) > 0);
    const now = new Date().toISOString();
    const made = await api.request('POST', '/sales', {
      billdate: now, orderdate: now, cashamt: 10, digiamt: 0, total: 10, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      items: [{ itemid: stock.item_id, productid: stock.id, batch: stock.batch, price: 10, mrpcost: stock.mrp_cost, taxpcnt: stock.tax_pcnt, qty: 1, total: 10, status: 'Complete' }],
    }, CASHIER);
    expect(made.status).toBeLessThan(300);                                                             // makes sure a shift is open
    const { page } = await app.open(CASHIER, '/secure/shift', { operatorId: 3, operatorName: 'Sale Staff One' });
    // the recorded checklist is stood in for here: what is checked is how the page shows it
    await page.route('**/store-cash/shifts/*/summary', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, checklists: [{
        phase: 'OPEN', kind: 'OPENING', operator: 'Sale Staff One', doneby: 'Sale Staff One', doneon: new Date().toISOString(),
        items: [{ key: 'float_counted', label: 'QA float counted', ticked: true, at: new Date().toISOString() }, { key: 'entrance_unlocked', label: 'QA door unlocked', ticked: false, at: null }],
      }] } });
    });
    await page.reload();
    const desk = page.getByTestId('shiftdesk-checklists');
    await expect(desk).toBeVisible();
    await desk.locator('summary').click();
    const box = page.getByTestId('shiftdesk-checklist-OPEN');
    await expect(box).toContainText('Opening the store');
    await expect(box).toContainText('by Sale Staff One');
    await expect(box).toContainText('QA float counted');
    await expect(box.locator('.bi-check-circle-fill')).toHaveCount(1);
    await expect(box).toContainText('QA door unlocked');
    await expect(box).toContainText('not ticked');
  });
});
