/**
 * Customers page — CUST-5..9
 * Search, mobile checking, a warning for a number someone else already has, and merging duplicate records.
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';
import { TID } from '../support/selectors.js';

const MGR = 'businesshead@local.test';
const SALES = 'sales1@local.test';
const mobile = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;
const mk = (name: string, m: string, extra: any = {}) => ({ name, mobile: m, srctype: 'Walkin', ...extra });

test.describe('Customers page @p1', () => {
  test('CUST-5 the mobile is checked and tidied, and name and email are checked @negative', async ({ api }) => {
    const post = (b: any) => api.request('POST', '/customers', b, MGR);
    for (const bad of ['12345', 'HAND BILL', '1234567890', '+1 4159612622', '98765']) {
      expect((await post(mk(`QA Bad ${Date.now()}`, bad))).status, `mobile ${bad}`).toBe(400);
    }
    expect((await post(mk('', mobile()))).status).toBe(400);
    expect((await post(mk('QA Name', ''))).status).toBe(400);
    expect((await post(mk(`QA Mail ${Date.now()}`, mobile(), { email: 'not-an-email' }))).status).toBe(400);

    const m = mobile();
    const ok = await post(mk(`  QA   Tidy   ${Date.now()} `, `+91 ${m.slice(0, 5)} ${m.slice(5)}`, { email: 'QA.Tidy@Example.COM' }));
    expect(ok.status).toBeLessThan(300);
    expect(ok.body.mobile).toBe(m);
    expect(ok.body.name).toMatch(/^QA Tidy \d+$/);
    expect(ok.body.email).toBe('qa.tidy@example.com');
  });

  test('CUST-6 a number someone else has needs confirming; the same name and number is always refused @edge', async ({ api }) => {
    const post = (b: any) => api.request('POST', '/customers', b, MGR);
    const m = mobile();
    const first = await post(mk(`QA Family A ${Date.now()}`, m));
    expect(first.status).toBeLessThan(300);

    const second = mk(`QA Family B ${Date.now()}`, m);
    const refused = await post(second);
    expect(refused.status).toBe(409);
    expect(JSON.stringify(refused.body)).toContain('already used');
    expect((await post({ ...second, confirmduplicate: true })).status).toBeLessThan(300);

    // same name + same number is refused even when confirmed
    expect((await post({ ...mk(first.body.name, m), confirmduplicate: true })).status).toBe(409);

    const list = (await api.request('GET', `/customers/by-mobile/${m}`, undefined, MGR)).body;
    expect(list.length).toBe(2);
    expect((await api.request('GET', '/customers/by-mobile/abc', undefined, MGR)).body).toEqual([]);
  });

  test('CUST-7 editing a customer keeps its own number without a warning @happy', async ({ api }) => {
    const m = mobile();
    const made = (await api.request('POST', '/customers', mk(`QA Edit ${Date.now()}`, m), MGR)).body;
    const edit = await api.request('POST', '/customers', { id: made.id, name: made.name, mobile: m, locality: 'QA Town', email: '' }, MGR);
    expect(edit.status).toBeLessThan(300);
    const got = (await api.request('GET', `/customers/${made.id}`, undefined, MGR)).body;
    expect(got.locality).toBe('QA Town');
    expect(got.email).toBeNull();
    expect(got.mobile).toBe(m);
  });

  test('CUST-8 duplicates are listed and merged by the Business Head only; the others are archived @integration', async ({ api }) => {
    const m = mobile();
    const stamp = Date.now();
    const a = (await api.request('POST', '/customers', mk(`QA Merge Joshua ${stamp}`, m, { email: 'keep@example.com' }), MGR)).body;
    const b = (await api.request('POST', '/customers', { ...mk(`QA Merge Joshua Jesudason ${stamp}`, m, { address: '5 QA Street' }), confirmduplicate: true }, MGR)).body;

    expect((await api.request('GET', '/customers/duplicates', undefined, SALES)).status).toBe(403);
    expect((await api.request('POST', '/customers/merge', { keepid: a.id, mergeids: [b.id] }, SALES)).status).toBe(403);

    const groups = (await api.request('GET', '/customers/duplicates', undefined, MGR)).body;
    const g = groups.find((x: any) => x.mobile === m);
    expect(g, 'the shared number is listed').toBeTruthy();
    expect(g.members.length).toBe(2);
    expect(g.likelysame).toBe(true);

    expect((await api.request('POST', '/customers/merge', { keepid: a.id, mergeids: [a.id] }, MGR)).status).toBe(400);
    const nil = (await api.request('GET', '/customers/search/mobile/0000000000', undefined, MGR)).body;
    if (nil?.id) expect((await api.request('POST', '/customers/merge', { keepid: a.id, mergeids: [nil.id] }, MGR)).status).toBe(400);

    const merged = await api.request('POST', '/customers/merge', { keepid: a.id, mergeids: [b.id] }, MGR);
    expect(merged.status).toBeLessThan(300);
    expect(merged.body.merged.map((x: any) => x.id)).toEqual([b.id]);

    const all = (await api.request('GET', '/customers', undefined, MGR)).body;
    expect(all.some((c: any) => c.id === b.id)).toBe(false);          // archived, off the list
    expect(all.some((c: any) => c.id === a.id)).toBe(true);
    const kept = (await api.request('GET', `/customers/${a.id}`, undefined, MGR)).body;
    expect(kept.address).toBe('5 QA Street');                         // blank filled from the merged record
    expect((await api.request('GET', '/customers/duplicates', undefined, MGR)).body.some((x: any) => x.mobile === m)).toBe(false);
    const audit = await api.request('GET', `/audit?action=customer.merged&entitytype=customers&entityid=${a.id}&limit=3`, undefined, MGR);
    expect(audit.body.rows.length).toBeGreaterThan(0);
  });

  test('CUST-9 the page searches, and the form warns about a shared number and refuses a bad one @happy', async ({ app, api }) => {
    const m = mobile();
    const stamp = Date.now();
    const known = (await api.request('POST', '/customers', mk(`QA Searchable ${stamp}`, m), MGR)).body;

    const list = await app.open(MGR, '/secure/customers/cust/list');
    await expectShell(list.page);
    await list.page.getByTestId('cust-search').fill(`QA Searchable ${stamp}`);
    await expect(list.page.locator('tbody tr', { hasText: known.name })).toHaveCount(1);
    await list.page.getByTestId('cust-search').fill(m);
    await expect(list.page.locator('tbody tr', { hasText: m })).toHaveCount(1);
    await expect(list.page.getByTestId('cust-dups-link')).toBeVisible();

    const { page } = await app.open(MGR, '/secure/customers/cust/new');
    await page.getByTestId(TID.custFName).fill(`QA Someone Else ${stamp}`);
    await page.getByTestId(TID.custFMobile).fill('12345');
    await page.getByTestId(TID.custFMobile).blur();
    await expect(page.getByTestId('cust-f-mobile-error')).toBeVisible();
    await page.getByTestId(TID.custFMobile).fill(`+91 ${m.slice(0, 5)} ${m.slice(5)}`);
    await page.getByTestId(TID.custFMobile).blur();
    await expect(page.getByTestId(TID.custFMobile)).toHaveValue(m);          // tidied
    await expect(page.getByTestId('cust-f-dup-warning')).toContainText(known.name);
    await page.getByTestId(TID.custFSrctype).selectOption({ index: 1 });
    await expect(page.getByTestId(TID.custFSave)).toBeDisabled();           // until it is confirmed as a different person
    await page.getByTestId('cust-f-dup-confirm').check();
    await expect(page.getByTestId(TID.custFSave)).toBeEnabled();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/customers') && r.request().method() === 'POST'),
      page.getByTestId(TID.custFSave).click(),
    ]);
    expect(resp.status()).toBeLessThan(300);
  });

  test('CUST-10 a name typed in capitals is saved in Title Case; a mixed-case name is left alone @happy', async ({ api }) => {
    const stamp = Date.now();
    const caps = await api.request('POST', '/customers', mk(`  QA   ROHAN  KUMAR ${stamp} `, mobile()), MGR);
    expect(caps.body.name).toBe(`Qa Rohan Kumar ${stamp}`);
    const mixed = await api.request('POST', '/customers', mk(`QA McDonald ${stamp}`, mobile()), MGR);
    expect(mixed.body.name).toBe(`QA McDonald ${stamp}`);
    // the same name in other capitals is the same person on the same number
    const m = mobile();
    await api.request('POST', '/customers', mk(`QA Same Person ${stamp}`, m), MGR);
    expect((await api.request('POST', '/customers', { ...mk(`QA SAME PERSON ${stamp}`, m), confirmduplicate: true }, MGR)).status).toBe(409);
  });

  test('CUST-11 the form: source is optional, add-another keeps going, and Save says why it is off @happy', async ({ app, api }) => {
    const stamp = Date.now();
    const { page } = await app.open(MGR, '/secure/customers/cust/new');
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'New customer' })).toBeVisible();
    await expect(page.getByTestId(TID.custFName)).toBeFocused();
    await expect(page.getByTestId('cust-f-srcdesc')).toHaveCount(0);                 // only for referral / other
    await page.getByTestId(TID.custFSrctype).selectOption('Referral');
    await expect(page.getByTestId('cust-f-srcdesc')).toBeVisible();
    await page.getByTestId(TID.custFSrctype).selectOption('');

    await expect(page.getByTestId(TID.custFSave)).toBeDisabled();
    await expect(page.getByTestId('cust-f-hint')).toContainText('name');
    await page.getByTestId(TID.custFName).fill(`QA ADD ONE ${stamp}`);
    await page.getByTestId(TID.custFName).blur();
    await expect(page.getByTestId(TID.custFName)).toHaveValue(`Qa Add One ${stamp}`);   // tidied as you leave it
    await page.getByTestId(TID.custFMobile).fill(mobile());
    await page.getByTestId(TID.custFMobile).blur();
    await expect(page.getByTestId(TID.custFSave)).toBeEnabled();                     // no source needed
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/customers') && r.request().method() === 'POST'),
      page.getByTestId('cust-f-save-add').click(),
    ]);
    expect(resp.status()).toBeLessThan(300);
    await expect(page.getByTestId('cust-f-note')).toContainText(`Qa Add One ${stamp}`);
    await expect(page.getByTestId(TID.custFName)).toHaveValue('');                   // ready for the next one
    await expect(page).toHaveURL(/cust\/new/);

    const edit = await api.request('GET', '/customers', undefined, MGR);
    const mine = edit.body.find((c: any) => c.name === `Qa Add One ${stamp}`);
    const { page: p2 } = await app.open(MGR, `/secure/customers/cust/edit/${mine.id}`);
    await expect(p2.getByRole('heading', { name: 'Edit customer' })).toBeVisible();
    await expect(p2.getByTestId('cust-f-save-add')).toHaveCount(0);
  });

  test('CUST-12 an alternate number is checked, stored, found by the counter lookup, and can be cleared @happy', async ({ api }) => {
    const stamp = Date.now();
    const m = mobile();
    const alt = mobile();
    const post = (b: any) => api.request('POST', '/customers', b, MGR);
    expect((await post(mk(`QA Alt Bad ${stamp}`, mobile(), { altmobile: '12345' }))).status).toBe(400);
    expect((await post(mk(`QA Alt Same ${stamp}`, m, { altmobile: m }))).status).toBe(400);
    expect((await post(mk(`QA Alt Nil ${stamp}`, mobile(), { altmobile: '0000000000' }))).status).toBe(400);

    const made = await post(mk(`QA Alt Ok ${stamp}`, m, { altmobile: `+91 ${alt.slice(0, 5)} ${alt.slice(5)}` }));
    expect(made.status).toBeLessThan(300);
    expect(made.body.altmobile).toBe(alt);

    // ringing from the alternate number finds the customer; a primary holder of that number wins
    const found = await api.request('GET', `/customers/search/mobile/${alt}`, undefined, MGR);
    expect(found.body.id).toBe(made.body.id);
    const owner = (await post(mk(`QA Alt Owner ${stamp}`, alt))).body;
    expect((await api.request('GET', `/customers/search/mobile/${alt}`, undefined, MGR)).body.id).toBe(owner.id);

    // an edit that does not mention it keeps it; a blank clears it
    const keep = await post({ id: made.body.id, name: made.body.name, mobile: m, locality: 'QA Town' });
    expect(keep.body.altmobile).toBe(alt);
    const cleared = await post({ id: made.body.id, name: made.body.name, mobile: m, altmobile: '' });
    expect(cleared.body.altmobile).toBeNull();
  });

  test('CUST-13 the form takes an alternate number and the list shows it @happy', async ({ app, api }) => {
    const stamp = Date.now();
    const m = mobile();
    const alt = mobile();
    const { page } = await app.open(MGR, '/secure/customers/cust/new');
    await page.getByTestId(TID.custFName).fill(`QA Two Numbers ${stamp}`);
    await page.getByTestId(TID.custFMobile).fill(m);
    await page.getByTestId(TID.custFMobile).blur();
    await page.getByTestId('cust-f-altmobile').fill('12345');
    await page.getByTestId('cust-f-altmobile').blur();
    await expect(page.getByTestId('cust-f-altmobile-error')).toBeVisible();
    await expect(page.getByTestId(TID.custFSave)).toBeDisabled();
    await page.getByTestId('cust-f-altmobile').fill(m);
    await page.getByTestId('cust-f-altmobile').blur();
    await expect(page.getByTestId('cust-f-hint')).toContainText('same as the mobile');
    await page.getByTestId('cust-f-altmobile').fill(`0${alt}`);
    await page.getByTestId('cust-f-altmobile').blur();
    await expect(page.getByTestId('cust-f-altmobile')).toHaveValue(alt);             // tidied
    await expect(page.getByTestId(TID.custFSave)).toBeEnabled();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/customers') && r.request().method() === 'POST'),
      page.getByTestId(TID.custFSave).click(),
    ]);
    expect(resp.status()).toBeLessThan(300);

    const list = await app.open(MGR, '/secure/customers/cust/list');
    await list.page.getByTestId('cust-search').fill(alt);                            // searchable by the alternate too
    await expect(list.page.locator('tbody tr', { hasText: `QA Two Numbers ${stamp}` })).toHaveCount(1);
    await expect(list.page.getByTestId('cust-alt').first()).toContainText(alt);
  });
});
