/**
 * Invoice level list: staff and payment filters, and the check that a digital payment was received - DIGC-1..3
 * The check is the Digital payments page's own record, so it shows on both.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

async function stockLine(api: any, skip = 0) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
  const seen = new Set<number>(); const out: any[] = [];
  for (const r of rows) if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  return out[skip];
}

async function bill(api: any, cash: number, digi: number, method = 'UPI') {
  const l = await stockLine(api, 3);
  const now = new Date().toISOString();
  const total = cash + digi;
  const r = await api.request('POST', '/sales', {
    billdate: now, orderdate: now, cashamt: cash, digiamt: digi, digimethod: digi ? method : undefined, digirefno: digi ? `DC${Date.now()}${Math.floor(Math.random() * 1e4)}` : undefined,
    total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: l.item_id, productid: l.id, batch: l.batch, price: total, mrpcost: l.mrp_cost, taxpcnt: l.tax_pcnt, qty: 1, total, status: 'Complete' }],
  }, COUNTER);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return r.body as { id: number; billno: number };
}

/** the list opens on the browser's today; the bills made here carry their own (UTC) day, which is the day to look at */
const openList = async (app: any) => {
  const { page } = await app.open(MGR, '/secure/sales/list');
  await page.locator('#fromdate').fill(new Date().toISOString().slice(0, 10));
  return page;
};

const rowOf = (page: any, billno: number) => page.getByTestId('invoice-row').filter({ has: page.getByRole('link', { name: new RegExp(`^${billno}$`) }) });

