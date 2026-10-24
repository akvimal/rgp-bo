/**
 * Opening a shift: the checklist depends on whether the store is already open - SO-1..2
 * The first shift of the day unlocks and checks the terminals and the deposit; a shift taken up while the store is open (a handover,
 * a later shift, a second person) counts the drawer it takes over, signs in, and reads the handover notes.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

test.describe('Opening a shift @p1', () => {
  test('SO-1 the server says whether the store is already open, and only insists on the float count @happy', async ({ api }) => {
    const store = await api.request('POST', '/stores', { location: `SO ${Date.now()}`, depositthreshold: 9000, isActive: true }, MGR);
    expect(store.status).toBeLessThan(300);
    const sid = store.body.id as number;
    const ctx = async () => (await api.request('GET', `/store-cash/opening-context?storeid=${sid}`, undefined, MGR)).body;

    expect((await ctx()).storealreadyopen).toBe(false);                                               // nothing has happened here today

    const bad = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 500, name: 'so', openingchecklist: [] }, MGR);
    expect(bad.status).toBe(400);                                                                     // the count is what must be ticked
    expect(JSON.stringify(bad.body)).toContain('float_counted');

    const open = await api.request('POST', '/store-cash/shifts', { storeid: sid, openingcash: 500, name: 'so', openingchecklist: ['float_counted'] }, MGR);
    expect(open.status, JSON.stringify(open.body)).toBeLessThan(300);                                 // the shorter list a taken-up shift has is accepted
    let c = await ctx();
    expect(c).toMatchObject({ storealreadyopen: true, reason: 'OPEN_SHIFT' });

    const me = (await api.request('GET', '/auth/me', undefined, MGR)).body.id;
    const closed = await api.request('PUT', `/store-cash/shifts/${open.body.id}/close`, { countedcash: 500, closedoperatorid: me, closetype: 'END_OF_DAY', closingchecklist: ['drawer_counted', 'cash_secured'] }, MGR);
    expect(closed.status, JSON.stringify(closed.body)).toBeLessThan(300);
    c = await ctx();
    expect(c).toMatchObject({ storealreadyopen: true, reason: 'EARLIER_TODAY' });                    // closed, but the store was opened today
    expect(c.previous.name).toBe('so');
  });

  test('SO-2 the page offers the full list for the first shift of the day and the shorter one when the store is open @happy', async ({ app }) => {
    const { page } = await app.open(CASHIER, '/secure/shift', { operatorId: 3, operatorName: 'Sale Staff One' });
    let context: any = { storealreadyopen: false, reason: null, previous: null };
    await page.route('**/store-cash/shifts?**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.continue());   // no shift is open
    await page.route('**/store-cash/opening-context**', (r) => r.fulfill({ json: context }));
    await page.reload();

    await page.getByTestId('shift-card-open').click();
    const first = page.getByTestId('shiftdesk-open-form');
    await expect(first).toBeVisible();
    for (const k of ['float_counted', 'previous_reconciled', 'prior_deposit_secured', 'entrance_unlocked', 'terminal_working', 'digital_machine_ready']) {
      await expect(first.getByTestId(`shift-checklist-${k}`), k).toBeVisible();
    }
    await expect(first.getByTestId('shift-checklist-handover_notes')).toHaveCount(0);
    await expect(page.getByTestId('shiftdesk-open-continuing')).toHaveCount(0);
    await first.getByRole('button', { name: 'Cancel' }).click();

    context = { storealreadyopen: true, reason: 'HANDOVER', previous: { name: 'Morning', status: 'CLOSED', closetype: 'HANDOVER', handoverto: 'Sale Staff One' } };
    await page.getByTestId('shift-card-open').click();
    const next = page.getByTestId('shiftdesk-open-form');
    await expect(next).toBeVisible();
    await expect(page.getByTestId('shiftdesk-open-continuing')).toContainText('handed over');
    for (const k of ['float_counted', 'previous_reconciled', 'signed_in', 'digital_machine_ready', 'handover_notes']) {
      await expect(next.getByTestId(`shift-checklist-${k}`), k).toBeVisible();
    }
    await expect(next.getByTestId('shift-checklist-entrance_unlocked')).toHaveCount(0);               // the door is open already
    await expect(next.getByTestId('shift-checklist-prior_deposit_secured')).toHaveCount(0);
    await expect(next.locator('input[type=checkbox]')).toHaveCount(5);
  });

  test('SO-3 the page shows the list the business or the store has written, not the built-in one @happy', async ({ app }) => {
    const { page } = await app.open(CASHIER, '/secure/shift', { operatorId: 3, operatorName: 'Sale Staff One' });
    const custom = {
      OPENING: { source: 'business', items: [{ key: 'float_counted', label: 'QA count the float' }, { key: 'c_a1b2c3', label: 'QA our own check' }] },
      OPENING_OPEN_STORE: { source: 'default', items: [] }, CLOSING: { source: 'default', items: [] }, HANDOVER: { source: 'default', items: [] },
    };
    await page.route('**/store-cash/shifts?**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.continue());
    await page.route('**/store-cash/opening-context**', (r) => r.fulfill({ json: { storealreadyopen: false, reason: null, previous: null } }));
    await page.route('**/store-cash/checklists?**', (r) => r.fulfill({ json: custom }));
    await page.reload();
    await page.getByTestId('shift-card-open').click();
    const form = page.getByTestId('shiftdesk-open-form');
    await expect(form.locator('label[for="open-c_a1b2c3"]')).toContainText('QA our own check');
    await expect(form.locator('label[for="open-float_counted"]')).toContainText('QA count the float');
    await expect(form.locator('input[type=checkbox]')).toHaveCount(2);
    await expect(form.getByTestId('shift-checklist-entrance_unlocked')).toHaveCount(0);          // not the built-in list
  });

  test('SO-4 the page sends the moment each item was ticked along with the ticks @happy', async ({ app }) => {
    const { page } = await app.open(CASHIER, '/secure/shift', { operatorId: 3, operatorName: 'Sale Staff One' });
    let sent: any = null;
    await page.route('**/store-cash/shifts?**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.continue());
    await page.route('**/store-cash/opening-context**', (r) => r.fulfill({ json: { storealreadyopen: false, reason: null, previous: null } }));
    await page.route('**/store-cash/shifts', (r) => {
      if (r.request().method() !== 'POST') return r.continue();
      sent = r.request().postDataJSON();
      return r.fulfill({ status: 400, json: { message: 'stopped by the test' } });
    });
    await page.reload();
    await page.getByTestId('shift-card-open').click();
    const form = page.getByTestId('shiftdesk-open-form');
    const before = Date.now();
    const boxes = form.locator('input[type=checkbox]');
    await expect(boxes).toHaveCount(6);
    for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
    const unticked = boxes.first();
    await unticked.uncheck();                                                                     // taking one back removes its time
    await unticked.check();
    await page.getByTestId('shift-card-open-confirm').click();
    await page.getByRole('button', { name: 'Open with Rs 0' }).click();
    await expect.poll(() => sent).not.toBeNull();
    expect(sent.openingchecklist).toHaveLength(6);
    expect(Object.keys(sent.openingchecklistat).sort()).toEqual([...sent.openingchecklist].sort());   // a time for every ticked item
    for (const t of Object.values(sent.openingchecklistat) as string[]) {
      expect(Date.parse(t)).toBeGreaterThanOrEqual(before - 1000);
      expect(Date.parse(t)).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });
});
