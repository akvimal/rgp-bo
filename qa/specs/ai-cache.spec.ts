/**
 * Fewer AI requests: the answer cache and the refresh limits - AIC-1..5
 * The buying brief is kept until something new is bought, a question asked twice is answered once, a coaching note is not asked for again with the same figures
 * and an edited one is not replaced without a confirmation, the weekly summary is made again at most once a day, and the Business Head can switch it all off.
 * Needs the stand-in model (qa/support/ai-standin.mjs, with its request counter) and an API started against it: set QA_AI_STANDIN=1.
 *   node qa/support/ai-standin.mjs
 *   AI_PROVIDER=anthropic ANTHROPIC_API_KEY=server-env-key-0000000000000000 ANTHROPIC_BASE_URL=http://localhost:3911 AI_MODEL=claude-haiku-5-5 <start the API>
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STOREHEAD = 'storehead@local.test';
const STANDIN = !!process.env.QA_AI_STANDIN;
const STAND = process.env.QA_AI_STANDIN_URL || 'http://localhost:3911';
const run = Date.now().toString().slice(-7);

test.describe.configure({ mode: 'serial' });
test.skip(!STANDIN, 'needs the stand-in model: set QA_AI_STANDIN=1');

/** how many requests the stand-in model has been asked for, by tool */
const asked = async (tool: string): Promise<number> => ((await (await fetch(`${STAND}/stats`)).json()) as any)[tool] || 0;

async function cacheMode(api: any, mode: string) {
  const s = (await api.request('GET', '/settings?key=ai.cache_mode', undefined, MGR)).body[0];
  expect(s, 'the setting ai.cache_mode exists (migration 178)').toBeTruthy();
  expect((await api.request('PUT', `/settings/${s.id}`, { value: mode }, MGR)).status).toBeLessThan(300);
}

test.beforeAll(async ({ api }) => { await cacheMode(api, 'on'); });
test.afterAll(async ({ api }) => { await cacheMode(api, 'on'); });

const line = (title: string, qty = 5, days = 2) => ({ title, final_qty: qty, stock_days_left: days, reasons: ['low stock'] });
const brief = (api: any, reorder: any[], extra: any = {}) => api.request('POST', '/insights/buying-brief', { reorder, ...extra }, MGR);

