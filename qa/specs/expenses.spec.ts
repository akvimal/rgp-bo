/**
 * Expenses — EXP-1..5
 * Business- and store-level expenses with approval: Business Head raises anything (approved at once); Store Head is
 * approved on the spot up to the store limit; counter staff wait for the Store Head; above the limit it is the Business
 * Head's. Recurring entries and a report.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const SH = 'storehead@local.test';
const COUNTER = 'sales1@local.test';

let cat = 0;
let shStore = 0;
let counterStore = 0;

const today = () => new Date().toISOString().slice(0, 10);
const exp = (store: number | null, amount: number, over: Record<string, any> = {}) => ({
  expense_date: today(), store_id: store, category_id: cat, amount, gst_amount: 0, pay_mode: 'BANK', payee: 'QA Vendor', description: 'QA expense', ...over,
});

test.describe('Expenses @p1', () => {
  test('EXP-1 who raises what, and how it is approved @happy', async ({ api }) => {
    cat = (await api.request('GET', '/expenses/categories', undefined, MGR)).body.find((c: any) => c.name === 'Repairs and maintenance').id;
    const shPolicy = (await api.request('GET', '/expenses/policy', undefined, SH)).body;
    const cPolicy = (await api.request('GET', '/expenses/policy', undefined, COUNTER)).body;
    shStore = shPolicy.stores[0].id;
    counterStore = cPolicy.stores[0].id;
    const limit = shPolicy.limit as number;
    expect(limit).toBe(5000);

    // Business Head: any store or business level, approved at once
    const biz = await api.request('POST', '/expenses', exp(null, 1200, { description: 'QA business-level' }), MGR);
    expect(biz.status).toBeLessThan(300);
    expect(biz.body.status).toBe('APPROVED');

    // Store Head: within the limit is approved at once, above it waits for the Business Head
    const small = await api.request('POST', '/expenses', exp(shStore, 800), SH);
    expect(small.body.status).toBe('APPROVED');
    const big = await api.request('POST', '/expenses', exp(shStore, limit + 1), SH);
    expect(big.body.status).toBe('PENDING');

    // counter staff: a store expense waits for the Store Head, and only for their own store
    const mine = await api.request('POST', '/expenses', exp(counterStore, 150, { pay_mode: 'CASH', payee: 'Tea and snacks' }), COUNTER);
    expect(mine.status).toBeLessThan(300);
    expect(mine.body.status).toBe('PENDING');
    const other = (await api.request('GET', '/expenses/policy', undefined, MGR)).body.stores.find((s: any) => s.id !== counterStore);
    if (other) expect((await api.request('POST', '/expenses', exp(other.id, 100), COUNTER)).status).toBe(403);

    // validation
    const post = (b: any) => api.request('POST', '/expenses', b, MGR);
    expect((await post(exp(null, 0))).status).toBe(400);
    expect((await post(exp(null, 100, { gst_amount: 500 }))).status).toBe(400);
    expect((await post(exp(null, 100, { pay_mode: 'BARTER' }))).status).toBe(400);
    expect((await post(exp(null, 100, { category_id: 999999 }))).status).toBe(400);
    expect((await post(exp(null, 100, { expense_date: '2099-01-01' }))).status).toBe(400);
    expect((await post(exp(null, 100, { expense_date: 'yesterday' }))).status).toBe(400);
  });

  test('EXP-2 approval rules: limit, own expense, business level, reasons @edge', async ({ api }) => {
    const limit = (await api.request('GET', '/expenses/policy', undefined, SH)).body.limit as number;
    const decide = (id: number, b: any, who: string) => api.request('POST', `/expenses/${id}/decision`, b, who);

    const within = (await api.request('POST', '/expenses', exp(counterStore, 300), COUNTER)).body.id;
    const above = (await api.request('POST', '/expenses', exp(counterStore, limit + 500), COUNTER)).body.id;
    const own = (await api.request('POST', '/expenses', exp(shStore, limit + 100), SH)).body.id;

    expect((await decide(within, { action: 'approve' }, COUNTER)).status).toBe(403);       // counter staff cannot approve
    expect((await decide(above, { action: 'approve' }, SH)).status).toBe(403);             // above the Store Head's limit
    expect((await decide(own, { action: 'approve' }, SH)).status).toBe(403);               // not their own
    expect((await decide(within, { action: 'reject' }, SH)).status).toBe(400);             // a reason is needed
    expect((await decide(within, { action: 'maybe' }, SH)).status).toBe(400);
    expect((await decide(within, { action: 'approve' }, SH)).status).toBeLessThan(300);
    expect((await decide(within, { action: 'approve' }, SH)).status).toBe(400);            // decided once
    expect((await decide(above, { action: 'approve' }, MGR)).status).toBeLessThan(300);
    expect((await decide(own, { action: 'reject', note: 'QA not needed' }, MGR)).status).toBeLessThan(300);

    const rows = (await api.request('GET', `/expenses?period=${today().slice(0, 7)}`, undefined, MGR)).body.rows;
    expect(rows.find((r: any) => r.id === own).status).toBe('REJECTED');
    expect(rows.find((r: any) => r.id === own).decision_note).toBe('QA not needed');
    expect(rows.find((r: any) => r.id === above).status).toBe('APPROVED');
  });

  test('EXP-3 editing, removing and who sees what @negative', async ({ api }) => {
    const id = (await api.request('POST', '/expenses', exp(counterStore, 90, { payee: 'QA edit me' }), COUNTER)).body.id;
    const edited = await api.request('PUT', `/expenses/${id}`, exp(counterStore, 95, { payee: 'QA edited' }), COUNTER);
    expect(edited.status).toBeLessThan(300);
    expect((await api.request('PUT', `/expenses/${id}`, exp(counterStore, 1), SH)).status).toBe(403);                    // only the raiser (or Business Head)
    expect((await api.request('DELETE', `/expenses/${id}`, undefined, SH)).status).toBe(403);

    const approved = (await api.request('POST', '/expenses', exp(shStore, 70), SH)).body.id;
    expect((await api.request('PUT', `/expenses/${approved}`, exp(shStore, 71), SH)).status).toBe(400);                  // approved is locked
    expect((await api.request('DELETE', `/expenses/${approved}`, undefined, SH)).status).toBe(400);

    // the counter sees only their own; the Store Head sees the store's
    const mineRows = (await api.request('GET', '/expenses', undefined, COUNTER)).body.rows;
    expect(mineRows.length).toBeGreaterThan(0);
    expect(mineRows.every((r: any) => r.raised_by_name)).toBe(true);
    expect(mineRows.find((r: any) => r.id === approved)).toBeUndefined();
    const shRows = (await api.request('GET', '/expenses', undefined, SH)).body.rows;
    expect(shRows.find((r: any) => r.id === id)).toBeTruthy();
    expect(shRows.find((r: any) => r.id === id).can_decide).toBe(true);

    expect((await api.request('DELETE', `/expenses/${id}`, undefined, COUNTER)).status).toBeLessThan(300);
  });

  test('EXP-4 limit, categories, recurring entries and the report are the Business Head\'s @negative', async ({ api }) => {
    for (const who of [SH, COUNTER]) {
      expect((await api.request('PUT', '/expenses/limit', { limit: 1 }, who)).status).toBe(403);
      expect((await api.request('POST', '/expenses/categories', { name: 'QA nope' }, who)).status).toBe(403);
      expect((await api.request('GET', '/expenses/recurring', undefined, who)).status).toBe(403);
    }
    expect((await api.request('GET', '/expenses/report', undefined, COUNTER)).status).toBe(403);
    expect((await api.request('GET', '/expenses/report', undefined, SH)).status).toBe(200);

    const name = 'QA Category ' + Date.now();
    expect((await api.request('POST', '/expenses/categories', { name }, MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', '/expenses/categories', { name: name.toLowerCase() }, MGR)).status).toBe(400);      // no duplicates

    // a higher limit lets the Store Head approve (their own raise) on the spot
    expect((await api.request('PUT', '/expenses/limit', { limit: -5 }, MGR)).status).toBe(400);
    expect((await api.request('PUT', '/expenses/limit', { limit: 8000 }, MGR)).status).toBeLessThan(300);
    expect((await api.request('POST', '/expenses', exp(shStore, 6000), SH)).body.status).toBe('APPROVED');
    expect((await api.request('PUT', '/expenses/limit', { limit: 5000 }, MGR)).status).toBeLessThan(300);

    // recurring: created once per month, waiting for approval
    const bad = await api.request('POST', '/expenses/recurring', { category_id: cat, amount: 0, pay_mode: 'BANK', start_month: '2031-01' }, MGR);
    expect(bad.status).toBe(400);
    const rec = await api.request('POST', '/expenses/recurring', { category_id: cat, store_id: shStore, amount: 12000, payee: 'QA Landlord', pay_mode: 'BANK', day_of_month: 5, start_month: '2031-01' }, MGR);
    expect(rec.status).toBeLessThan(300);
    expect((await api.request('POST', '/expenses/recurring/generate', { period: '2031-03' }, SH)).status).toBe(403);
    const first = await api.request('POST', '/expenses/recurring/generate', { period: '2031-03' }, MGR);
    expect(first.body.created).toBeGreaterThanOrEqual(1);
    expect((await api.request('POST', '/expenses/recurring/generate', { period: '2031-03' }, MGR)).body.created).toBe(0);   // once only
    const made = (await api.request('GET', '/expenses?period=2031-03', undefined, MGR)).body.rows.find((r: any) => r.recurring_id === rec.body.id);
    expect(made.status).toBe('PENDING');
    expect(made.expense_date).toBe('2031-03-05');
    expect(made.amount).toBe(12000);

    // the report counts approved expenses only
    const rep = (await api.request('GET', `/expenses/report?from=${today().slice(0, 8)}01&to=${today()}`, undefined, MGR)).body;
    expect(rep.total).toBeGreaterThanOrEqual(1200 + 800);
    expect(rep.byCategory.find((c: any) => c.name === 'Repairs and maintenance').amount).toBeGreaterThan(0);
    expect(rep.byStore.find((s: any) => s.name === 'Business level').amount).toBeGreaterThanOrEqual(1200);
    expect(rep.byMonth.length).toBeGreaterThan(0);
    expect(rep.pending.n).toBeGreaterThan(0);
  });

  test('EXP-5 the Expenses pages: raise, approve, tabs by role @happy', async ({ app, api }) => {
    const mgr = await app.open(MGR, '/secure/expenses');
    await expectShell(mgr.page);
    await expect(mgr.page.locator('#main h1').first()).toHaveText('Expenses');
    await expect(mgr.page.getByTestId('nav-expenses')).toBeVisible();
    await expect(mgr.page.getByTestId('exp-tab-setup')).toBeVisible();
    await expect(mgr.page.getByTestId('exp-tab-report')).toBeVisible();

    await mgr.page.getByTestId('exp-add').click();
    await mgr.page.getByTestId('exp-d-category').selectOption({ label: 'Repairs and maintenance' });
    await mgr.page.getByTestId('exp-d-amount').fill('2500');
    await mgr.page.getByTestId('exp-d-payee').fill('QA UI Vendor');
    await mgr.page.getByTestId('exp-d-save').click();
    await expect(mgr.page.getByTestId('exp-message')).toContainText('approved');
    await expect(mgr.page.getByTestId('exp-table')).toContainText('QA UI Vendor');

    // a counter expense waits for the Store Head, who approves it on the page
    await api.request('POST', '/expenses', exp(counterStore, 120, { payee: 'QA waits for SH' }), COUNTER);
    const sh = await app.open(SH, '/secure/expenses');
    await expect(sh.page.getByTestId('exp-pending-badge')).toBeVisible();
    const row = sh.page.locator('[data-testid=exp-row]', { hasText: 'QA waits for SH' }).first();
    await row.getByTestId('exp-approve').click();
    await expect(sh.page.getByTestId('exp-message')).toContainText('Approved');
    await expect(sh.page.getByTestId('exp-tab-setup')).toHaveCount(0);

    const counter = await app.open(COUNTER, '/secure/expenses');
    await expect(counter.page.getByTestId('exp-add')).toBeVisible();
    await expect(counter.page.getByTestId('exp-tab-setup')).toHaveCount(0);
    await expect(counter.page.getByTestId('exp-tab-report')).toHaveCount(0);
  });
});
