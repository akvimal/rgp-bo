/**
 * The customer's tier and segment shown where staff meet the customer — CBADGE-1..3
 * "Gold · Champion" with a line on how to treat them, at the counter and on the customer screens. No figures are carried.
 */
import { test, expect } from '../fixtures/index.js';
import { data } from '../fixtures/data.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const OPERATOR = { operatorId: 3, operatorName: 'Sale Staff One' };

/** a seeded customer that has a tier (one with bills), with the number to type */
async function ratedCustomer(api: any) {
  const ids: number[] = (data as any).m.customers.slice(0, 60);
  const r = await api.request('GET', `/customer-relations/badges?ids=${ids.join(',')}`, undefined, MGR);
  expect(r.status).toBe(200);
  const id = ids.find((i) => r.body[i]?.tier);
  expect(id, 'a seeded customer with a tier').toBeTruthy();
  const c = await api.request('GET', `/customers/${id}`, undefined, MGR);
  return { id: id as number, badge: r.body[id as number], mobile: String(c.body.mobile) };
}

test.describe('Customer badge @p1', () => {
  test('CBADGE-1 the badges endpoint gives tier, segment, label and a cue to any login, and no figures @happy', async ({ api }) => {
    const c = await ratedCustomer(api);
    expect(['Gold', 'Silver', 'Bronze']).toContain(c.badge.tier);
    expect(c.badge.label).toContain(c.badge.tier);
    expect(c.badge.cue.length).toBeGreaterThan(10);
    expect(JSON.stringify(c.badge)).not.toMatch(/spend|visits|₹/i);

    // staff at the counter may ask too, and a made-up id simply has none
    const asStaff = await api.request('GET', `/customer-relations/badges?ids=${c.id},999999999`, undefined, COUNTER);
    expect(asStaff.status).toBe(200);
    expect(asStaff.body[c.id].label).toBe(c.badge.label);
    expect(asStaff.body[999999999]).toBeNull();
  });

  test('CBADGE-2 at the counter the badge shows on the suggestion and, with its cue, once the customer is chosen @happy', async ({ app, api }) => {
    const c = await ratedCustomer(api);
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', OPERATOR);
    await page.locator('app-customer-select input').first().pressSequentially(c.mobile);
    const row = page.locator('.p-autocomplete-panel li').filter({ hasText: c.mobile }).first();
    await expect(row.getByTestId('cust-badge')).toContainText(c.badge.label);
    await row.click();
    const bar = page.getByTestId('sale-customer-badge');
    await expect(bar.getByTestId('cust-badge')).toContainText(c.badge.label);
    await expect(bar.getByTestId('cust-cue')).toContainText(c.badge.cue.slice(0, 20));
  });

  test('CBADGE-3 the customer list and the customer page show the badge @happy', async ({ app, api }) => {
    const c = await ratedCustomer(api);
    const { page } = await app.open(MGR, `/secure/customers/cust/view/${c.id}`);
    await expect(page.getByTestId('cdv-name').getByTestId('cust-badge')).toContainText(c.badge.label);
    await expect(page.getByTestId('cdv-name').getByTestId('cust-cue')).toBeVisible();
  });
});
