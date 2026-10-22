/**
 * Cross-sell and up-sell prompts at the counter — SUG-1..2
 * What customers bought together, a longer supply for a regular medicine, and the log that measures acceptance.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';

let POOL: any[] = [];
let CHRONIC: any = null;
test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
  const rows = await (await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
    body: JSON.stringify({ available: true, limit: 300 }),
  })).json();
  const ok = rows.filter((x: any) => Number(x.balance) > 30 && x.status === 'VERIFIED' && x.exp_date && new Date(x.exp_date) > new Date(Date.now() + 90 * 86400000) && (x.more_props?.schedule ?? '') !== 'H1');
  POOL = ok.map((x: any) => ({ itemid: x.item_id, productid: x.id, batch: x.batch, price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)), mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12 }));
  const chronic = ok.find((x: any) => String(x.more_props?.chronic) === 'true');
  CHRONIC = chronic ? { productid: chronic.id, title: chronic.title } : null;
});

function twoLineBill(a: any, b: any) {
  const now = new Date().toISOString();
  const total = a.price + b.price;
  return {
    customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7,
    status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [a, b].map(x => ({ itemid: x.itemid, productid: x.productid, batch: x.batch, price: x.price, mrpcost: x.mrpcost, taxpcnt: x.taxpcnt, qty: 1, total: x.price })),
  };
}

test.describe('Cross-sell and up-sell @p1', () => {
  test('SUG-1 bought-together and bulk-supply suggestions, never what is already on the bill @happy', async ({ api }) => {
    test.skip(POOL.length < 6, 'not enough stock to build bills');
    const A = POOL[POOL.length - 5], B = POOL[POOL.length - 6];
    let storeId = 0;
    for (let i = 0; i < 3; i++) {
      const sale = await api.request('POST', '/sales', twoLineBill(A, B), COUNTER);
      expect(sale.status).toBeLessThan(300);
      storeId = sale.body.storeid;
    }

    const suggest = (items: any[]) => api.request('POST', '/sale-suggestions', { storeid: storeId, items }, COUNTER);
    const s = await suggest([{ productid: A.productid }]);
    expect(s.status).toBeLessThan(300);
    const hit = s.body.crossSell.find((x: any) => x.productid === B.productid);
    expect(hit).toBeTruthy();
    expect(hit.together).toBeGreaterThanOrEqual(3);
    expect(hit.price).toBeGreaterThan(0);

    // what is already on the bill is never suggested; an empty bill suggests nothing
    const both = await suggest([{ productid: A.productid }, { productid: B.productid }]);
    expect(both.body.crossSell.some((x: any) => x.productid === A.productid || x.productid === B.productid)).toBe(false);
    expect((await suggest([])).body).toEqual({ crossSell: [], upsell: [] });

    // a regular medicine is offered as a longer supply, until the line already is one
    if (CHRONIC) {
      const bulk = (await suggest([{ productid: CHRONIC.productid }])).body.upsell.find((u: any) => u.kind === 'BULK_SUPPLY');
      expect(bulk).toMatchObject({ anchorproductid: CHRONIC.productid, months: 3 });
      expect((await suggest([{ productid: CHRONIC.productid, supplymonths: 3 }])).body.upsell.some((u: any) => u.kind === 'BULK_SUPPLY')).toBe(false);
    }
  });

  test('SUG-2 shown, added and dismissed are logged, and taken suggestions count towards KPI @integration', async ({ api }) => {
    const ev = (events: any[]) => api.request('POST', '/sale-suggestions/events', { storeid: 1, events }, COUNTER);
    expect((await ev([{ kind: 'NOPE', action: 'SHOWN' }])).status).toBe(400);
    expect((await ev([{ kind: 'CROSS_SELL', action: 'MAYBE' }])).status).toBe(400);

    const me = (await api.request('GET', '/auth/me', undefined, COUNTER)).body.id as number;
    const staff = (await api.request('GET', '/hr/staff', undefined, MGR)).body;
    let emp = staff.find((r: any) => r.email === COUNTER);
    if (!emp) {
      const made = await api.request('POST', '/hr/staff', { user_id: me, join_date: '2020-01-01' }, MGR);
      expect(made.status).toBeLessThan(300);
      emp = { id: made.body.id };
    }
    const metric = await api.request('POST', '/hr/kpi/metrics', { name: 'QA Suggestions taken', max_points: 10, source: 'SYSTEM', system_key: 'SUGGESTIONS_ADDED', rule: { kind: 'linear', target: 5, floor: 0 }, applies_roles: ['Sales Staff'] }, MGR);
    expect(metric.status).toBeLessThan(300);

    const period = new Date().toISOString().slice(0, 7);
    const figure = async () => (await api.request('GET', `/hr/kpi/month?period=${period}`, undefined, MGR)).body.find((r: any) => r.employee_id === emp.id).items.find((i: any) => i.name === 'QA Suggestions taken');
    const before = (await figure()).raw as number;

    const logged = await ev([
      { kind: 'CROSS_SELL', action: 'SHOWN', suggested_product_id: 1 },
      { kind: 'CROSS_SELL', action: 'ADDED', suggested_product_id: 1 },
      { kind: 'BULK_SUPPLY', action: 'DISMISSED', anchor_product_id: 1 },
    ]);
    expect(logged.body.logged).toBe(3);
    const after = await figure();
    expect(after.raw).toBe(before + 1);
    expect(after.evidence).toMatch(/taken of \d+ shown/);
  });
});
