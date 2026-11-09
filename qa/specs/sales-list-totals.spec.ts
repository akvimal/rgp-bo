/**
 * Sales list totals - SLT-1
 * The footer of the Sales list (Digital, Cash, Net) must add up every bill of the day, however many there are: the list used to ask for the first page only
 * (50 bills, the most recently updated), so on a busy day the totals covered only those and moved the wrong way as bills were added.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

let POOL: any[] = [];
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
  const rows = await (await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ available: true, limit: 200 }),
  })).json();
  POOL = rows.filter((x: any) => Number(x.balance) > 90 && x.status === 'VERIFIED').map((x: any) => ({
    itemid: x.item_id, productid: x.id, batch: x.batch, price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)), mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  }));
});

const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** every completed bill of today, all pages, summed the plain way */
async function truth(api: any) {
  let page = 1, cash = 0, digi = 0, net = 0, count = 0, total = 0;
  do {
    const r = (await api.request('GET', `/sales?date=${todayLocal()}&status=COMPLETE&page=${page}&limit=200`, undefined, MGR)).body;
    total = r.total;
    for (const s of r.data) { cash += +s.cashamt || 0; digi += +s.digiamt || 0; net += Math.round(+s.total || 0); count++; }
    page++;
  } while (count < total && page < 50);
  return { cash: Math.round(cash * 100) / 100, digi: Math.round(digi * 100) / 100, net, count: total };
}

test.describe('Sales list totals @p1', () => {
  test('SLT-1 the footer adds up every bill of the day, not just the first page of 50, and a new bill raises it by exactly its amount @happy', async ({ api, app }) => {
    test.setTimeout(240000);
    const s = POOL[0];
    const bill = async (qty: number) => {
      const total = +(s.price * qty * (1 + s.taxpcnt / 100)).toFixed(2);
      const now = new Date().toISOString();
      const r = await api.request('POST', '/sales', {
        customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
        items: [{ itemid: s.itemid, productid: s.productid, batch: s.batch, price: s.price, mrpcost: s.mrpcost, taxpcnt: s.taxpcnt, qty, total }],
      }, COUNTER);
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
      return total;
    };
    // a busy day: more than one page of bills, some large and some small
    let have = (await truth(api)).count;
    while (have < 58) { await bill(1 + (have % 3)); have++; }

    const { page } = await app.open(MGR, '/secure/sales/list');
    const footer = async () => Number(((await page.getByTestId('total-cash').innerText()).replace(/,/g, '')));
    await expect(page.getByTestId('total-cash')).toBeVisible();
    const t1 = await truth(api);
    expect(t1.count, 'more bills than one page').toBeGreaterThan(50);
    await expect.poll(footer, { message: 'the Cash footer is the whole day, not the 50 most recent bills' }).toBeCloseTo(t1.cash, 1);
    expect(Number((await page.getByTestId('total-net').innerText()).replace(/,/g, ''))).toBeCloseTo(t1.net, 0);

    // one more bill, smaller than the oldest one that a first page would drop: the total goes UP by exactly its amount
    const added = await bill(1);
    await page.reload();
    await expect(page.getByTestId('total-cash')).toBeVisible();
    const t2 = await truth(api);
    expect(t2.cash).toBeCloseTo(t1.cash + added, 1);
    await expect.poll(footer).toBeCloseTo(t2.cash, 1);
  });
});
