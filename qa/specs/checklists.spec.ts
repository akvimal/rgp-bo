/**
 * Checklists and system tasks — CHK-1..5
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

  test('CHK-5 another business\'s store is refused, and a role without the permission is turned away @negative', async ({ api }) => {
    expect((await api.request('GET', '/checklists?storeid=999999', undefined, OWNER)).status).toBe(400);
    expect([401, 403]).toContain((await api.request('GET', '/checklists', undefined, 'role.readonly@qa.local')).status);
    expect([401, 403]).toContain((await api.request('GET', '/checklists/tasks', undefined, 'role.readonly@qa.local')).status);
  });
});
