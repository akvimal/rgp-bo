/**
 * Outage kit — OUTAGE-1..4
 * The weekly check of the kit, the printed price list and procedure, and the outage log. Open to everyone who bills (Sales Staff, Counter) and to the
 * people who run the shop; the price list carries no cost.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';

test.describe('Outage kit @p1', () => {
  test('OUTAGE-1 Sales Staff can open the page, and a check is recorded as complete or not @happy', async ({ api }) => {
    const st = await api.request('GET', '/outage/status', undefined, SALES);
    expect(st.status).toBe(200);
    expect(st.body.checklist.length).toBeGreaterThanOrEqual(8);
    expect(st.body.procedure.length).toBeGreaterThan(0);
    const sid = st.body.store.id;
    const all = Object.fromEntries(st.body.checklist.map((i: any) => [i.key, true]));

    const partial = await api.request('POST', '/outage/readiness', { storeid: sid, items: { ...all, light: false }, billbooklast: 'M-0001', note: 'torch missing' }, SALES);
    expect(partial.status).toBeLessThan(300);
    expect(partial.body.complete).toBe(false);

    const done = await api.request('POST', '/outage/readiness', { storeid: sid, items: all, billbooklast: 'M-0001' }, SALES);
    expect(done.body.complete).toBe(true);
    const after = (await api.request('GET', `/outage/status?storeid=${sid}`, undefined, SALES)).body;
    expect(after.ready).toBe(true);
    expect(after.dayssince).toBe(0);
    expect(after.lastcomplete.by_name).toBeTruthy();
  });

  test('OUTAGE-2 the price list is a PDF or an Excel file, and the print is recorded @happy', async ({ api }) => {
    const pdf = await api.raw(SALES);
    const res = await pdf.get('/outage/price-list?format=pdf');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('pdf');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.slice(0, 4).toString()).toBe('%PDF');

    const xlsx = await pdf.get('/outage/price-list?format=xlsx');
    expect(xlsx.status).toBe(200);
    expect(Buffer.from(await xlsx.arrayBuffer()).slice(0, 2).toString()).toBe('PK');

    const proc = await pdf.get('/outage/procedure');
    expect(proc.status).toBe(200);

    const st = (await api.request('GET', '/outage/status', undefined, SALES)).body;
    expect(st.lastprint).toBeTruthy();
    expect(st.lastprint.by).toBeTruthy();
  });

  test('OUTAGE-3 an outage is recorded with its manual bills, checked and corrected @edge', async ({ api }) => {
    const sid = (await api.request('GET', '/outage/status', undefined, MGR)).body.store.id;
    const t0 = new Date(Date.now() - 3 * 3600000).toISOString();
    const t1 = new Date(Date.now() - 2 * 3600000).toISOString();
    const made = await api.request('POST', '/outage/events', { storeid: sid, startedon: t0, endedon: t1, cause: 'POWER', manualfrom: 'M-0010', manualto: 'M-0017', manualcount: 8, note: 'qa' }, SALES);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);

    expect((await api.request('POST', '/outage/events', { storeid: sid, startedon: t1, endedon: t0, cause: 'POWER' }, SALES)).status).toBe(400);   // ends before it starts
    expect((await api.request('POST', '/outage/events', { storeid: sid, startedon: t0, cause: 'FIRE' }, SALES)).status).toBe(400);                   // unknown cause
    expect((await api.request('POST', '/outage/events', { storeid: sid, startedon: new Date(Date.now() + 3 * 86400000).toISOString(), cause: 'POWER' }, SALES)).status).toBe(400);   // the future

    const fix = await api.request('PUT', `/outage/events/${made.body.id}`, { storeid: sid, startedon: t0, endedon: t1, cause: 'POWER', manualcount: 9, manualfrom: 'M-0010', manualto: 'M-0018' }, SALES);
    expect(fix.status).toBeLessThan(300);
    const list = (await api.request('GET', `/outage/status?storeid=${sid}`, undefined, MGR)).body.events;
    expect(list.find((e: any) => e.id === made.body.id).manual_count).toBe(9);
  });

  test("OUTAGE-4 a store of another business is refused, and a role without the permission cannot open the page @negative", async ({ api }) => {
    expect((await api.request('GET', '/outage/status?storeid=999999', undefined, MGR)).status).toBe(400);
    const none = await api.request('GET', '/outage/status', undefined, 'role.readonly@qa.local');
    expect([401, 403]).toContain(none.status);
  });
});
