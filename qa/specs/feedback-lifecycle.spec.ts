/**
 * Help and feedback: a report has a ticket number and ends with a resolution - RFB-1..4 (step 1 of the lifecycle).
 * A manager resolves with a type and the words the reporter reads; the report is Resolved with that type; the reporter confirms or reopens; a manager closes
 * what has ended; a closed report is read-only; the search finds FB-12.
 */
import { execFileSync } from 'node:child_process';
import { test, expect, data } from '../fixtures/index.js';

const DB = process.env.QA_DB_NAME || 'rgp_qa';
/** ageing a report needs the database: the windows are days long */
function sql(q: string): string | null {
  try { return execFileSync('docker', ['exec', 'rgp-db-dev', 'psql', '-U', 'rgpapp', '-d', DB, '-At', '-c', q], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim(); } catch { return null; }
}
const haveDb = sql('select 1') === '1';

const MGR = 'businesshead@local.test';
const COUNTER = data.m.users.find((u: any) => u.role === 'Sales Staff')!.email;

let moduleWas: any = null;

test.describe('Help and feedback lifecycle @p1', () => {
  test.beforeAll(async ({ api }) => {
    // a person may send 20 reports a day; the test logins send many, so move the earlier ones out of the day
    if (haveDb) sql("update app_feedback set created_on = created_on - interval '2 days' where created_on >= now() - interval '1 day'");
    // the feature is a business module, off until the owner switches it on
    const m = await api.request('GET', '/businesses/mine/modules', undefined, MGR);
    moduleWas = m.body;
    const on = await api.request('PUT', '/businesses/mine/modules', { feedback: true }, MGR);
    expect(on.status).toBeLessThan(300);
  });
  test.afterAll(async ({ api }) => {
    if (moduleWas && moduleWas.feedback === false) await api.request('PUT', '/businesses/mine/modules', { feedback: false }, MGR);
  });

  const send = async (api: any, title: string, kind = 'problem') => {
    const r = await api.request('POST', '/feedback', { kind, title, module_id: 'nav-sales', module_title: 'Sales and billing', details: { what: 'QA lifecycle check', goal: 'QA lifecycle check' }, impact: 'minor' }, COUNTER);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    return r.body.id as number;
  };

  test('RFB-1 a report has a ticket number, and the search finds it by FB-12 @happy', async ({ api }) => {
    const id = await send(api, `QA ticket ${Date.now()}`);
    const one = await api.request('GET', `/feedback/${id}`, undefined, MGR);
    expect(one.body.ticket).toBe(`FB-${id}`);
    for (const q of [`FB-${id}`, `fb${id}`, String(id)]) {
      const found = await api.request('GET', `/feedback/inbox?view=all&q=${encodeURIComponent(q)}`, undefined, MGR);
      expect(found.body.items.map((i: any) => i.id), q).toEqual([id]);
    }
  });

  test('RFB-2 resolving needs a type and the words the reporter reads, and ends the report with that type @integration', async ({ api }) => {
    const id = await send(api, `QA resolve ${Date.now()}`);
    expect((await api.request('POST', `/feedback/${id}/resolve`, { code: 'fixed' }, MGR)).status).toBe(400);              // no words
    expect((await api.request('POST', `/feedback/${id}/resolve`, { code: 'nope', note: 'x' }, MGR)).status).toBe(400);    // not a type
    expect((await api.request('POST', `/feedback/${id}/resolve`, { code: 'duplicate', note: 'same' }, MGR)).status).toBe(400); // needs the number
    expect((await api.request('POST', `/feedback/${id}/resolve`, { code: 'fixed', note: 'x' }, COUNTER)).status).toBe(403);   // the reporter cannot resolve their own
    const ok = await api.request('POST', `/feedback/${id}/resolve`, { code: 'fixed', note: 'Fixed in the next update.' }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const one = await api.request('GET', `/feedback/${id}`, undefined, COUNTER);
    expect(one.body).toMatchObject({ status: 'ANSWERED', status_label: 'Resolved', resolution_code: 'fixed', resolution_label: 'Fixed' });
    expect(one.body.notes.some((n: any) => n.kind === 'STATUS' && n.body === 'Resolved: Fixed')).toBe(true);
    expect(one.body.notes.some((n: any) => n.kind === 'REPLY' && n.body === 'Fixed in the next update.')).toBe(true);
    expect(one.body.can.close).toBe(true);        // the reporter may confirm
    const not = await send(api, `QA not planned ${Date.now()}`, 'suggestion');
    await api.request('POST', `/feedback/${not}/resolve`, { code: 'not_planned', note: 'Out of scope for now.' }, MGR);
    expect((await api.request('GET', `/feedback/${not}`, undefined, MGR)).body).toMatchObject({ status: 'DECLINED', resolution_code: 'not_planned' });
    const dup = await send(api, `QA duplicate ${Date.now()}`);
    await api.request('POST', `/feedback/${dup}/resolve`, { code: 'duplicate', note: 'Same as the first.', duplicate_of: id }, MGR);
    expect((await api.request('GET', `/feedback/${dup}`, undefined, MGR)).body).toMatchObject({ status: 'DUPLICATE', resolution_code: 'duplicate' });
  });

  test('RFB-3 a manager closes what has ended; a closed report is read-only until the reporter reopens it @integration', async ({ api }) => {
    const id = await send(api, `QA close ${Date.now()}`, 'question');
    const early = await api.request('GET', `/feedback/${id}`, undefined, MGR);
    expect(early.body.can).toMatchObject({ resolve: true, closeTicket: false });                  // still open: resolve, not close
    await api.request('POST', `/feedback/${id}/resolve`, { code: 'answered', note: 'Use the Print button.' }, MGR);
    const done = await api.request('GET', `/feedback/${id}`, undefined, MGR);
    expect(done.body.can).toMatchObject({ resolve: false, closeTicket: true });                   // ended: close, not resolve
    expect((await api.request('POST', `/feedback/${id}/status`, { status: 'CLOSED' }, MGR)).status).toBeLessThan(300);
    const closed = await api.request('GET', `/feedback/${id}`, undefined, MGR);
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.resolution_code).toBe('answered');                                         // closing keeps how it ended
    expect(closed.body.can).toMatchObject({ reply: false, resolve: false, closeTicket: false });
    const reporter = await api.request('GET', `/feedback/${id}`, undefined, COUNTER);
    expect(reporter.body.can).toMatchObject({ reply: false, reopen: true });
    expect((await api.request('POST', `/feedback/${id}/reply`, { message: 'one more thing' }, COUNTER)).status).toBe(400);
    expect((await api.request('POST', `/feedback/${id}/reopen`, { message: 'It is still wrong.' }, COUNTER)).status).toBeLessThan(300);
    const back = await api.request('GET', `/feedback/${id}`, undefined, MGR);
    expect(back.body).toMatchObject({ status: 'IN_PROGRESS', resolution_code: null });
  });

  test('RFB-4 the screen: Resolve beside Send, then the ticket shows its resolution, then Close this report @happy', async ({ app, api }) => {
    const title = `QA screen ${Date.now()}`;
    const id = await send(api, title);
    const { page } = await app.open(MGR, '/secure/feedback');
    await page.getByTestId('fb-tab-inbox').click();
    await page.getByTestId(`fb-inbox-${id}`).click();
    await expect(page.getByTestId('fb-ticket')).toContainText(`FB-${id}`);
    await page.getByTestId('fb-resolve-open').click();
    await expect(page.getByTestId('fb-resolve-save')).toBeDisabled();                           // words first
    await page.getByTestId('fb-resolve-code').selectOption('fixed');
    await page.getByTestId('fb-resolve-note').fill('Fixed, thank you.');
    await page.getByTestId('fb-resolve-save').click();
    await expect(page.getByTestId('fb-resolution')).toHaveText('Fixed');
    await expect(page.getByTestId('fb-status')).toHaveText('Resolved');
    await page.getByTestId('fb-close-ticket').click();
    await expect(page.getByTestId('fb-status')).toHaveText('Closed');
    await expect(page.getByTestId('fb-closed')).toBeVisible();
    await expect(page.getByTestId('fb-reply-box')).toHaveCount(0);                              // read-only
  });

  const age = (id: number, days: number) => sql(`update app_feedback set last_activity_on = now() - interval '${days} days' where id = ${id}`);

  test('RFB-5 a question nobody answers closes after 7 days, a finished report after 7 quiet days; a fresh or planned one stays @integration', async ({ api }) => {
    test.skip(!haveDb, 'needs the QA database to age the reports');
    const quiet = await send(api, `QA quiet ${Date.now()}`, 'question');
    await api.request('POST', `/feedback/${quiet}/reply`, { message: 'Which store do you mean?', wait: true }, MGR);
    const fresh = await send(api, `QA fresh ${Date.now()}`, 'question');
    await api.request('POST', `/feedback/${fresh}/reply`, { message: 'Which store do you mean?', wait: true }, MGR);
    const ended = await send(api, `QA ended ${Date.now()}`);
    await api.request('POST', `/feedback/${ended}/resolve`, { code: 'fixed', note: 'Fixed.' }, MGR);
    const planned = await send(api, `QA planned ${Date.now()}`, 'suggestion');
    await api.request('POST', `/feedback/${planned}/status`, { status: 'PLANNED' }, MGR);
    const working = await send(api, `QA working ${Date.now()}`);
    await api.request('POST', `/feedback/${working}/status`, { status: 'IN_PROGRESS' }, MGR);
    age(quiet, 8); age(ended, 8); age(planned, 40); age(working, 40); age(fresh, 2);

    expect((await api.request('POST', '/feedback/sweep', {}, COUNTER)).status).toBe(403);        // the people who answer run it
    const swept = await api.request('POST', '/feedback/sweep', {}, MGR);
    expect(swept.status).toBeLessThan(300);
    expect(swept.body.closed).toBeGreaterThanOrEqual(2);

    const q = (await api.request('GET', `/feedback/${quiet}`, undefined, MGR)).body;
    expect(q).toMatchObject({ status: 'CLOSED', resolution_code: 'no_response', resolution_label: 'No response' });
    expect(q.closed_on).toBeTruthy();
    expect(q.notes.some((n: any) => n.kind === 'STATUS' && /no reply for 7 days/.test(n.body))).toBe(true);
    const e = (await api.request('GET', `/feedback/${ended}`, undefined, MGR)).body;
    expect(e).toMatchObject({ status: 'CLOSED', resolution_code: 'fixed' });                    // how it ended is kept
    expect(e.notes.some((n: any) => n.kind === 'STATUS' && /nothing more for 7 days/.test(n.body))).toBe(true);
    for (const [id, status] of [[fresh, 'WAITING'], [planned, 'PLANNED'], [working, 'IN_PROGRESS']] as const) {
      expect((await api.request('GET', `/feedback/${id}`, undefined, MGR)).body.status, `report ${id}`).toBe(status);
    }
    // the reporter is told: an unread change of status
    expect((await api.request('GET', '/feedback/mine', undefined, COUNTER)).body.items.find((i: any) => i.id === quiet)?.reporter_unread).toBe(true);
    // and a repeat closes nothing more for those two
    const again = await api.request('POST', '/feedback/sweep', {}, MGR);
    expect((await api.request('GET', `/feedback/${quiet}`, undefined, MGR)).body.notes.filter((n: any) => /Closed automatically/.test(n.body)).length).toBe(1);
    expect(again.status).toBeLessThan(300);
  });

  test('RFB-6 a closed report can be reopened for 14 days; after that a follow-up links back to it @integration', async ({ api }) => {
    test.skip(!haveDb, 'needs the QA database to age the reports');
    const id = await send(api, `QA window ${Date.now()}`);
    await api.request('POST', `/feedback/${id}/resolve`, { code: 'answered', note: 'Use the Print button.' }, MGR);
    await api.request('POST', `/feedback/${id}/status`, { status: 'CLOSED' }, MGR);
    // closed just now: reopen is open, a follow-up is not
    let r = (await api.request('GET', `/feedback/${id}`, undefined, COUNTER)).body;
    expect(r.can).toMatchObject({ reopen: true, followup: false });
    expect((await api.request('POST', `/feedback/${id}/follow-up`, { message: 'Still wrong.' }, COUNTER)).status).toBe(400);
    // closed 15 days ago
    sql(`update app_feedback set closed_on = now() - interval '15 days' where id = ${id}`);
    r = (await api.request('GET', `/feedback/${id}`, undefined, COUNTER)).body;
    expect(r.can).toMatchObject({ reopen: false, followup: true });
    expect((await api.request('POST', `/feedback/${id}/reopen`, { message: 'It is still wrong.' }, COUNTER)).status).toBe(400);
    expect((await api.request('POST', `/feedback/${id}/follow-up`, { message: '' }, COUNTER)).status).toBe(400);
    expect((await api.request('POST', `/feedback/${id}/follow-up`, { message: 'Still wrong.' }, MGR)).status).toBe(403);   // only the reporter
    const made = await api.request('POST', `/feedback/${id}/follow-up`, { message: 'It broke again after the update.' }, COUNTER);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const nu = (await api.request('GET', `/feedback/${made.body.id}`, undefined, COUNTER)).body;
    expect(nu).toMatchObject({ follow_up_of: id, follow_up_ticket: `FB-${id}`, module_id: 'nav-sales', status: 'NEW' });
    expect(nu.title).toContain('Follow-up:');
    expect(nu.details.what).toBe('It broke again after the update.');
    const old = (await api.request('GET', `/feedback/${id}`, undefined, COUNTER)).body;
    expect(old.follow_ups.map((f: any) => f.id)).toEqual([made.body.id]);
    expect(old.notes.some((n: any) => n.body === `Follow-up raised: FB-${made.body.id}`)).toBe(true);
  });

  test('RFB-7 a question waiting on the reporter sends a reminder from day 3 @integration', async ({ api }) => {
    test.skip(!haveDb, 'needs the QA database to age the reports');
    const title = `QA reminder ${Date.now()}`;
    const id = await send(api, title, 'question');
    await api.request('POST', `/feedback/${id}/reply`, { message: 'Which store do you mean?', wait: true }, MGR);
    const mine = async () => {
      await api.request('POST', '/alerts/run', {}, MGR);
      return ((await api.request('GET', '/alerts/notifications?status=open&limit=200', undefined, COUNTER)).body.items as any[]).filter((n) => n.code === 'feedback_closing' && String(n.title).includes(title));
    };
    age(id, 1);
    expect((await mine()).length).toBe(0);                          // too soon
    age(id, 4);
    const got = await mine();
    expect(got.length).toBe(1);
    expect(got[0].title).toContain(title);
    expect(got[0].message).toMatch(/3 day/);                           // 7 less the 4 gone
    // the reporter answers: no reminder, and the report is back with the managers
    await api.request('POST', `/feedback/${id}/reply`, { message: 'The Anna Nagar store.' }, COUNTER);
    expect((await mine()).length).toBe(0);
  });

  test('RFB-8 the screen says when a report closes by itself, and offers a follow-up once it cannot be reopened @happy', async ({ app, api }) => {
    test.skip(!haveDb, 'needs the QA database to age the reports');
    const waiting = await send(api, `QA notice ${Date.now()}`, 'question');
    await api.request('POST', `/feedback/${waiting}/reply`, { message: 'Which store?', wait: true }, MGR);
    age(waiting, 2);
    const closed = await send(api, `QA late ${Date.now()}`);
    await api.request('POST', `/feedback/${closed}/resolve`, { code: 'fixed', note: 'Fixed.' }, MGR);
    await api.request('POST', `/feedback/${closed}/status`, { status: 'CLOSED' }, MGR);
    sql(`update app_feedback set closed_on = now() - interval '20 days' where id = ${closed}`);

    const { page } = await app.open(MGR, '/secure/feedback');
    await page.getByTestId('fb-tab-inbox').click();
    await page.getByTestId('fb-view-all').click();
    await page.getByTestId(`fb-inbox-${waiting}`).click();
    await expect(page.getByTestId('fb-closes-in')).toContainText('closes by itself in 5 days');

    // the reporter, a report closed 20 days ago: no reopen, a follow-up instead
    const mine = await app.open(COUNTER, '/secure/feedback');
    await mine.page.getByTestId(`fb-mine-${closed}`).click();
    await expect(mine.page.getByTestId('fb-followup-offer')).toBeVisible();
    await expect(mine.page.getByTestId('fb-reopen-open')).toHaveCount(0);
    await mine.page.getByTestId('fb-followup-open').click();
    await mine.page.getByTestId('fb-followup-msg').fill('It broke again.');
    await mine.page.getByTestId('fb-followup-send').click();
    await expect(mine.page.getByTestId('fb-follows')).toContainText(`FB-${closed}`);
  });
});
