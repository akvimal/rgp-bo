/**
 * The links in notifications go to the right page with the right content - RAL-1..4.
 * An alert about one report, one to-do, one GST tab or month opens that thing, not the list it is somewhere in.
 */
import { execFileSync } from 'node:child_process';
import { test, expect, data } from '../fixtures/index.js';

const DB = process.env.QA_DB_NAME || 'rgp_qa';
function sql(q: string): string | null {
  try { return execFileSync('docker', ['exec', 'rgp-db-dev', 'psql', '-U', 'rgpapp', '-d', DB, '-At', '-c', q], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim(); } catch { return null; }
}

const MGR = 'businesshead@local.test';
const COUNTER = data.m.users.find((u: any) => u.role === 'Sales Staff')!.email;
let moduleWas: any = null;

const today = () => new Date().toISOString().slice(0, 10);
const alertsFor = async (api: any, who: string, code: string) => {
  await api.request('POST', '/alerts/run', {}, MGR);
  return ((await api.request('GET', '/alerts/notifications?status=open&limit=200', undefined, who)).body.items as any[]).filter((n) => n.code === code);
};

test.describe('Links in notifications @p1', () => {
  test.beforeAll(async ({ api }) => {
    // a person may send 20 reports a day; the test logins send many, so move the earlier ones out of the day
    sql("update app_feedback set created_on = created_on - interval '2 days' where created_on >= now() - interval '1 day'");
    moduleWas = (await api.request('GET', '/businesses/mine/modules', undefined, MGR)).body;
    await api.request('PUT', '/businesses/mine/modules', { feedback: true }, MGR);
  });
  test.afterAll(async ({ api }) => {
    if (moduleWas && moduleWas.feedback === false) await api.request('PUT', '/businesses/mine/modules', { feedback: false }, MGR);
  });

  test('RAL-1 the alerts about a report open that report, for the reporter and for the manager @happy', async ({ app, api }) => {
    const title = `QA link ${Date.now()}`;
    const made = await api.request('POST', '/feedback', { kind: 'question', title, module_id: 'nav-sales', module_title: 'Sales and billing', details: { what: 'QA link check' } }, COUNTER);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const id = made.body.id as number;

    // the manager is told a report is waiting: the link is that report
    const waiting = (await alertsFor(api, MGR, 'feedback_waiting')).find((n) => String(n.title).includes(title));
    expect(waiting, 'the manager is told').toBeTruthy();
    expect(waiting.link).toBe(`/secure/feedback?id=${id}`);
    const m = await app.open(MGR, waiting.link);
    await expect(m.page.getByTestId('fb-detail')).toBeVisible();
    await expect(m.page.getByTestId('fb-title-view')).toHaveText(title);
    await expect(m.page.getByTestId('fb-ticket')).toContainText(`FB-${id}`);
    await expect(m.page.getByTestId('fb-manage')).toBeVisible();                                 // opened as the manager, with the controls
    await m.page.getByTestId('fb-back').click();
    await expect(m.page.getByTestId('fb-inbox')).toBeVisible();                                 // Back returns to the Inbox it came from

    // the reporter is told of the reply: the link is that report too
    await api.request('POST', `/feedback/${id}/reply`, { message: 'Which store do you mean?', wait: true }, MGR);
    const reply = (await alertsFor(api, COUNTER, 'feedback_reply')).find((n) => String(n.title).includes(title));
    expect(reply, 'the reporter is told').toBeTruthy();
    expect(reply.link).toBe(`/secure/feedback?id=${id}`);
    const r = await app.open(COUNTER, reply.link);
    await expect(r.page.getByTestId('fb-title-view')).toHaveText(title);
    await expect(r.page.getByTestId('fb-reply-box')).toBeVisible();
    await expect(r.page.getByTestId('fb-note-reply').first()).toContainText('Which store do you mean?');
  });

  test('RAL-2 a to-do alert opens the to-do list at that to-do, highlighted @happy', async ({ app, api }) => {
    const title = `QA todo link ${Date.now()}`;
    const made = await api.request('POST', '/todos', { title, dueday: today(), duetime: '00:01', priority: 'normal', soondays: 1, escalatedays: 3, needsproof: false }, MGR);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const id = made.body.id as number;
    await api.request('POST', '/alerts/run', {}, MGR);
    const mine = ((await api.request('GET', '/alerts/notifications?status=open&limit=200', undefined, MGR)).body.items as any[]).filter((n) => /^todo_/.test(n.code) && String(n.title).includes(title));
    expect(mine.length, 'the to-do raises an alert').toBeGreaterThan(0);
    for (const n of mine) expect(n.link).toBe(`/secure/todos?id=${id}`);

    const { page } = await app.open(MGR, mine[0].link);
    const row = page.getByTestId(`todo-row-${id}`);
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/list-group-item-warning/);                                    // the one the alert is about
    await expect(row).toContainText(title);
    await api.request('DELETE', `/todos/${id}`, undefined, MGR);
  });

  test('RAL-3 the GST alerts open the Rate changes tab, and the Monthly summary at the month they name @happy', async ({ app, api }) => {
    const rates = await app.open(MGR, '/secure/gst-filing?tab=rates');
    await expect(rates.page.getByTestId('gstr-intro')).toBeVisible();
    await expect(rates.page.getByTestId('gst-tab-rates')).toHaveClass(/active/);

    const months = (await api.request('GET', '/gst/months', undefined, MGR)).body.months as any[];
    test.skip(!months.length, 'no GST months in this database');
    const last = months.length - 1;
    const month = months[last].month;                                                            // not the one it would open by default
    const sum = await app.open(MGR, `/secure/gst-filing?tab=summary&month=${month}`);
    await expect(sum.page.getByTestId('gst-tab-summary')).toHaveClass(/active/);
    await expect(sum.page.getByTestId('gsm-month-row').nth(last)).toHaveClass(/table-active/);   // the month the link names is the open one
    await expect(sum.page.locator('[data-testid=gsm-month-row].table-active')).toHaveCount(1);
    // a tab that does not exist falls back to the first
    const odd = await app.open(MGR, '/secure/gst-filing?tab=nonsense');
    await expect(odd.page.getByTestId('gst-tab-registration')).toHaveClass(/active/);
  });

  test('RAL-4 Open on the Notifications page takes the person to the report the alert is about @happy', async ({ app, api }) => {
    const title = `QA bell link ${Date.now()}`;
    const made = await api.request('POST', '/feedback', { kind: 'problem', title, module_id: 'nav-sales', module_title: 'Sales and billing', details: { what: 'QA link check' } }, COUNTER);
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const id = made.body.id as number;
    await api.request('POST', '/alerts/run', {}, MGR);
    const { page } = await app.open(MGR, '/secure/notifications');
    const item = page.getByTestId('np-item').filter({ hasText: title });
    await expect(item).toBeVisible({ timeout: 20000 });
    await item.getByTestId('np-open').click();
    await expect(page).toHaveURL(new RegExp(`/secure/feedback\\?id=${id}`));
    await expect(page.getByTestId('fb-title-view')).toHaveText(title);
  });
});
