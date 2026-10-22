/**
 * Routine stock audits — SA-1..3
 * A plan makes audits recur; an audit is carried out as a stock count, which completes it with what it found.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';
const COUNTER = 'sales1@local.test';

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function setup(api: any) {
  const o = (await api.request('GET', '/stock-audits/options', undefined, MGR)).body;
  return { store: o.stores[0].id as number, cats: o.categories as string[], staff: o.staff as any[] };
}

test.describe('Stock audits @p1', () => {
  test('SA-1 plans recur: rotating categories, one open audit at a time, skipping needs a reason @happy', async ({ api }) => {
    const s = await setup(api);
    test.skip(s.cats.length < 2, 'the seed has fewer than two product categories');
    const plan = (b: any, who = MGR) => api.request('POST', '/stock-audits/plans', { name: `QA plan ${Date.now()}`, store_id: s.store, scope: 'ROTATE', categories: [s.cats[0], s.cats[1]], frequency_days: 7, first_due: day(-1), ...b }, who);

    expect((await plan({ name: '' })).status).toBe(400);
    expect((await plan({ frequency_days: 0 })).status).toBe(400);
    expect((await plan({ scope: 'ROTATE', categories: [s.cats[0]] })).status).toBe(400);           // a rotation needs two
    expect((await plan({ scope: 'CATEGORY', categories: [s.cats[0], s.cats[1]] })).status).toBe(400);
    expect((await plan({ first_due: 'soon' })).status).toBe(400);
    expect((await plan({ store_id: 99999999 })).status).toBe(400);
    expect((await plan({}, STOREHEAD)).status).toBe(403);                                           // only the Business Head plans
    expect((await plan({}, COUNTER)).status).toBe(403);

    const made = await plan({});
    expect(made.status).toBeLessThan(300);
    const planId = made.body.id;
    const mine = async () => (await api.request('GET', '/stock-audits?status=ALL', undefined, MGR)).body.filter((a: any) => a.plan_id === planId);

    // the first audit is due already; a second is not made while it is open
    const g1 = await api.request('POST', '/stock-audits/generate', {}, MGR);
    expect(g1.body.created).toBeGreaterThan(0);
    let audits = await mine();
    expect(audits.length).toBe(1);
    expect(audits[0]).toMatchObject({ status: 'PLANNED', category: s.cats[0], overdue: true });
    expect((await api.request('POST', '/stock-audits/generate', {}, MGR)).body.created).toBe(0);

    // skipping needs a reason; the next one comes round with the next category
    expect((await api.request('POST', `/stock-audits/${audits[0].id}/skip`, {}, MGR)).status).toBe(400);
    expect((await api.request('POST', `/stock-audits/${audits[0].id}/skip`, { reason: 'stocktake by the auditor instead' }, STOREHEAD)).status).toBe(403);
    expect((await api.request('POST', `/stock-audits/${audits[0].id}/skip`, { reason: 'stocktake by the auditor instead' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', '/stock-audits/generate', {}, MGR)).body.created).toBeGreaterThan(0);
    audits = await mine();
    expect(audits.length).toBe(2);
    const next = audits.find((a: any) => a.status === 'PLANNED');
    expect(next.category).toBe(s.cats[1]);

    // assigning, and who sees what
    const who = s.staff.find((u: any) => u.name);
    expect((await api.request('POST', `/stock-audits/${next.id}/assign`, { assigned_to: 99999999 }, MGR)).status).toBe(400);
    expect((await api.request('POST', `/stock-audits/${next.id}/assign`, { assigned_to: who.id }, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', '/stock-audits', undefined, COUNTER)).status).toBe(403);
    expect((await api.request('GET', '/stock-audits/summary', undefined, MGR)).body.open).toBeGreaterThan(0);

    // switch the plan off so it stops making audits for the other specs
    expect((await api.request('PUT', `/stock-audits/plans/${planId}`, { name: 'QA plan (off)', store_id: s.store, scope: 'ROTATE', categories: [s.cats[0], s.cats[1]], frequency_days: 7, first_due: day(-1), active: false }, MGR)).status).toBeLessThan(300);
    await api.request('POST', `/stock-audits/${next.id}/skip`, { reason: 'QA cleanup' }, MGR);
  });

  test('SA-2 doing an audit is a stock count that completes it @integration', async ({ api }) => {
    const s = await setup(api);
    const made = await api.request('POST', '/stock-audits/plans', { name: `QA count plan ${Date.now()}`, store_id: s.store, scope: s.cats.length ? 'CATEGORY' : 'ALL', categories: s.cats.length ? [s.cats[0]] : [], frequency_days: 30, first_due: day(0) }, MGR);
    expect(made.status).toBeLessThan(300);
    await api.request('POST', '/stock-audits/generate', {}, MGR);
    const audit = (await api.request('GET', '/stock-audits?status=ACTIVE', undefined, MGR)).body.find((a: any) => a.plan_id === made.body.id);
    expect(audit).toBeTruthy();

    const count = (b: any, who = MGR) => api.request('POST', '/stock/counts', { storeid: s.store, category: audit.category, auditid: audit.id, ...b }, who);
    expect((await count({ storeid: s.store + 999 })).status).toBe(400);                     // wrong store
    if (audit.category) expect((await count({ category: 'Not this one' })).status).toBe(400);
    expect((await count({ auditid: 99999999 })).status).toBe(404);

    const started = await count({});
    expect(started.status).toBeLessThan(300);
    let row = (await api.request('GET', '/stock-audits?status=IN_PROGRESS', undefined, MGR)).body.find((a: any) => a.id === audit.id);
    expect(row).toMatchObject({ status: 'IN_PROGRESS', count_id: started.body.count.id });

    // a book quantity counted as one less: the audit records what differed
    const line = started.body.items.find((i: any) => Number(i.balance) > 0);
    const items = line ? [{ itemid: line.item_id, bookqty: Number(line.balance), countedqty: Number(line.balance) - 1 }] : [];
    const done = await api.request('POST', `/stock/counts/${started.body.count.id}/submit`, { items }, MGR);
    expect(done.status).toBeLessThan(300);
    row = (await api.request('GET', '/stock-audits?status=DONE', undefined, MGR)).body.find((a: any) => a.id === audit.id);
    expect(row.status).toBe('DONE');
    expect(row.lines_counted).toBe(items.length);
    if (line) { expect(row.lines_changed).toBe(1); expect(row.variance_units).toBe(-1); expect(row.variance_value).toBeLessThanOrEqual(0); }
    expect((await api.request('GET', '/stock-audits/summary', undefined, MGR)).body.done_this_month).toBeGreaterThan(0);
    expect((await count({})).status).toBe(400);                                              // finished: cannot be counted again

    await api.request('PUT', `/stock-audits/plans/${made.body.id}`, { name: 'QA count plan (off)', store_id: s.store, scope: audit.category ? 'CATEGORY' : 'ALL', categories: audit.category ? [audit.category] : [], frequency_days: 30, first_due: day(0), active: false }, MGR);
  });

  test('SA-3 the Stock audits page and who sees it @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/stock-audits');
    await expectShell(page);
    await expect(page.getByTestId('nav-stock-audits')).toBeVisible();
    await expect(page.getByTestId('sa-tab-plans')).toBeVisible();
    await page.getByTestId('sa-tab-plans').click();
    await page.getByTestId('sa-plan-add').click();
    await expect(page.getByTestId('sa-plan-form')).toBeVisible();
    await page.getByTestId('sa-p-scope').selectOption('ROTATE');
    await expect(page.getByTestId('sa-p-cats')).toBeVisible();
    await page.getByTestId('sa-p-scope').selectOption('ALL');
    await expect(page.getByTestId('sa-p-cats')).toHaveCount(0);

    const sh = await app.open(STOREHEAD, '/secure/stock-audits');
    await expectShell(sh.page);
    await expect(sh.page.getByTestId('sa-tab-plans')).toHaveCount(0);                  // plans are the Business Head's
    const cn = await app.open(COUNTER, '/secure/dashboard');
    await expect(cn.page.getByTestId('nav-stock-audits')).toHaveCount(0);
  });
});