test.describe('AI cache @p1', () => {
  test('AIC-1 a buying brief is kept until a new product or a new purchase, and is not refreshed when nothing has changed @happy', async ({ api }) => {
    const a = `QA Alpha ${run}`, b = `QA Beta ${run}`;
    const before = await asked('write_buying_brief');
    const first = await brief(api, [line(a)]);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.source).toBe('assistant');
    expect(first.body.cache).toMatchObject({ fromCache: false, canRefresh: false });
    expect(await asked('write_buying_brief')).toBe(before + 1);

    // the same list again, and with the quantity and days left changed (they drift every day): kept, no request
    const again = await brief(api, [line(a)]);
    expect(again.body.cache.fromCache).toBe(true);
    expect(again.body.headline).toBe(first.body.headline);
    const drifted = await brief(api, [line(a, 40, 9)]);
    expect(drifted.body.cache.fromCache).toBe(true);
    expect(await asked('write_buying_brief')).toBe(before + 1);

    // pressing Refresh when nothing it is based on has changed is refused, and says why
    expect(again.body.cache.refreshReason).toMatch(/Nothing it is based on has changed/);
    const refused = await brief(api, [line(a)], { refresh: true });
    expect(refused.status).toBe(429);
    expect(JSON.stringify(refused.body)).toMatch(/Nothing it is based on has changed/);
    expect(await asked('write_buying_brief')).toBe(before + 1);

    // a new product on the list is a new brief
    const withB = await brief(api, [line(a), line(b)]);
    expect(withB.body.cache.fromCache).toBe(false);
    expect(await asked('write_buying_brief')).toBe(before + 2);

    // a new purchase is a new brief, even with the same list
    const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
    const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-AIC-${run}`, invoicedate: '2026-07-01' }, MGR);
    const prod = await api.request('POST', '/products', { title: `QA AICDRUG ${run}`, taxpcnt: 12, category: 'Analgesic', code: `AC${run}`, pack: 1 }, MGR);
    const it = await api.request('POST', '/purchaseitems', { invoiceid: inv.body.id, productid: prod.body.id, qty: 10, ptrvalue: 70, ptrcost: 70, mrpcost: 100, saleprice: 100, taxpcnt: 12, total: 700, batch: `AC-${run}`, expdate: '2028-12-31' }, MGR);
    const ok = await api.request('PUT', '/purchaseitems', { ids: [it.body.id], values: { status: 'VERIFIED' } }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const afterBuy = await brief(api, [line(a), line(b)]);
    expect(afterBuy.body.cache.fromCache, 'a new purchase makes a new brief').toBe(false);
    expect(await asked('write_buying_brief')).toBe(before + 3);
    expect((await brief(api, [line(a), line(b)])).body.cache.fromCache).toBe(true);
    expect(await asked('write_buying_brief')).toBe(before + 3);
  });

  test('AIC-2 a question asked twice is answered once, however it is typed; a person cannot ask more than twenty an hour @happy', async ({ api }) => {
    const ask = (q: string, who = MGR) => api.request('POST', '/insights/ask', { question: q }, who);
    const before = await asked('answer_question');
    const first = await ask(`show the top products ${run}`);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.answered).toBe(true);
    expect(await asked('answer_question')).toBe(before + 1);
    const same = await ask(`Show the  TOP products ${run}?`);                      // case, spacing and the question mark do not matter
    expect(same.status).toBe(200);
    expect(same.body.understood).toBe(first.body.understood);
    expect(await asked('answer_question')).toBe(before + 1);
    expect((await ask(`show the top products ${run} please`)).status).toBe(200);    // different words: a new request
    expect(await asked('answer_question')).toBe(before + 2);

    // a store head asks many different questions: kept answers are always served, new requests stop at twenty an hour
    // (a fixed question, so a later run in the same day finds it already kept; the person may already be at the limit from an earlier run)
    const own = 'qa store head asks for the top products';
    const firstOwn = (await ask(own, STOREHEAD)).status;
    expect([200, 429]).toContain(firstOwn);
    let refused = 0, made = 0;
    for (let i = 0; i < 24; i++) {
      const r = await ask(`show the top products again number ${i} of ${run}`, STOREHEAD);
      if (r.status === 429) { refused++; expect(JSON.stringify(r.body)).toMatch(/lot of requests/); } else { expect(r.status).toBe(200); made++; }
    }
    expect(refused, 'the twenty-first new request in an hour is refused').toBeGreaterThan(0);
    expect(made).toBeLessThanOrEqual(20);
    if (firstOwn === 200) expect((await ask(own, STOREHEAD)).status, 'an answer already kept is still served').toBe(200);
  });

  test('AIC-3 a coaching note is not asked for again with the same figures, an edited one needs a confirmation, and rewrites are limited @happy', async ({ api }) => {
    // a person and a month that reach the assistant (with no figures at all the note is written in plain words and no request is made)
    test.setTimeout(180_000);
    const months = ['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04'].sort(() => Math.random() - 0.5);
    let id = 0, period = '', before = 0, calledFirst = 0, tries = 0;
    search: for (const m of months) {
      const people = ((await api.request('GET', `/insights/coaching?period=${m}`, undefined, MGR)).body.people as any[]).filter((p) => p.percent !== null);   // with KPI figures
      for (const p of [...people].sort(() => Math.random() - 0.5)) {
        if (++tries > 8) break search;
        const n = await asked('write_coaching_note');
        const r = await api.request('POST', `/insights/coaching/${p.id}/draft`, { period: m, rewrite: true, confirm: true }, MGR);   // whatever an earlier run left is replaced
        if (r.status === 200 && (await asked('write_coaching_note')) === n + 1) { id = p.id; period = m; before = n; calledFirst = 1; break search; }
      }
    }
    if (!id) return test.info().annotations.push({ type: 'note', description: 'no person and month with figures was free of the rewrite limit' });
    const draft = (body: any = {}) => api.request('POST', `/insights/coaching/${id}/draft`, { period, ...body }, MGR);

    // the same figures, no rewrite: the note comes back as it is, with no request
    const kept = await draft();
    expect(kept.status).toBe(200);
    expect(kept.body.cache.fromCache).toBe(true);
    expect((await asked('write_coaching_note')) - before).toBe(calledFirst);

    // the manager edits and shares it: pressing the button again does not touch it, and writing it again needs a confirmation
    const saved = await api.request('PUT', `/insights/coaching/${id}`, { period, strengths: ['Edited by the manager.'], focus: ['Greeting.'], tips: [], talk_points: [], shared: true }, MGR);
    expect(saved.status).toBe(200);
    const untouched = await draft();
    expect(untouched.body.note.strengths).toEqual(['Edited by the manager.']);
    expect(untouched.body.note.shared).toBe(true);
    const unconfirmed = await draft({ rewrite: true });
    expect(unconfirmed.status).toBe(409);
    expect(JSON.stringify(unconfirmed.body)).toMatch(/edited or shared/);
    const after = await api.request('GET', `/insights/coaching/${id}?period=${period}`, undefined, MGR);
    expect(after.body.note.strengths, 'nothing was lost by the refused rewrite').toEqual(['Edited by the manager.']);

    // confirmed rewrites go through up to three a month, then are refused with the reason
    let allowed = 0, refused = 0;
    for (let i = 0; i < 5; i++) {
      const r = await draft({ rewrite: true, confirm: true });
      if (r.status === 429) { refused++; expect(JSON.stringify(r.body)).toMatch(/written again as often as is allowed/); } else { expect(r.status).toBe(200); allowed++; }
    }
    expect(allowed).toBeLessThanOrEqual(3);
    expect(refused).toBeGreaterThan(0);
    await api.request('PUT', `/insights/coaching/${id}`, { period, strengths: ['x'], focus: ['y'], tips: [], talk_points: [], shared: false }, MGR);
  });

  test('AIC-4 the weekly summary is made again at most once a day, and the Monday copy is kept @happy', async ({ api }) => {
    const gen = (force: boolean) => api.request('POST', '/insights/weekly/generate', { force }, MGR);
    const base = await gen(false);                                          // made if it was not, else the one that is kept
    expect(base.status).toBe(200);
    const before = await asked('write_weekly_summary');
    expect((await gen(false)).body.id, 'not made again without being asked').toBe(base.body.id);
    expect(await asked('write_weekly_summary')).toBe(before);

    let ok = 0, refusedAt = 0;
    for (let i = 1; i <= 4 && !refusedAt; i++) {
      const r = await gen(true);
      if (r.status === 429) { refusedAt = i; expect(JSON.stringify(r.body)).toMatch(/written again as often as is allowed/); } else { expect(r.status).toBe(200); ok++; }
    }
    expect(refusedAt, 'making it again is refused by the third time').toBeGreaterThan(0);
    expect(refusedAt).toBeLessThanOrEqual(3);
    expect(await asked('write_weekly_summary')).toBe(before + ok);           // every one that went through asked the model, the refused one did not
    expect((await gen(false)).status, 'the kept summary is still there').toBe(200);
  });

  test('AIC-5 with the cache switched off, every request goes to the assistant as before @edge', async ({ api }) => {
    await cacheMode(api, 'off');
    try {
      const a = `QA Gamma ${run}`;
      const before = await asked('write_buying_brief');
      expect((await brief(api, [line(a)])).status).toBe(200);
      const second = await brief(api, [line(a)]);
      expect(second.status).toBe(200);
      expect(second.body.cache.fromCache).toBe(false);
      expect((await brief(api, [line(a)], { refresh: true })).status, 'no limits when it is off').toBe(200);
      expect(await asked('write_buying_brief')).toBe(before + 3);
    } finally { await cacheMode(api, 'on'); }
  });

  test('AIC-6 on the screens: an edited note asks before it is replaced, and the buying brief says it was kept @happy', async ({ api, app }) => {
    test.setTimeout(150_000);
    // ---- coaching: a shared, edited note is not replaced by pressing "Write it again" without a confirmation
    const list = (await api.request('GET', '/insights/coaching', undefined, MGR)).body;
    const person = (list.people as any[]).find((p) => p.percent !== null) || list.people[0];
    const period = list.period as string;
    const made = await api.request('POST', `/insights/coaching/${person.id}/draft`, { period, rewrite: true, confirm: true }, MGR);   // 429 when the month's rewrites are used up
    const edit = await api.request('PUT', `/insights/coaching/${person.id}`, { period, strengths: [`UI edited ${run}`], focus: ['Greeting.'], tips: [], talk_points: [], shared: true }, MGR);
    if (made.status === 429 && edit.status !== 200) test.skip(true, 'no note to work with: the rewrite limit was used up and none exists');
    expect(edit.status).toBe(200);
    const { page } = await app.open(MGR, '/secure/hr/coaching');
    await page.getByTestId('co-people').getByText(person.name, { exact: false }).first().click();
    await expect(page.getByTestId('co-note')).toBeVisible();
    await expect(page.getByTestId('co-strengths')).toHaveValue(`UI edited ${run}`);
    await page.getByTestId('co-draft').click();
    await expect(page.getByTestId('co-confirm')).toContainText('edited or shared');
    await page.getByTestId('co-confirm-no').click();
    await expect(page.getByTestId('co-confirm')).toHaveCount(0);
    await expect(page.getByTestId('co-strengths')).toHaveValue(`UI edited ${run}`);            // nothing was lost
    await page.getByTestId('co-draft').click();
    await page.getByTestId('co-confirm-yes').click();
    await expect(page.getByTestId('co-confirm')).toHaveCount(0);
    // either the note was written again, or the month's rewrites were used up and it says so
    await expect.poll(async () => (await page.getByTestId('co-error').count()) > 0 || (await page.getByTestId('co-strengths').inputValue()) !== `UI edited ${run}`).toBe(true);
    await api.request('PUT', `/insights/coaching/${person.id}`, { period, strengths: ['x'], focus: ['y'], tips: [], talk_points: [], shared: false }, MGR);

    // ---- the buying brief: when written, and kept (shown only when the assistant wrote it, which needs something to reorder or at risk)
    const brief = await app.open(MGR, '/secure/purchases/suggestions');
    await brief.page.getByTestId('bb-make').click();
    await expect(brief.page.getByTestId('bb-headline')).toBeVisible({ timeout: 20_000 });
    if (await brief.page.getByTestId('bb-cache').count()) {
      await expect(brief.page.getByTestId('bb-cache')).toContainText('Written');
      await expect(brief.page.getByTestId('bb-make')).toContainText('Refresh the brief');
      await expect(brief.page.getByTestId('bb-make')).toBeDisabled();                           // nothing new has been bought: it would come out the same
      await expect(brief.page.getByTestId('bb-why')).toContainText('Nothing it is based on has changed');
    } else {
      test.info().annotations.push({ type: 'note', description: 'the brief was written in plain words (nothing to reorder or at risk here), so there was nothing to keep' });
    }
  });
});
