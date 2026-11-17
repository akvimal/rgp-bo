/**
 * Staff & Quality — Refill follow-up — REFILL-1..4
 * Chronic customers due for a refill, computed from their own buying pattern; contacts are logged.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const SITE_ADMIN = 'siteadmin@local.test';
const OWNER = 'businesshead@local.test';
const CASHIER = data.m.users.find((u: any) => u.role === 'Sales Staff')!.email;   // whichever ids the seed handed out
const PAGE = '/secure/quality/refills';

test.describe('Staff & Quality — Refill follow-up @p1', () => {
  test('REFILL-1 Business Head sees the refill list and counts that match it @happy', async ({ app, api }) => {
    const { page } = await app.open(OWNER, PAGE);
    await expectShell(page);
    await expect(page.getByRole('heading', { name: 'Refill follow-up' }).first()).toBeVisible();
    const res = await api.request('GET', '/refills', undefined, OWNER);
    expect(res.status).toBe(200);
    const c = res.body.counts;
    expect(res.body.rows.length).toBe(c.UPCOMING + c.OVERDUE); // lapsed customers have their own tab
    const lapsed = await api.request('GET', '/refills?bucket=LAPSED', undefined, OWNER);
    expect(lapsed.body.rows.length).toBe(c.LAPSED);
    if (res.body.rows.length) await expect(page.getByTestId('rf-row')).toHaveCount(res.body.rows.length);
    else await expect(page.getByTestId('rf-empty')).toBeVisible();
    for (const r of res.body.rows) {
      expect(r.mobile).toMatch(/^[0-9]{10}$/);
      expect(r.mobile).not.toBe('0000000000');
      expect(r.visits).toBeGreaterThanOrEqual(3);
    }
  });

  test('REFILL-2 logging a contact hides the customer for a while and bad outcomes are refused @integration', async ({ api }) => {
    const before = await api.request('GET', '/refills', undefined, OWNER);
    expect(before.status).toBe(200);
    if (!before.body.rows.length) test.skip(true, 'no customers are due in this data set');
    const id = before.body.rows[0].customer_id;
    expect((await api.request('POST', `/refills/${id}/followup`, { outcome: 'NOPE' }, OWNER)).status).toBe(400);
    expect((await api.request('POST', `/refills/${id}/followup`, { outcome: 'NO_ANSWER', note: 'QA call' }, OWNER)).status).toBe(201);
    const after = await api.request('GET', '/refills', undefined, OWNER);
    expect(after.body.rows.some((r: any) => r.customer_id === id)).toBe(false);
    const withSnoozed = await api.request('GET', '/refills?showsnoozed=true', undefined, OWNER);
    expect(withSnoozed.body.rows.find((r: any) => r.customer_id === id)?.last_outcome).toBe('NO_ANSWER');
  });

  test('REFILL-3 roles without access cannot open the page or call the API @permission', async ({ app, api }) => {
    for (const who of ['role.readonly@qa.local', SITE_ADMIN]) {
      const { page } = await app.open(who, PAGE);
      await expect(page).toHaveURL(/\/login/);
      expect((await api.request('GET', '/refills', undefined, who)).status).toBe(403);
    }
  });

  test('REFILL-4 the counter works the refill list for its own store, without the money, and without grievances @edge', async ({ app, api }) => {
    const COUNTER = 'sales1@local.test';
    // the list and the contact log are open to the counter
    const mine = await api.request('GET', '/refills', undefined, COUNTER);
    expect(mine.status).toBe(200);
    expect(mine.body.rows.every((r: any) => r.typical_value === undefined)).toBe(true);        // what a customer spends is the manager's
    const owner = (await api.request('GET', '/refills', undefined, OWNER)).body;
    expect(owner.rows.every((r: any) => 'typical_value' in r)).toBe(true);
    // a contact can only be logged for a customer who buys at their store
    const stranger = (await api.request('POST', '/customers', { name: `QA Refill ${String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[+d])}`, mobile: `9${Math.floor(100000000 + Math.random() * 899999999)}` }, OWNER)).body;
    expect((await api.request('POST', `/refills/${stranger.id}/followup`, { outcome: 'NO_ANSWER' }, COUNTER)).status).toBe(404);
    expect((await api.request('POST', `/refills/${stranger.id}/followup`, { outcome: 'NO_ANSWER' }, OWNER)).status).toBeLessThan(300);
    // the rest of Staff & Quality stays closed to them
    expect((await api.request('GET', '/grievances', undefined, COUNTER)).status).toBe(403);
    expect((await api.request('GET', '/audit', undefined, COUNTER)).status).toBe(403);

    // the screen: a Refills entry in the menu, no Staff & Quality, no Customers tab on Sales, the page named for what it is
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new');
    await expectShell(page);
    await expect(page.getByTestId('nav-refills')).toBeVisible();
    await expect(page.getByTestId('nav-quality')).toHaveCount(0);
    await expect(page.locator('.navbar a[href$="/secure/sales/reminders"]')).toHaveCount(0);
    await page.getByTestId('nav-refills').click();
    await expect(page).toHaveURL(/\/secure\/quality\/refills/);
    await expect(page.locator('#main h1').first()).toHaveText('Refill follow-up');
    // the counter has the grouped menu: Refills is its own Sell page, not a tab of a Staff & Quality drawer
    await expect(page.getByTestId('tab-refills')).toHaveCount(0);
    await expect(page.getByTestId('tab-grievances')).toHaveCount(0);

    // the old Sales > Customers address lands on the refill list
    const old = await app.open(OWNER, '/secure/sales/reminders');
    await expect(old.page).toHaveURL(/\/secure\/quality\/refills/);
  });

  test('REFILL-5 each row carries the shop\'s reminder; sending it opens WhatsApp with the text and notes it @happy', async ({ app, api }) => {
    const res = await api.request('GET', '/refills', undefined, OWNER);
    expect(res.status).toBe(200);
    const row = res.body.rows.find((r: any) => r.messages);
    test.skip(!row, 'no customer is due in this data set');
    expect(row.messages.en).toContain('Sir/Madam');
    expect(row.messages.en).not.toContain('{');
    expect(row.messages.ta).not.toContain('{');
    expect(['en', 'ta']).toContain(row.language);
    expect('message_language' in row || 'do_not_contact' in row).toBe(false);

    const { page } = await app.open(OWNER, PAGE);
    await expect(page.getByTestId('rf-row').first()).toBeVisible();
    const popup = page.waitForEvent('popup');
    await page.getByTestId('rf-row').filter({ hasText: row.name }).first().getByTestId('rf-message').click();
    await expect(page.getByTestId('rf-msg')).toBeVisible();
    await page.getByTestId('rf-msg-en').click();
    await expect(page.getByTestId('rf-msg-text')).toHaveValue(row.messages.en);
    await page.getByTestId('rf-msg-ta').click();
    await expect(page.getByTestId('rf-msg-text')).toHaveValue(row.messages.ta);
    await page.getByTestId('rf-msg-en').click();
    await page.getByTestId('rf-msg-text').fill(row.messages.en + ' QA');
    await page.getByTestId('rf-msg-send').click();
    const wa = await popup;
    expect(wa.url()).toMatch(new RegExp(`(wa.me/|phone=)91${row.mobile}`));   // wa.me may redirect to api.whatsapp.com
    expect(decodeURIComponent(wa.url()).replace(/\+/g, ' ')).toContain(' QA');
    await wa.close();
    // it is on record, and the customer leaves the due list
    await expect.poll(async () => (await api.request('GET', '/refills', undefined, OWNER)).body.rows.some((r: any) => r.customer_id === row.customer_id)).toBe(false);
    const again = await api.request('GET', '/refills?showsnoozed=true', undefined, OWNER);
    expect(again.body.rows.find((r: any) => r.customer_id === row.customer_id)?.last_outcome).toBe('MESSAGED');
  });
});
