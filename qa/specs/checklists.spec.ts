/**
 * Checklists and system tasks — CHK-1..7
 * Filling a list in is for everyone who bills (checklists.view); setting lists and recurring tasks up is admin work (checklistsetup.manage): a Store Head
 * for their own stores, the owner roles for any store or the whole business.
 * The outage kit page was taken apart: the weekly check became one of several configurable store checklists, the price list and procedure stand
 * alone, the outage log is gone, and the weekly and monthly jobs are repeating to-dos the system keeps for each store.
 */
import { test, expect } from '../fixtures/index.js';

const HEAD = 'storehead@local.test';
const OWNER = 'businesshead@local.test';
const SALES = 'sales1@local.test';

test.describe('Checklists @p1', () => {
  test('CHK-1 Sales Staff fills in the outage list: a missing item keeps it incomplete, the price list ticks itself @happy', async ({ api }) => {
    const ov = await api.request('GET', '/checklists', undefined, SALES);
    expect(ov.status).toBe(200);
    expect(ov.body.lists.map((l: any) => l.key)).toEqual(expect.arrayContaining(['outage_readiness', 'opening', 'closing', 'monthly_housekeeping']));
    const outage = ov.body.lists.find((l: any) => l.key === 'outage_readiness');
    expect(outage.items.length).toBe(9);
    const sid = ov.body.store.id;
    const ticks = Object.fromEntries(outage.items.map((i: any) => [i.key, true]));

    // print the list so the automatic item can be ticked by the system
    const raw = await api.raw(SALES);
    expect((await raw.get('/outage/price-list?format=pdf')).status).toBe(200);

    const partial = await api.request('POST', '/checklists/outage_readiness/run', { storeid: sid, ticks: { ...ticks, light: false }, values: { bill_book: 'M-0001' } }, SALES);
    expect(partial.status, JSON.stringify(partial.body)).toBeLessThan(300);
    expect(partial.body.complete).toBe(false);

    const noBook = await api.request('POST', '/checklists/outage_readiness/run', { storeid: sid, ticks, values: {} }, SALES);
    expect(noBook.body.complete).toBe(false);                       // the bill book number is part of the list

    const done = await api.request('POST', '/checklists/outage_readiness/run', { storeid: sid, ticks, values: { bill_book: 'M-0001' } }, SALES);
    expect(done.body.complete).toBe(true);
    const after = (await api.request('GET', `/checklists?storeid=${sid}`, undefined, SALES)).body;
    const l = after.lists.find((x: any) => x.key === 'outage_readiness');
    expect(l.current).toBe(true);
    expect(l.dayssince).toBe(0);
    expect(after.pricelist.fresh).toBe(true);
    const hist = (await api.request('GET', `/checklists/outage_readiness/history?storeid=${sid}`, undefined, SALES)).body.items;
    expect(hist.length).toBeGreaterThanOrEqual(3);
  });

  test('CHK-2 the price list is a PDF or an Excel file, the procedure a PDF, and the old outage log is gone @happy', async ({ api }) => {
    const raw = await api.raw(SALES);
    const pdf = await raw.get('/outage/price-list?format=pdf');
    expect(pdf.status).toBe(200);
    expect(Buffer.from(await pdf.arrayBuffer()).slice(0, 4).toString()).toBe('%PDF');
    const xlsx = await raw.get('/outage/price-list?format=xlsx');
    expect(Buffer.from(await xlsx.arrayBuffer()).slice(0, 2).toString()).toBe('PK');
    expect((await raw.get('/outage/procedure')).status).toBe(200);
    const last = await api.request('GET', '/outage/price-list/last', undefined, SALES);   // what the Products > Prices panel shows
    expect(last.status).toBe(200);
    expect(last.body.lastprint.fresh).toBe(true);
    expect(last.body.lastprint.by).toBeTruthy();
    expect((await api.request('GET', '/outage/status', undefined, SALES)).status).toBe(404);
    expect((await api.request('POST', '/outage/events', { cause: 'POWER' }, SALES)).status).toBe(404);
  });

  test('CHK-3 a Store Head changes a store list, and puts it back; Sales Staff and the business scope are refused @edge', async ({ api }) => {
    const sid = (await api.request('GET', '/checklists', undefined, HEAD)).body.store.id;
    expect((await api.request('GET', '/checklists', undefined, HEAD)).body.canedit).toBe(true);

    const items = [{ label: 'The shutter is up' }, { label: 'Last bill number', kind: 'text' }];
    const bad = await api.request('PUT', '/checklists/opening', { storeid: sid, items: [] }, HEAD);
    expect(bad.status).toBe(400);
    expect((await api.request('PUT', '/checklists/opening', { storeid: sid, items }, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/checklists/opening', { storeid: sid, scope: 'business', items }, HEAD)).status).toBe(403);
    // the owner may also set a list up for every store, and take it back
    expect((await api.request('PUT', '/checklists/opening', { scope: 'business', items }, OWNER)).status).toBeLessThan(300);
    const wide = (await api.request('GET', `/checklists?storeid=${sid}`, undefined, SALES)).body.lists.find((l: any) => l.key === 'opening');
    expect(wide.source).toBe('business');
    expect((await api.request('DELETE', '/checklists/opening?scope=business', undefined, HEAD)).status).toBe(403);
    expect((await api.request('DELETE', '/checklists/opening?scope=business', undefined, OWNER)).status).toBeLessThan(300);

    expect((await api.request('PUT', '/checklists/opening', { storeid: sid, items }, HEAD)).status).toBeLessThan(300);
    const mine = (await api.request('GET', `/checklists?storeid=${sid}`, undefined, HEAD)).body.lists.find((l: any) => l.key === 'opening');
    expect(mine.source).toBe('store');
    expect(mine.items.map((i: any) => i.label)).toEqual(['The shutter is up', 'Last bill number']);
    expect(mine.items[1].kind).toBe('text');

    const added = await api.request('POST', '/checklists', { storeid: sid, title: 'QA weekly mop', items: [{ label: 'Floor mopped' }] }, HEAD);
    expect(added.status, JSON.stringify(added.body)).toBeLessThan(300);
    const custom = (await api.request('GET', `/checklists?storeid=${sid}`, undefined, SALES)).body.lists.find((l: any) => l.key === added.body.key);
    expect(custom.custom).toBe(true);

    expect((await api.request('DELETE', `/checklists/${added.body.key}?storeid=${sid}&scope=store`, undefined, HEAD)).status).toBeLessThan(300);
    expect((await api.request('DELETE', `/checklists/opening?storeid=${sid}&scope=store`, undefined, HEAD)).status).toBeLessThan(300);
    const back = (await api.request('GET', `/checklists?storeid=${sid}`, undefined, HEAD)).body.lists.find((l: any) => l.key === 'opening');
    expect(back.source).toBe('default');
    expect(back.items.length).toBe(5);
  });

  test('CHK-4 the system tasks are kept as repeating store to-dos; a task can be moved or switched off @happy', async ({ api }) => {
    const t = (await api.request('GET', '/checklists/tasks', undefined, HEAD)).body;
    expect(t.tasks.length).toBeGreaterThanOrEqual(8);
    const sid = t.store.id;
    const price = t.tasks.find((x: any) => x.key === 'price_list');
    expect(price.enabled).toBe(true);
    expect(price.next).toBeTruthy();                                  // a repeat exists and knows its next day

    expect((await api.request('PUT', '/checklists/tasks/price_list', { storeid: sid, day: 9 }, HEAD)).status).toBe(400);   // not a weekday
    expect((await api.request('PUT', '/checklists/tasks/price_list', { storeid: sid, day: 4 }, SALES)).status).toBe(403);
    expect((await api.request('GET', '/checklists/tasks', undefined, SALES)).status).toBe(403);                              // reading the setup is part of setting up
    expect((await api.request('PUT', '/checklists/tasks/price_list', { scope: 'business', enabled: true }, HEAD)).status).toBe(403);   // a Store Head sets up their own stores, not the business

    expect((await api.request('PUT', '/checklists/tasks/price_list', { storeid: sid, day: 4 }, HEAD)).status).toBeLessThan(300);
    const moved = (await api.request('GET', `/checklists/tasks?storeid=${sid}`, undefined, HEAD)).body.tasks.find((x: any) => x.key === 'price_list');
    expect(moved.day).toBe(4);
    expect(new Date(moved.next + 'T00:00:00Z').getUTCDay()).toBe(4);

    expect((await api.request('PUT', '/checklists/tasks/price_list', { storeid: sid, enabled: false }, HEAD)).status).toBeLessThan(300);
    const off = (await api.request('GET', `/checklists/tasks?storeid=${sid}`, undefined, HEAD)).body.tasks.find((x: any) => x.key === 'price_list');
    expect(off.enabled).toBe(false);
    expect(off.next).toBeNull();

    // a system repeat cannot be stopped from the to-do list: it is switched off here
    const repeats = (await api.request('GET', '/todos/repeats', undefined, HEAD)).body.items.filter((r: any) => r.system);
    if (repeats.length) expect((await api.request('DELETE', `/todos/repeats/${repeats[0].id}`, undefined, HEAD)).status).toBe(400);

    expect((await api.request('DELETE', `/checklists/tasks/price_list?storeid=${sid}`, undefined, HEAD)).status).toBeLessThan(300);
    const back = (await api.request('GET', `/checklists/tasks?storeid=${sid}`, undefined, HEAD)).body.tasks.find((x: any) => x.key === 'price_list');
    expect(back.enabled).toBe(true);
    expect(back.day).toBe(1);
  });

  test('CHK-6 the order of the checklists: a Store Head keeps the order of a store, the owner sets one for every store, and both can be put back @happy', async ({ api }) => {
    const first = (await api.request('GET', '/checklists', undefined, HEAD)).body;
    const sid = first.store.id;
    const keysOf = async (email: string) => (await api.request('GET', `/checklists?storeid=${sid}`, undefined, email)).body.lists.map((l: any) => l.key);
    const standard = first.lists.map((l: any) => l.key);
    expect(first.ordersource).toBe('default');

    // refused: staff, a Store Head for the business, an empty order, an order of nothing that exists
    expect((await api.request('PUT', '/checklists/order', { storeid: sid, keys: standard }, SALES)).status).toBe(403);
    expect((await api.request('PUT', '/checklists/order', { storeid: sid, scope: 'business', keys: standard }, HEAD)).status).toBe(403);
    expect((await api.request('PUT', '/checklists/order', { storeid: sid, keys: [] }, HEAD)).status).toBe(400);
    expect((await api.request('PUT', '/checklists/order', { storeid: sid, keys: ['nope', 'nada'] }, HEAD)).status).toBe(400);

    // the Store Head reverses the store's order; everyone at the store sees it
    const reversed = [...standard].reverse();
    expect((await api.request('PUT', '/checklists/order', { storeid: sid, keys: reversed }, HEAD)).status).toBeLessThan(300);
    expect(await keysOf(SALES)).toEqual(reversed);
    expect((await api.request('GET', `/checklists?storeid=${sid}`, undefined, SALES)).body.ordersource).toBe('store');
    // a list left out of the order keeps its place at the end
    await api.request('PUT', '/checklists/order', { storeid: sid, keys: ['closing'] }, HEAD);
    const partial = await keysOf(HEAD);
    expect(partial[0]).toBe('closing');
    expect(partial.sort()).toEqual([...standard].sort());

    // put back to the standard order, and nothing is left to put back
    expect((await api.request('DELETE', `/checklists/order?storeid=${sid}&scope=store`, undefined, HEAD)).status).toBeLessThan(300);
    expect(await keysOf(SALES)).toEqual(standard);
    expect((await api.request('DELETE', `/checklists/order?storeid=${sid}&scope=store`, undefined, HEAD)).status).toBe(404);

    // the owner sets an order for every store; a store's own order still wins; both can be taken back
    expect((await api.request('PUT', '/checklists/order', { scope: 'business', keys: ['closing', 'opening'] }, OWNER)).status).toBeLessThan(300);
    expect((await keysOf(SALES))[0]).toBe('closing');
    expect((await api.request('GET', `/checklists?storeid=${sid}`, undefined, SALES)).body.ordersource).toBe('business');
    await api.request('PUT', '/checklists/order', { storeid: sid, keys: ['monthly_housekeeping'] }, HEAD);
    expect((await keysOf(SALES))[0]).toBe('monthly_housekeeping');
    await api.request('DELETE', `/checklists/order?storeid=${sid}&scope=store`, undefined, HEAD);
    expect((await keysOf(SALES))[0]).toBe('closing');
    expect((await api.request('DELETE', '/checklists/order?scope=business', undefined, HEAD)).status).toBe(403);
    expect((await api.request('DELETE', '/checklists/order?scope=business', undefined, OWNER)).status).toBeLessThan(300);
    expect(await keysOf(SALES)).toEqual(standard);
  });

  test('CHK-7 the order is changed on the Settings screen and the Checklists page follows it @happy', async ({ app, api }) => {
    const { page } = await app.open(HEAD, '/secure/settings/checklists');
    await expect(page.getByTestId('cls-lists')).toBeVisible();
    await page.getByTestId('cls-order-open').click();
    await expect(page.getByTestId('cls-order-panel')).toBeVisible();
    await page.getByTestId('cls-order-down-outage_readiness').click();             // outage readiness moves below Opening
    await page.getByTestId('cls-order-save').click();
    await expect(page.getByTestId('cls-message')).toContainText('The order is saved for this store');
    await expect(page.getByTestId('cls-order-line')).toContainText("this store's own order");

    const run = await app.open(HEAD, '/secure/checklists');
    await expect(run.page.getByTestId('cl-lists')).toBeVisible();
    await expect(run.page.locator('[data-testid^="cl-pick-"]').first()).toHaveAttribute('data-testid', 'cl-pick-opening');   // opens on the first in the new order

    const sid = (await api.request('GET', '/checklists', undefined, HEAD)).body.store.id;
    await api.request('DELETE', `/checklists/order?storeid=${sid}&scope=store`, undefined, HEAD);            // leave the store as it was
  });

  test('CHK-5 another business\'s store is refused, and a role without the permission is turned away @negative', async ({ api }) => {
    expect((await api.request('GET', '/checklists?storeid=999999', undefined, OWNER)).status).toBe(400);
    expect([401, 403]).toContain((await api.request('GET', '/checklists', undefined, 'role.readonly@qa.local')).status);
    expect([401, 403]).toContain((await api.request('GET', '/checklists/tasks', undefined, 'role.readonly@qa.local')).status);
  });
});
