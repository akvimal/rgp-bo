/**
 * A customer's earlier bills on the sale form - CUSTH-1..4
 * Choosing a customer by mobile opens their history: the months, the bills in each (including one made late on the last day
 * of a month), the medicines to copy onto this bill, and one button that adds to the bill.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mobile = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;

async function stockLines(api: any, n: number) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
  const seen = new Set<number>();
  const out: any[] = [];
  for (const r of rows) if (!seen.has(r.id) && out.length < n) { seen.add(r.id); out.push(r); }
  return out;
}

const sale = (customerid: number, line: any, billdate: string, itemExtra: any = {}) => ({
  customerid, billdate, orderdate: billdate, cashamt: 50, digiamt: 0, total: 50, discamount: 0, expreturndays: 7, status: 'COMPLETE',
  ordertype: 'Walk-in', deliverytype: 'Counter',
  items: [{ itemid: line.item_id, productid: line.id, batch: line.batch, price: 25, mrpcost: line.mrp_cost, taxpcnt: line.tax_pcnt, qty: 2, total: 50, ...itemExtra }],
});

async function customer(api: any) {
  const m = mobile();
  const c = await api.request('POST', '/customers', { name: `QA History ${Date.now()}`, mobile: m, srctype: 'Walkin' }, MGR);
  expect(c.status).toBeLessThan(300);
  return { id: c.body.id as number, name: c.body.name as string, mobile: m };
}

test.describe('Customer history on the sale form @p1', () => {
  test('CUSTH-1 a month lists every bill in it, with its lines, including the last day of the month @happy', async ({ api }) => {
    const [a, b] = await stockLines(api, 2);
    test.skip(!a || !b, 'no stock to sell');
    const c = await customer(api);
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth();                       // last month: noon UTC on its last day, and on its 1st
    const lastDay = new Date(Date.UTC(y, m, 0, 12, 0, 0)).toISOString();
    const firstDay = new Date(Date.UTC(y, m - 1, 1, 6, 0, 0)).toISOString();
    // a bill late on the last day (its lines marked "Complete", as the screen does) and one on the 1st (no mark, as an import would leave it)
    expect((await api.request('POST', '/sales', sale(c.id, a, lastDay, { status: 'Complete' }), COUNTER)).status).toBeLessThan(300);
    expect((await api.request('POST', '/sales', sale(c.id, b, firstDay), COUNTER)).status).toBeLessThan(300);

    const periods = (await api.request('GET', `/customers/${c.id}/periods`, undefined, MGR)).body as any[];
    const wantYr = new Date(lastDay).getUTCFullYear(), wantMon = new Date(lastDay).getUTCMonth() + 1;
    const p = periods.find((x) => x.yr === wantYr && x.mon === wantMon);
    expect(p, JSON.stringify(periods)).toBeTruthy();
    expect(Number(p.count)).toBe(2);                                              // the months list counts both bills

    const orders = (await api.request('GET', `/customers/${c.id}/${wantYr}/${wantMon}/orders`, undefined, MGR)).body as any[];
    expect(orders).toHaveLength(2);                                               // and so does the month itself
    for (const o of orders) {
      expect(o.items).toHaveLength(1);
      expect(o.items[0].purchaseitem.product.title).toBeTruthy();
    }
  });

  test('CUSTH-2 choosing the customer opens their bills: one button that adds to the bill, ticks kept, the medicines land on the bill @happy', async ({ api, app }) => {
    const [a, b] = await stockLines(api, 2);
    test.skip(!a || !b, 'no stock to sell');
    const c = await customer(api);
    const now = new Date().toISOString();
    expect((await api.request('POST', '/sales', sale(c.id, a, now, { status: 'Complete' }), COUNTER)).status).toBeLessThan(300);
    expect((await api.request('POST', '/sales', sale(c.id, b, now), COUNTER)).status).toBeLessThan(300);

    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.locator('app-customer-select input').fill(c.mobile);
    await page.locator('.p-autocomplete-panel li').filter({ hasText: c.mobile }).first().click();

    const dialog = page.locator('.p-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('cust-order')).toHaveCount(2);                  // both bills, whatever the marks on their lines
    await expect(page.getByTestId('cust-order-item')).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: /Add to this bill/ })).toHaveCount(1);   // one button that adds to the bill, not two
    await expect(page.getByTestId('cust-copy')).toBeDisabled();                   // nothing ticked yet

    await page.getByTestId('cust-order-item').first().locator('input[type=checkbox]').check();
    await expect(page.getByTestId('cust-copy')).toContainText('(1)');
    await expect(page.getByTestId('cust-copy')).toBeEnabled();
    await page.getByTestId('cust-order').nth(1).locator('input[type=checkbox]').first().check();   // the whole other bill
    await expect(page.getByTestId('cust-copy')).toContainText('(2)');

    await page.getByTestId('cust-copy').click();
    await expect(dialog).toHaveCount(0);                                          // closes, and the medicines are on the bill
    await expect(page.getByTestId('sale-line')).toHaveCount(2);
  });

  test('CUSTH-3 documents: the list shows name, kind and details, the picture opens in place with Open and Download, and a customer with none sees a plain message @happy', async ({ api, app }) => {
    const token = await api.token(MGR);
    const c = await customer(api);
    const none = await customer(api);
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(PNG, 'base64')], { type: 'image/png' }), 'rx.v2.png');     // a dot in the name before the extension
    const up = await (await fetch(`${API}/files/upload?customer=${c.id}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd })).json();
    const doc = await api.request('POST', '/documents', {
      name: 'rx.v2.png', path: up.path, extn: 'png', category: 'Prescription', alias: 'Dr Rao March',
      docprops: JSON.stringify([{ label: 'Doctor', value: 'Dr Rao' }, { label: 'Notes', value: '' }]), uploadprops: JSON.stringify(up),
    }, MGR);
    expect(doc.status).toBeLessThan(300);
    expect((await api.request('POST', '/customers/documents/add', { customerId: c.id, documentId: doc.body.id }, MGR)).status).toBeLessThan(300);

    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.locator('app-customer-select input').fill(c.mobile);
    await page.locator('.p-autocomplete-panel li').filter({ hasText: c.mobile }).first().click();
    await page.getByRole('tab', { name: 'Documents' }).click();
    const item = page.getByTestId('doc-item');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('Dr Rao March');
    await expect(item).toContainText('Prescription');
    await expect(item).toContainText('Doctor');
    await expect(item).not.toContainText('Notes');                                  // an empty detail is not printed
    await expect(page.getByTestId('doc-copy')).toBeDisabled();
    await expect(page.getByTestId('doc-preview').locator('img')).toBeVisible();     // the picture shows without a click
    await expect(page.getByTestId('doc-open')).toBeVisible();
    await expect(page.getByTestId('doc-download')).toHaveAttribute('download', 'Dr Rao March.png');
    await item.locator('input[type=checkbox]').check();
    await expect(page.getByTestId('doc-copy')).toContainText('Add to this bill (1)');
    await page.getByTestId('doc-copy').click();
    await expect(page.locator('.p-dialog')).toHaveCount(0);
    await expect(page.getByTestId('sale-document')).toHaveCount(1);                 // it is on the bill, with its details

    const other = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await other.page.locator('app-customer-select input').fill(none.mobile);
    await other.page.locator('.p-autocomplete-panel li').filter({ hasText: none.mobile }).first().click();
    await other.page.getByRole('tab', { name: 'Documents' }).click();
    await expect(other.page.getByTestId('doc-none')).toBeVisible();
  });

  test('CUSTH-4 a phone number on a prescription takes digits only, ten at most, and Upload waits for a full number @edge', async ({ api, app }) => {
    const c = await customer(api);
    const { page } = await app.open(COUNTER, '/secure/sales/pos/new', { operatorId: 3, operatorName: 'Sale Staff One' });
    await page.locator('app-customer-select input').fill(c.mobile);
    await page.locator('.p-autocomplete-panel li').filter({ hasText: c.mobile }).first().click();
    await page.getByRole('tab', { name: 'Documents' }).click();
    await page.getByTestId('doc-upload-open').click();
    await page.getByTestId('doc-upload-form').locator('select').first().selectOption('Prescription');
    const patient = page.getByTestId('doc-prop-ptntmobile');
    const doctor = page.getByTestId('doc-prop-doctorphone');
    await patient.pressSequentially('98765-43210 12ab34');
    await expect(patient).toHaveValue('9876543210');                  // letters, dashes and the extra digits never get in
    await doctor.fill('98765');
    await doctor.blur();
    await expect(page.getByTestId('doc-upload-form')).toContainText('Enter a 10 digit number');
    await doctor.fill('9876501234');
    await expect(page.getByTestId('doc-upload-form')).not.toContainText('Enter a 10 digit number');
  });
});
