/**
 * The customer's bill (sale view and its print) - BILL-1..2
 * It comes from the store's own details, lines up in columns, shows how it was paid, the tax and the total in words, and gives
 * the customer what they need to come back (refill date, who to call). The print is the same page without the buttons.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

async function stockLines(api: any, n: number) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
  const seen = new Set<number>();
  const out: any[] = [];
  for (const r of rows) if (!seen.has(r.id) && out.length < n) { seen.add(r.id); out.push(r); }
  return out;
}

async function makeBill(api: any) {
  const [a, b] = await stockLines(api, 2);
  const m = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  const c = await api.request('POST', '/customers', { name: 'QA Bill Customer', mobile: m, srctype: 'Walkin' }, MGR);
  const now = new Date().toISOString();
  const line = (l: any, qty: number, price: number, tax: number, extra: any = {}) =>
    ({ itemid: l.item_id, productid: l.id, batch: l.batch, price, mrpcost: l.mrp_cost, taxpcnt: tax, qty, total: qty * price, status: 'Complete', ...extra });
  const sale = await api.request('POST', '/sales', {
    customerid: c.body.id, billdate: now, orderdate: now, cashamt: 90, digiamt: 100, digimethod: 'UPI', total: 190, discamount: 0, expreturndays: 7, status: 'COMPLETE',
    ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [line(a, 2, 50, 12, { supplymonths: 1 }), line(b, 1, 90, 5)],
  }, COUNTER);
  expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);
  const full = (await api.request('GET', `/sales/${sale.body.id}`, undefined, MGR)).body;
  return { id: sale.body.id as number, storeid: full.storeid as number, titles: [a.title, b.title], customer: { name: 'QA Bill Customer', mobile: m } };
}

test.describe('Customer bill @p1', () => {
  test('BILL-1 the bill carries the store details, the lines, how it was paid, the tax, the total in words and the refill date @happy', async ({ api, app }) => {
    const bill = await makeBill(api);
    const set = await api.request('PUT', `/stores/${bill.storeid}/licenses`, {
      address: '12 QA Main Road, Testville', pincode: '600001', phone: '98400 11223',
      licenses: [{ licensetype: 'RETAIL_20_21', number: 'QA-20-0001' }, { licensetype: 'RETAIL_20_21', number: 'QA-21-0001' }],
    }, MGR);
    expect(set.status, JSON.stringify(set.body)).toBeLessThan(300);
    const biz = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
    const issued = !!(await api.request('GET', `/sales/${bill.id}`, undefined, MGR)).body.gstinvoiceno;       // a tax invoice has its number; any other bill is a cash bill

    const { page } = await app.open(MGR, `/secure/sales/pos/view/${bill.id}`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('bill-line')).toHaveCount(2);

    // from the store, not from the code
    await expect(page.getByTestId('bill-from-name')).toContainText(String(biz.legalname || biz.name));
    await expect(page.getByTestId('bill-from-address')).toContainText('12 QA Main Road, Testville, 600001');
    await expect(page.getByTestId('bill-licence')).toContainText('DL No.: QA-20-0001 | QA-21-0001');
    await expect(page.getByTestId('bill')).not.toContainText('Ramesh');
    await expect(page.getByTestId('bill-kind')).toHaveText(issued ? 'Tax Invoice' : 'Cash Bill');

    // the bill, who it is for, how it was paid
    await expect(page.getByTestId('bill-no')).not.toBeEmpty();
    await expect(page.getByTestId('bill-customer')).toContainText(bill.customer.name);
    await expect(page.getByTestId('bill-customer')).toContainText('QA Bill Customer');
    await expect(page.getByTestId('bill-payments')).toContainText('UPI');
    await expect(page.getByTestId('bill-payments')).toContainText('100.00');
    await expect(page.getByTestId('bill-payments')).toContainText('Cash');
    await expect(page.getByTestId('bill-payments')).toContainText('90.00');

    // the total, in numbers and in words, and a refill date for the medicine supplied for a month
    await expect(page.getByTestId('bill-net')).toHaveText('₹190.00');
    await expect(page.getByTestId('bill-words')).toContainText('Rupees One Hundred Ninety only');
    await expect(page.getByTestId('bill-refill')).toContainText(bill.titles[0]);
    await expect(page.getByTestId('bill-refill')).not.toContainText(bill.titles[1]);
    if (issued) await expect(page.getByTestId('bill-gst')).toBeVisible();
    else await expect(page.getByTestId('bill-gst')).toHaveCount(0);

    // every number column lines up: all rows end at the same place
    for (const col of [3, 4, 5, 6, 7]) {
      const edges = await page.getByTestId('bill-line').evaluateAll((trs, c) => trs.map((tr) => Math.round(tr.children[c as number].getBoundingClientRect().right)), col);
      expect(new Set(edges).size, `column ${col}`).toBe(1);
    }
    const head = await page.locator('[data-testid=bill-items] thead th').evaluateAll((ths) => ths.map((t) => Math.round(t.getBoundingClientRect().right)));
    const body = await page.getByTestId('bill-line').first().locator('td').evaluateAll((tds) => tds.map((t) => Math.round(t.getBoundingClientRect().right)));
    expect(head).toEqual(body);                                                              // headings sit over their columns
  });

  test('BILL-2 printed, only the bill shows: no buttons, no menus, fits one page @edge', async ({ api, app }) => {
    const bill = await makeBill(api);
    const { page } = await app.open(MGR, `/secure/sales/pos/view/${bill.id}`);
    await expect(page.getByTestId('bill-line')).toHaveCount(2);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('bill')).toBeVisible();
    await expect(page.locator('.bill-actions')).toBeHidden();
    const box = (await page.getByTestId('bill').boundingBox())!;
    expect(box.x).toBeLessThan(40);                                                           // at the left of the page, not pushed over by the menu
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBe(1);
  });
});
