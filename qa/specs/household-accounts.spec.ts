/**
 * Households — step 5 (docs/planning/CUSTOMER_HOUSEHOLDS.md)
 * One number, several people, one balance: the Account links on the customer page change the number, give a person their own account,
 * move a balance, and join two accounts.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const mobile = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;
const view = (id: number) => `/secure/customers/cust/view/${id}`;

test.describe('Customer households @p1', () => {
  test('HH-1 a family on one number shares one balance; change number, own account, move a balance, join accounts', async ({ app, api }) => {
    const stamp = Date.now();
    const m1 = mobile(), m2 = mobile(), m1b = mobile(), own = mobile();
    const post = async (body: any) => {
      const r = await api.request('POST', '/customers', { srctype: 'Walkin', confirmduplicate: true, ...body }, MGR);
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
      return r.body;
    };
    const a = await post({ name: `QA Hh Asha ${stamp}`, mobile: m1 });
    const b = await post({ name: `QA Hh Babu ${stamp}`, mobile: m1, relationship: 'SPOUSE' });
    const c = await post({ name: `QA Hh Chitra ${stamp}`, mobile: m2 });

    // dues on Asha are the household's: Babu sees them too
    expect((await api.request('POST', `/customer-dues/${a.id}/adjustment`, { amount: 300, note: 'QA opening dues' }, MGR)).status).toBeLessThan(300);
    expect((await api.request('GET', `/customer-dues/${b.id}`, undefined, MGR)).body.balance).toBe(300);

    const { page } = await app.open(MGR, view(b.id));
    await expect(page.getByTestId('cdv-household')).toContainText(`QA Hh Asha ${stamp}`);

    // change the number for everyone
    await page.getByTestId('cdv-acct-mobile').click();
    await page.getByTestId('cdv-acct-mobile-input').fill(m1b);
    await page.getByTestId('cdv-acct-mobile-go').click();
    await expect(page.getByTestId('cdv-acct-done')).toContainText('changed for everyone');
    for (const id of [a.id, b.id]) expect((await api.request('GET', `/customers/${id}`, undefined, MGR)).body.mobile).toBe(m1b);
    // the old number is kept
    const nums = (await api.request('GET', `/customers/${a.id}/household/numbers`, undefined, MGR)).body;
    expect(nums.history.map((h: any) => h.mobile)).toContain(m1);
    const look = await api.request('GET', `/customers/lookup?q=${m1}`, undefined, MGR);
    expect(look.body.ids).toContain(a.id);

    // Babu is given an account of his own: the family keeps the dues
    await page.getByTestId('cdv-acct-detach').click();
    await page.getByTestId('cdv-acct-detach-mobile').fill(own);
    await page.getByTestId('cdv-acct-detach-go').click();
    await expect(page.getByTestId('cdv-acct-done')).toContainText('their own account');
    expect((await api.request('GET', `/customer-dues/${b.id}`, undefined, MGR)).body.balance).toBe(0);
    expect((await api.request('GET', `/customer-dues/${a.id}`, undefined, MGR)).body.balance).toBe(300);

    // Babu owes nothing now, so moving dues from his page is refused, and the page says why
    await page.getByTestId('cdv-acct-move').click();
    await page.getByTestId('cdv-acct-move-amount').fill('100');
    await page.getByTestId('cdv-acct-move-other').fill(m1b);
    await page.getByTestId('cdv-acct-move-reason').fill('QA moved to the family account');
    await page.getByTestId('cdv-acct-move-go').click();
    await expect(page.getByTestId('cdv-error')).toContainText('you cannot move more than that');
  });

  test('HH-2 a balance moves between accounts; two accounts join into one @edge', async ({ app, api }) => {
    const stamp = Date.now();
    const post = async (body: any) => (await api.request('POST', '/customers', { srctype: 'Walkin', ...body }, MGR)).body;
    const a = await post({ name: `QA Hh Dev ${stamp}`, mobile: mobile() });
    const c = await post({ name: `QA Hh Esha ${stamp}`, mobile: mobile() });
    await api.request('POST', `/customer-dues/${a.id}/adjustment`, { amount: 300, note: 'QA opening dues' }, MGR);

    const refused = await api.request('POST', '/customers/households/transfer', { fromcustomerid: a.id, tocustomerid: c.id, kind: 'DUE', amount: 999, reason: 'too much' }, MGR);
    expect(refused.status).toBe(400);

    const { page } = await app.open(MGR, view(a.id));
    await page.getByTestId('cdv-acct-move').click();
    await page.getByTestId('cdv-acct-move-amount').fill('120');
    await page.getByTestId('cdv-acct-move-other').fill(c.mobile);
    await page.getByTestId('cdv-acct-move-reason').fill('QA moved to her account');
    await page.getByTestId('cdv-acct-move-go').click();
    await expect(page.getByTestId('cdv-acct-done')).toContainText('balance was moved');
    expect((await api.request('GET', `/customer-dues/${a.id}`, undefined, MGR)).body.balance).toBe(180);
    expect((await api.request('GET', `/customer-dues/${c.id}`, undefined, MGR)).body.balance).toBe(120);

    // join Esha's account to Dev's: one balance of 300, one number
    const joined = await api.request('POST', '/customers/households/merge', { keepcustomerid: a.id, mergecustomerid: c.id }, MGR);
    expect(joined.status, JSON.stringify(joined.body)).toBeLessThan(300);
    expect((await api.request('GET', `/customer-dues/${c.id}`, undefined, MGR)).body.balance).toBe(300);
    expect((await api.request('GET', `/customers/${c.id}`, undefined, MGR)).body.mobile).toBe(a.mobile);
    const ppl = (await api.request('GET', `/customers/${a.id}/household`, undefined, MGR)).body.people;
    expect(ppl.length).toBe(2);
  });
});
