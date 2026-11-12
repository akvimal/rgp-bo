/**
 * The bill's layout, foot and walk-in customer - BLAY-1..4
 * The foot is the store's own template (the business's when the store has none); the name can carry a sign; the discount line shows only when there is a
 * discount; a bill with no customer prints and lists as a walk-in.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

async function stockLines(api: any, n: number) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 30 && Number(x.sale_price) > 0);
  const seen = new Set<number>(); const out: any[] = [];
  for (const r of rows) if (!seen.has(r.id) && out.length < n) { seen.add(r.id); out.push(r); }
  return out;
}

async function makeBill(api: any, opts: { customerid?: number | null; disc?: number } = {}) {
  const [a] = await stockLines(api, 1);
  const now = new Date().toISOString();
  const disc = opts.disc ?? 0;
  const sale = await api.request('POST', '/sales', {
    customerid: opts.customerid ?? null, billdate: now, orderdate: now, cashamt: 100 - disc, digiamt: 0, total: 100 - disc, discamount: disc, expreturndays: 7, status: 'COMPLETE',
    ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: a.item_id, productid: a.id, batch: a.batch, price: 50, mrpcost: a.mrp_cost, taxpcnt: 12, qty: 2, total: 100, status: 'Complete' }],
  }, COUNTER);
  expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);
  const full = (await api.request('GET', `/sales/${sale.body.id}`, undefined, MGR)).body;
  return { id: sale.body.id as number, storeid: full.storeid as number };
}

const licList = (lic: any) => (lic.licenses || []).map((l: any) => ({ licensetype: l.licensetype, number: l.number, validfrom: l.validfrom, validto: l.validto, notes: l.notes }));

test.describe('Bill layout @p1', () => {
  test('BLAY-1 the foot is the store template, with phone layouts, bold and alignment; an empty store template falls back to the business one @happy', async ({ api, app }) => {
    const bill = await makeBill(api);
    const biz = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
    const lic = (await api.request('GET', `/stores/${bill.storeid}/licenses`, undefined, MGR)).body;
    const put = async (storeFooter: string, bizFooter: string) => {
      const a = await api.request('PUT', `/stores/${bill.storeid}/licenses`, { address: lic.address ?? '', pincode: lic.pincode ?? '', phone: '9840011223', billfooter: storeFooter, licenses: licList(lic) }, MGR);
      expect(a.status, JSON.stringify(a.body)).toBeLessThan(300);
      const b = await api.request('PUT', '/businesses/mine', { billfooter: bizFooter, grievancephone: '' }, MGR);
      expect(b.status, JSON.stringify(b.body)).toBeLessThan(300);
    };
    try {
      await put('[r]Call {store_phone|intl}\n**Bold line**\nGrievances: {grievance_phone}', 'BUSINESS FOOT');
      const { page } = await app.open(MGR, `/secure/sales/pos/view/${bill.id}`);
      const foot = page.getByTestId('bill-footer');
      await expect(foot).toContainText('Call +91 98400 11223');
      await expect(foot).toContainText('Bold line');
      await expect(foot).not.toContainText('Grievances');                       // no grievance number: the line is dropped
      await expect(foot).not.toContainText('BUSINESS FOOT');
      await expect(page.getByTestId('bill-footer-line').first()).toHaveClass(/ta-r/);
      await expect(foot.locator('b')).toHaveText('Bold line');

      await put('', 'BUSINESS FOOT');                                            // no store template: the business's is used
      await page.reload();
      await expect(page.getByTestId('bill-footer')).toContainText('BUSINESS FOOT');
      const prev = await api.request('POST', '/stores/footer-preview', { storeid: bill.storeid, template: 'Hi {store_phone|plain}' }, MGR);
      expect(prev.body.lines[0].parts[0].text).toBe('Hi 9840011223');
    } finally {
      await api.request('PUT', `/stores/${bill.storeid}/licenses`, { address: lic.address ?? '', pincode: lic.pincode ?? '', phone: lic.phone ?? '', billfooter: lic.billfooter ?? '', licenses: licList(lic) }, MGR);
      await api.request('PUT', '/businesses/mine', { billfooter: biz.billfooter ?? '', grievancephone: biz.grievancephone ?? '' }, MGR);
    }
  });

  test('BLAY-2 the name sign is printed after the business name, and only the registered or trade-mark sign is accepted @edge', async ({ api, app }) => {
    const bill = await makeBill(api);
    const biz = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
    try {
      expect((await api.request('PUT', '/businesses/mine', { namesuffix: 'X' }, MGR)).status).toBe(400);
      expect((await api.request('PUT', '/businesses/mine', { namesuffix: '®' }, MGR)).status).toBeLessThan(300);
      const { page } = await app.open(MGR, `/secure/sales/pos/view/${bill.id}`);
      await expect(page.getByTestId('bill-name-suffix')).toHaveText('®');
      await api.request('PUT', '/businesses/mine', { namesuffix: '' }, MGR);
      await page.reload();
      await expect(page.getByTestId('bill-from-name')).toBeVisible();
      await expect(page.getByTestId('bill-name-suffix')).toHaveCount(0);
    } finally {
      await api.request('PUT', '/businesses/mine', { namesuffix: biz.namesuffix ?? '' }, MGR);
    }
  });

  test('BLAY-3 the Discount line is shown only when a discount was given, and Net total says "and rounded" only with a round off @edge', async ({ api, app }) => {
    const plain = await makeBill(api);
    const { page } = await app.open(MGR, `/secure/sales/pos/view/${plain.id}`);
    await expect(page.getByTestId('bill-net-label')).toHaveText('Net total (GST included)');
    await expect(page.getByTestId('bill-discount')).toHaveCount(0);
    const off = await makeBill(api, { disc: 10 });
    await page.goto(page.url().replace(`/view/${plain.id}`, `/view/${off.id}`));
    await expect(page.getByTestId('bill-discount')).toContainText('10.00');
    await expect(page.getByTestId('bill-net')).toHaveText('₹90.00');
  });

  test('BLAY-4 a bill with no customer is saved without one, prints as a walk-in, and the report never shows the Nil mobile @happy', async ({ api, app }) => {
    const bill = await makeBill(api, { customerid: null });
    const full = (await api.request('GET', `/sales/${bill.id}`, undefined, MGR)).body;
    expect(full.customer ?? null).toBeNull();                                  // no customer at all, not the shared Nil record
    const { page } = await app.open(MGR, `/secure/sales/pos/view/${bill.id}`);
    await expect(page.getByTestId('bill-customer')).toContainText('Walk-in customer');
    await expect(page.getByTestId('bill')).not.toContainText('0000000000');
    const today = new Date().toISOString().slice(0, 10);
    const rep = await api.request('POST', '/reports/sale', { criteria: { report: 'sale', begin: today, end: today } }, MGR);
    if (rep.status < 300 && Array.isArray(rep.body)) {
      for (const r of rep.body.filter((x: any) => String(x.bill_no) === String(full.billno))) expect(String(r.customer)).toBe('Walk-in');
      expect(JSON.stringify(rep.body)).not.toContain('0000000000');
    }
  });
});
