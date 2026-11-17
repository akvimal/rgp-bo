/**
 * Help and feedback: a report has a ticket number and ends with a resolution - RFB-1..4 (step 1 of the lifecycle).
 * A manager resolves with a type and the words the reporter reads; the report is Resolved with that type; the reporter confirms or reopens; a manager closes
 * what has ended; a closed report is read-only; the search finds FB-12.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = data.m.users.find((u: any) => u.role === 'Sales Staff')!.email;

let moduleWas: any = null;

test.describe('Help and feedback lifecycle @p1', () => {
  test.beforeAll(async ({ api }) => {
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
    expect(ok.status).toBeLessThan(300);
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
});