test.describe('Invoice level: staff, payment and digital check @p1', () => {
  test('DIGC-1 the payment filter shows cash, digital or split bills and the totals follow; the staff filter narrows to one person @happy', async ({ api, app }) => {
    const cash = await bill(api, 25, 0);
    const split = await bill(api, 40, 60, 'UPI');
    const card = await bill(api, 0, 90, 'Card');
    const page = await openList(app);
    await expect(page.getByTestId('invoice-row').first()).toBeVisible();
    const staff = page.getByTestId('inv-staff-filter'), pay = page.getByTestId('inv-pay-filter');
    const opts = (await pay.locator('option').allInnerTexts()).map((t) => t.trim());
    expect(opts.slice(0, 4)).toEqual(['All payments', 'Cash only', 'Digital (any)', 'Cash and digital']);
    expect(opts).toContain('UPI');
    expect(opts).toContain('Card');
    expect(opts[opts.length - 1]).toBe('Digital, not verified');

    await pay.selectOption('CASH');
    await expect(rowOf(page, cash.billno)).toHaveCount(1);
    await expect(rowOf(page, split.billno)).toHaveCount(0);
    await expect(rowOf(page, card.billno)).toHaveCount(0);
    expect(Number((await page.getByTestId('total-digital').innerText()).replace(/[^0-9.]/g, ''))).toBe(0);      // no digital among cash-only bills

    await pay.selectOption('SPLIT');
    await expect(rowOf(page, split.billno)).toHaveCount(1);
    await expect(rowOf(page, card.billno)).toHaveCount(0);                                                     // card was all digital, no cash

    await pay.selectOption('M:Card');
    await expect(rowOf(page, card.billno)).toHaveCount(1);
    await expect(rowOf(page, split.billno)).toHaveCount(0);

    await pay.selectOption('DIGITAL');
    await expect(rowOf(page, split.billno)).toHaveCount(1);
    await expect(rowOf(page, card.billno)).toHaveCount(1);
    await expect(rowOf(page, cash.billno)).toHaveCount(0);

    await pay.selectOption('ALL');
    const names = (await staff.locator('option').allInnerTexts()).map((t) => t.trim()).filter((t) => t && t !== 'All staff');
    expect(names.length).toBeGreaterThan(0);
    await staff.selectOption(names[0]);
    const shown = await page.getByTestId('invoice-row').locator('td').nth(7).allInnerTexts();
    expect(shown.length).toBeGreaterThan(0);
    for (const n of shown) expect(n.trim()).toBe(names[0]);
  });

  test('DIGC-2 verifying a digital payment from the list is the Digital payments check: it shows there, and a check made there shows here @happy', async ({ api, app }) => {
    const b = await bill(api, 40, 60, 'UPI');
    const other = await bill(api, 0, 75, 'UPI');
    const page = await openList(app);
    await page.locator('#billno').fill(String(b.billno));
    const row = rowOf(page, b.billno);
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId('digi-check')).toHaveText('To verify');
    await row.getByTestId('digi-verify').click();
    const dlg = page.getByTestId('digi-dialog');
    await expect(dlg).toContainText(`Bill ${b.billno}`);
    await expect(dlg).toContainText('60.00');
    await page.getByTestId('digi-save').click();                                                              // received in full is the default
    await expect(row.getByTestId('digi-check')).toHaveText('Verified');

    const asRecon = async (id: number, billno: number) => {
      const day = new Date().toISOString().slice(0, 10);
      const r = (await api.request('GET', `/payment-recon?from=${day}&to=${day}&q=${billno}`, undefined, MGR)).body;
      return (r.rows as any[]).find((x) => x.id === id);
    };
    expect((await asRecon(b.id, b.billno)).check_status).toBe('VERIFIED');                                              // the Digital payments page's own record

    // a check made on the Digital payments side shows on the list
    expect((await api.request('POST', `/payment-recon/${other.id}`, { status: 'MISMATCH', amount_seen: 70, note: 'statement shows 70' }, MGR)).status).toBeLessThan(300);
    await page.locator('#billno').fill(String(other.billno));
    await expect(rowOf(page, other.billno).getByTestId('digi-check')).toHaveText('Amount differs');

    // not received needs a note; and a check can be taken back
    await rowOf(page, other.billno).getByTestId('digi-verify').click();
    await page.getByTestId('digi-no').check();
    await page.getByTestId('digi-note').fill('');                                                             // the earlier note is kept in the box; take it out
    await page.getByTestId('digi-save').click();
    await expect(page.getByTestId('digi-error')).toContainText('note');
    await page.getByTestId('digi-note').fill('not in the account');
    await page.getByTestId('digi-save').click();
    await expect(rowOf(page, other.billno).getByTestId('digi-check')).toHaveText('Not received');
    expect((await asRecon(other.id, other.billno)).check_status).toBe('NOT_FOUND');

    await rowOf(page, other.billno).getByTestId('digi-verify').click();
    await page.getByTestId('digi-undo').click();
    await expect(rowOf(page, other.billno).getByTestId('digi-check')).toHaveText('To verify');
    expect((await asRecon(other.id, other.billno)).check_status).toBeNull();
  });

  test('DIGC-3 "Digital, not verified" lists only the digital bills still to check; a cash bill has no check and no action @edge', async ({ api, app }) => {
    const cash = await bill(api, 30, 0);
    const unchecked = await bill(api, 0, 50, 'UPI');
    const done = await bill(api, 0, 55, 'UPI');
    expect((await api.request('POST', `/payment-recon/${done.id}`, { status: 'VERIFIED' }, MGR)).status).toBeLessThan(300);
    const page = await openList(app);
    await expect(page.getByTestId('invoice-row').first()).toBeVisible();
    await page.getByTestId('inv-pay-filter').selectOption('UNVERIFIED');
    await expect(rowOf(page, unchecked.billno)).toHaveCount(1);
    await expect(rowOf(page, done.billno)).toHaveCount(0);
    await expect(rowOf(page, cash.billno)).toHaveCount(0);
    await page.getByTestId('inv-pay-filter').selectOption('ALL');
    await expect(rowOf(page, cash.billno).getByTestId('digi-check')).toHaveCount(0);
    await expect(rowOf(page, cash.billno).getByTestId('digi-verify')).toHaveCount(0);
  });
});
