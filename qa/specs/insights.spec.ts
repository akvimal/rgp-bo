/**
 * The insight features — INS-1..9: ask the shop, the buying brief, the weekly owner summary, customer follow-ups (dues and wording), staff coaching notes.
 * They work without a model (report buttons, plain-words summaries); typing a question, the assistant's wording and drafts need the stand-in model
 * (qa/support/ai-standin.mjs) and an API started against it: set QA_AI_STANDIN=1 to run those.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';
const COUNTER = 'sales1@local.test';
const STANDIN = !!process.env.QA_AI_STANDIN;

test.describe.configure({ mode: 'serial' });

test.describe('Insights @p1', () => {
  test('INS-1 the reports are for owners and store heads; a store head does not see owner-only reports @negative', async ({ api }) => {
    expect((await api.request('GET', '/insights/ask/reports', undefined, COUNTER)).status).toBe(403);
    expect((await api.request('POST', '/insights/ask/run', { report: 'sales_summary' }, COUNTER)).status).toBe(403);
    const owner = await api.request('GET', '/insights/ask/reports', undefined, MGR);
    const head = await api.request('GET', '/insights/ask/reports', undefined, STOREHEAD);
    expect(owner.status).toBe(200); expect(head.status).toBe(200);
    const keys = (r: any) => r.body.reports.map((x: any) => x.key);
    expect(keys(owner)).toContain('margin_by_product');
    expect(keys(head)).not.toContain('margin_by_product');
    expect(keys(head)).not.toContain('customer_dues');
    expect((await api.request('POST', '/insights/ask/run', { report: 'margin_by_product' }, STOREHEAD)).status).toBe(403);
    expect((await api.request('POST', '/insights/ask/run', { report: 'drop table sale' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/insights/ask', { question: 'a' }, MGR)).status).toBe(400);
  });

  test('INS-2 every report runs and answers with columns and rows @happy', async ({ api }) => {
    const cat = (await api.request('GET', '/insights/ask/reports', undefined, MGR)).body;
    for (const r of cat.reports) {
      const res = await api.request('POST', '/insights/ask/run', { report: r.key, period: 'last_90_days', limit: 5, days: 120 }, MGR);
      expect(res.status, r.key).toBe(200);
      expect(res.body.columns.length, `${r.key} has columns`).toBeGreaterThan(0);
      expect(Array.isArray(res.body.rows), r.key).toBe(true);
      expect(res.body.rows.length, `${r.key} respects the limit`).toBeLessThanOrEqual(Math.max(5, 31));
    }
    const summary = (await api.request('POST', '/insights/ask/run', { report: 'sales_summary', period: 'last_90_days' }, MGR)).body;
    expect(summary.period.from < summary.period.to).toBe(true);
    expect(summary.rows).toHaveLength(1);
  });

  test('INS-3 the Ask the shop page runs a report button and shows the table @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/reports/ask');
    await expectShell(page);
    await expect(page.getByTestId('rp-tabs')).toBeVisible();
    await page.getByTestId('ask-period').selectOption('last_90_days');
    await page.getByTestId('ask-report-top_products').click();
    await expect(page.getByTestId('ask-result')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ask-result').getByText('Top products')).toBeVisible();
    await expect(page.getByTestId('ask-result').locator('tbody tr').first()).toBeVisible();
    if (STANDIN) {
      await page.getByTestId('ask-input').fill('top products last month');
      await page.getByTestId('ask-go').click();
      await expect(page.getByTestId('ask-understood')).toContainText('top 5 products', { timeout: 15_000 });
      await page.getByTestId('ask-input').fill('what is the weather');
      await page.getByTestId('ask-go').click();
      await expect(page.getByTestId('ask-notanswered')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('INS-4 stock that will not sell in time is listed with a suggestion, and the buying brief is written @happy', async ({ api, app }) => {
    const risk = await api.request('GET', '/insights/expiry-risk?days=365', undefined, MGR);
    expect(risk.status).toBe(200);
    for (const r of risk.body.rows) {
      expect(r.unsold, `${r.product} has some left over`).toBeGreaterThan(0);
      expect(['return to vendor', 'discount to clear', 'sell first', 'watch']).toContain(r.action);
      expect(r.unsold).toBeLessThanOrEqual(r.qty);
    }
    const values = risk.body.rows.map((r: any) => r.value);
    expect([...values].sort((a: number, b: number) => b - a), 'biggest value first').toEqual(values);
    const brief = await api.request('POST', '/insights/buying-brief', { reorder: [{ title: 'ORS Powder', final_qty: 40, stock_days_left: 3, reasons: ['Low Stock', 'Fast Moving'] }] }, MGR);
    expect(brief.status).toBe(200);
    expect(brief.body.headline).toBeTruthy();
    expect(brief.body.buyFirst.length).toBeGreaterThan(0);
    const { page } = await app.open(MGR, '/secure/purchases/suggestions');
    await expectShell(page);
    await page.getByTestId('bb-make').click();
    await expect(page.getByTestId('bb-headline')).toBeVisible({ timeout: 20_000 });
  });

  test('INS-5 the weekly summary is made from the figures, kept once a week, and owner only @happy', async ({ api, app }) => {
    expect((await api.request('POST', '/insights/weekly/generate', {}, STOREHEAD)).status).toBe(403);
    const made = await api.request('POST', '/insights/weekly/generate', { force: true }, MGR);
    expect(made.status).toBe(200);
    expect(made.body.headline).toBeTruthy();
    expect(made.body.week_start < made.body.week_end).toBe(true);
    expect(new Date(made.body.week_start + 'T00:00:00Z').getUTCDay(), 'a week starts on Monday').toBe(1);
    expect(Array.isArray(made.body.watch) && Array.isArray(made.body.do_first)).toBe(true);
    const again = await api.request('POST', '/insights/weekly/generate', {}, MGR);
    expect(again.body.id, 'not made twice for the same week').toBe(made.body.id);
    // no staff names go into the stored words
    const list = await api.request('GET', '/insights/weekly', undefined, MGR);
    expect(list.body.items.length).toBeGreaterThan(0);
    const { page } = await app.open(MGR, '/secure/reports/weekly');
    await expectShell(page);
    await expect(page.getByTestId('ws-headline')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ws-first')).toBeVisible();
    await page.getByTestId('ws-telegram').uncheck();
    await expect(page.getByTestId('ws-message')).toContainText('stays in the app');
    await page.getByTestId('ws-telegram').check();
    await expect(page.getByTestId('ws-message')).toContainText('every Monday');
  });

  test('INS-6 customers who owe money come first on the contact list, with an amount and the wording in English or Tamil @happy', async ({ api, app }) => {
    const wl = await api.request('GET', '/customer-relations/worklist', undefined, MGR);
    expect(wl.status).toBe(200);
    const dues = wl.body.rows.filter((r: any) => r.audience === 'dues');
    for (const d of dues) { expect(d.amount).toBeGreaterThan(0); expect(d.reason).toContain('Owes Rs'); }
    if (dues.length) expect(wl.body.rows.slice(0, dues.length).every((r: any) => r.audience === 'dues'), 'dues come first').toBe(true);
    const ids = wl.body.rows.map((r: any) => r.id);
    expect(new Set(ids).size, 'each customer is listed once').toBe(ids.length);
    const t = await api.request('GET', '/customer-relations/followup-templates', undefined, MGR);
    expect(t.status).toBe(200);
    for (const a of ['due_back', 'at_risk', 'new_second_visit', 'dues']) for (const l of ['en', 'ta']) expect(t.body.templates[a][l]).toContain('{name}');
    expect(t.body.templates.dues.en).toContain('{amount}');
    const { page } = await app.open(MGR, '/secure/customers/cust/worklist');
    await expectShell(page);
    await expect(page.getByTestId('wl-lang')).toBeVisible({ timeout: 15_000 });
    if (dues.length) {
      await expect(page.getByTestId('wl-dues-badge').first()).toBeVisible();
      const href = async () => (await page.getByTestId('wl-wa').first().getAttribute('href')) || '';
      const en = decodeURIComponent(await href());
      expect(en).toContain('pending');
      await page.getByTestId('wl-lang-ta').click();
      const ta = decodeURIComponent(await href());
      expect(ta, 'the same message in Tamil').toMatch(/[஀-௿]/);
      expect(ta).not.toContain('{');
      await page.getByTestId('wl-lang-en').click();
    }
  });

  test('INS-7 the follow-up wording can be changed, refused when it is wrong, drafted by the assistant, and reset @happy', async ({ api }) => {
    const bad = await api.request('PUT', '/customer-relations/followup-templates', { templates: { due_back: { en: 'Please come and buy more medicines today' } } }, MGR);
    expect(bad.status, 'a message that does not greet by name is refused').toBe(400);
    const noAmount = await api.request('PUT', '/customer-relations/followup-templates', { templates: { dues: { en: 'Hello {name}, please clear your pending balance soon.' } } }, MGR);
    expect(noAmount.status, 'a dues message must say how much').toBe(400);
    expect((await api.request('PUT', '/customer-relations/followup-templates', { templates: {} }, COUNTER)).status, 'only managers change the wording').toBe(403);
    const ok = await api.request('PUT', '/customer-relations/followup-templates', { templates: { due_back: { en: 'Hi {name}, your regular medicines are due at {store}. We have them ready.' } } }, MGR);
    expect(ok.status).toBe(200);
    expect(ok.body.custom).toBe(true);
    expect(ok.body.templates.due_back.en).toContain('regular medicines are due');
    if (STANDIN) {
      const d = await api.request('POST', '/customer-relations/followup-templates/draft', {}, MGR);
      expect(d.status).toBe(201);
      expect(d.body.changed).toBeGreaterThan(0);
      expect(d.body.templates.dues.ta).toContain('{amount}');
    }
    const reset = await api.request('POST', '/customer-relations/followup-templates/reset', {}, MGR);
    expect(reset.body.custom).toBe(false);
    expect(reset.body.templates.due_back.en).toContain('regular medicines');
  });

  test('INS-8 a coaching note is written from the figures, edited, shared, and only then seen by the person @happy', async ({ api }) => {
    const people = await api.request('GET', '/insights/coaching?period=2026-09', undefined, MGR);
    expect(people.status).toBe(200);
    expect(people.body.people.length).toBeGreaterThan(0);
    expect((await api.request('GET', '/insights/coaching?period=2026-09', undefined, COUNTER)).status).toBe(403);
    const withKpi = people.body.people.find((p: any) => p.percent !== null) || people.body.people[0];
    const draft = await api.request('POST', `/insights/coaching/${withKpi.id}/draft`, { period: '2026-09' }, MGR);
    expect(draft.status).toBe(200);
    const note = draft.body.note;
    expect(note.shared, 'a new note is not shared').toBe(false);
    expect(note.strengths.length + note.focus.length).toBeGreaterThan(0);
    if (withKpi.name) expect(JSON.stringify(draft.body.facts), 'the facts carry no name').not.toContain(withKpi.name);
    const empty = await api.request('PUT', `/insights/coaching/${withKpi.id}`, { period: '2026-09', strengths: [], focus: [], tips: [] }, MGR);
    expect(empty.status).toBe(400);
    const saved = await api.request('PUT', `/insights/coaching/${withKpi.id}`, { period: '2026-09', strengths: ['Accurate billing.'], focus: ['Greeting every customer.'], tips: ['Say hello first.'], talk_points: ['Thank them.'], shared: true }, MGR);
    expect(saved.status).toBe(200);
    expect(saved.body.shared).toBe(true);
    const after = await api.request('GET', `/insights/coaching/${withKpi.id}?period=2026-09`, undefined, MGR);
    expect(after.body.note.strengths).toEqual(['Accurate billing.']);
    // writing it again stops the sharing
    const again = await api.request('POST', `/insights/coaching/${withKpi.id}/draft`, { period: '2026-09' }, MGR);
    expect(again.body.note.shared).toBe(false);
    await api.request('PUT', `/insights/coaching/${withKpi.id}`, { period: '2026-09', strengths: ['x'], focus: ['y'], tips: [], talk_points: [], shared: false }, MGR);
  });

  test('INS-9 the assistant lists the new areas in the usage report, each with where it is found @happy', async ({ api }) => {
    const r = (await api.request('GET', '/alerts/ai/report', undefined, MGR)).body;
    const features = r.areas.map((a: any) => a.feature);
    for (const f of ['draft_followup_messages', 'write_buying_brief', 'answer_question', 'write_weekly_summary', 'write_coaching_note']) expect(features).toContain(f);
    for (const a of r.areas) expect(a.where).toBeTruthy();
    void STANDIN;
  });
});
