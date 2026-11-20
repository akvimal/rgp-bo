/**
 * Refill follow-up: a medicine that is out of stock can be asked for from the row — REFILL-6, REFILL-7
 * The row shows what the customer last bought beside the medicine; the out-of-stock icon adds it to the purchase requests, sized as the Reorder list sizes it.
 */
import { test, expect, data } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const OWNER = 'businesshead@local.test';
const PAGE = '/secure/quality/refills';

async function aProduct(api: any): Promise<{ id: number; title: string }> {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 1000 }, OWNER)).body;
  const p = rows.find((x: any) => x.status === 'VERIFIED');
  return { id: p.id, title: p.title };
}

test.describe('Refill follow-up, out of stock @p1', () => {
  test('REFILL-6 asking for a product sizes the request, and a product already asked for is not asked twice @happy', async ({ api }) => {
    const p = await aProduct(api);
    const first = await api.request('POST', '/purchaserequests/reorder', { productid: p.id, fallbackqty: 7, note: 'QA refill out of stock' }, OWNER);
    expect(first.status, JSON.stringify(first.body)).toBeLessThan(300);
    expect(first.body.requestid).toBeGreaterThan(0);
    expect(first.body.qty).toBeGreaterThanOrEqual(1);
    if (!first.body.already) {
      const row = (await api.request('GET', `/purchaserequests/${first.body.requestid}`, undefined, OWNER)).body;
      expect(row.requesttype).toBe('Refill');
      expect(row.productid).toBe(p.id);
      expect(+row.qty).toBe(first.body.qty);
      const again = await api.request('POST', '/purchaserequests/reorder', { productid: p.id }, OWNER);
      expect(again.body.already).toBe(true);
      expect(again.body.requestid).toBe(first.body.requestid);
    }
    expect((await api.request('POST', '/purchaserequests/reorder', { productid: 999999999 }, OWNER)).status).toBe(400);
    expect((await api.request('POST', '/purchaserequests/reorder', {}, OWNER)).status).toBe(400);
  });

  test('REFILL-7 the row shows the last quantity beside the medicine, and the out-of-stock icon adds it to the purchase requests @happy', async ({ app, api }) => {
    const p = await aProduct(api);
    const row = {
      customer_id: 1, name: 'QA Refill Customer', mobile: '9876543210', visits: 5, last_bought: '2026-10-01', usual_gap: 30, days_over: 12, bucket: 'OVERDUE',
      expected_on: '2026-10-31', titles: p.title, basis: 'own',
      medicines: [{ product_id: p.id, title: p.title, qty: 30, expected_on: '2026-10-31', basis: 'own', supply_days: 30, stock: 'none', requested: null }],
    };
    const { page } = await app.open(OWNER, PAGE);
    await expectShell(page);
    await page.route(/\/refills(\?.*)?$/, (route) => route.fulfill({ json: { rows: [row], counts: { OVERDUE: 1, UPCOMING: 0, LAPSED: 0, snoozed: 0 }, results: null } }));
    await page.getByRole('button', { name: 'Overdue', exact: true }).first().click();
    const med = page.getByTestId('rf-medicine').first();
    await expect(med).toContainText(p.title);
    await expect(med.getByTestId('rf-lastqty')).toContainText('30');
    await expect(med).not.toContainText('their own pattern');
    await med.getByTestId('rf-nostock').click();
    await expect(page.getByTestId('rf-notice')).toContainText('purchase request');
    await expect(med.getByTestId('rf-requested')).toBeVisible();
    await expect(med.getByTestId('rf-nostock')).toHaveCount(0);
  });
});
