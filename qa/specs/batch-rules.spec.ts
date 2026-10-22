/**
 * Batch checks at the counter — BR-1..2
 *  - an older batch of the same product still in stock should be sold first (a warning the cashier confirms)
 *  - for a regular medicine the units are months of medicine (30 a month); the batch should still have 3 months left once the
 *    supply is used up, and the till warns, only when the batch and the quantity do not fit
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

type Batch = { itemid: number; productid: number; batch: string; exp: Date; price: number; mrpcost: number; taxpcnt: number };
let OLDER: Batch | null = null;
let NEWER: Batch | null = null;
let LONG: Batch | null = null;      // a well-stocked, long-dated line; the test makes its product a chronic medicine
let LONG_PROPS: any = {};

const addMonths = (d: Date, n: number) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCMonth(x.getUTCMonth() + Math.ceil(n)); return x; };

test.beforeAll(async () => {
  const t = (await (await fetch(`${process.env.QA_API_URL}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: MGR, password: process.env.QA_ADMIN_PASS || 'admin123' }),
  })).json()).token;
  const rows = await (await fetch(`${process.env.QA_API_URL}/stock/filter`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
    body: JSON.stringify({ available: true, limit: 500 }),
  })).json();
  const by = new Map<number, any[]>();
  for (const r of rows.filter((x: any) => x.status === 'VERIFIED' && Number(x.balance) > 5 && x.exp_date && new Date(x.exp_date) > new Date())) {
    by.set(r.id, [...(by.get(r.id) || []), r]);
  }
  const mk = (x: any): Batch => ({
    itemid: x.item_id, productid: x.id, batch: x.batch, exp: new Date(x.exp_date),
    price: Math.max(1, Math.round((Number(x.mrp_cost) || 20) * 0.8)), mrpcost: Number(x.mrp_cost) || 25, taxpcnt: Number(x.tax_pcnt) || 12,
  });
  // a well-stocked line whose batch can cover a month but not a very long supply: DAYS units fit 3 months-after, DAYS + 5 do not
  const threeMonths = addMonths(new Date(), 3).getTime();
  const daysOf = (x: any) => (new Date(x.exp_date).getTime() - threeMonths) / 86400000;
  // the line that needs the fewest units to prove the point (the test sells about twice that), so it does not drain stock other specs use
  const stocked = rows
    .filter((x: any) => x.status === 'VERIFIED' && (x.more_props?.schedule ?? '') !== 'H1' && x.exp_date && daysOf(x) >= 35 && Number(x.balance) >= 2 * daysOf(x) + 60)
    .sort((a: any, b: any) => daysOf(a) - daysOf(b))[0];
  if (stocked) { LONG = mk(stocked); LONG_PROPS = stocked.more_props ?? {}; }
  for (const list of by.values()) {
    const sorted = list.map(mk).sort((a, b) => +a.exp - +b.exp);
    if (sorted.length > 1 && +sorted[0].exp < +sorted[sorted.length - 1].exp) { OLDER = sorted[0]; NEWER = sorted[sorted.length - 1]; break; }
  }
});

function bill(b: Batch, extra: any = {}, status = 'COMPLETE') {
  const now = new Date().toISOString();
  return {
    customerid: data.anyCustomer(), billdate: now, orderdate: now, cashamt: b.price, digiamt: 0, total: b.price, discamount: 0, expreturndays: 7,
    status, ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: b.itemid, productid: b.productid, batch: b.batch, price: b.price, mrpcost: b.mrpcost, taxpcnt: b.taxpcnt, qty: 1, total: b.price, ...(extra.line || {}) }],
    ...(extra.bill || {}),
  };
}

test.describe('Batch checks at the counter @p1', () => {
  test('BR-1 selling a later-dated batch while an older one is in stock asks for confirmation @happy', async ({ api }) => {
    test.skip(!OLDER || !NEWER, 'the seed has no product with two live batches');
    const post = (b: any, who = CASHIER) => api.request('POST', '/sales', b, who);

    const warned = await post(bill(NEWER!, { bill: { checkbatches: true } }));
    expect(warned.status).toBe(409);
    expect(warned.body.code).toBe('SALE_WARNINGS');
    expect(warned.body.canOverride).toBe(true);
    expect(warned.body.warnings[0]).toMatchObject({ code: 'EARLIER_EXPIRY', suggest: OLDER!.batch, blocking: false });

    // the older batch sells without a word; so does a parked bill
    expect((await post(bill(NEWER!, { bill: { checkbatches: true } }, 'PENDING'))).status).toBeLessThan(300);
    expect((await post(bill(OLDER!, { bill: { checkbatches: true } }))).status).toBeLessThan(300);

    // the billing screen is what asks; a script posting bills is not stopped by it
    expect((await post(bill(NEWER!))).status).toBeLessThan(300);

    // confirming sells it, and the override is on the audit log
    const sold = await post(bill(NEWER!, { bill: { checkbatches: true, ackwarnings: true } }));
    expect(sold.status).toBeLessThan(300);
    const log = (await api.request('GET', '/audit?action=sale.batch_warning_overridden&limit=5', undefined, MGR)).body;
    const rows = Array.isArray(log) ? log : (log.rows || log.items || []);
    expect(JSON.stringify(rows)).toContain('EARLIER_EXPIRY');
  });

  test('BR-2 a regular medicine whose batch and quantity do not leave 3 months after the supply only warns @edge', async ({ api }) => {
    test.skip(!LONG, 'no well-stocked line with a batch of the right age');
    // make the product a regular (chronic) medicine for the test: 30 units are a month, and one unit a day
    await api.request('PUT', `/products/${LONG!.productid}`, { props: { ...LONG_PROPS, chronic: true } }, MGR);
    try {
      const fitDays = Math.floor((+LONG!.exp - addMonths(new Date(), 3).getTime()) / 86400000);
      const withQty = (qty: number, extra: any = {}, status = 'COMPLETE') => {
        const b = bill(LONG!, { bill: { checkbatches: true, ...(extra.bill || {}) } }, status);
        const total = LONG!.price * qty;
        return { ...b, cashamt: total, total, items: [{ ...b.items[0], qty, total }] };
      };
      const post = (b: any) => api.request('POST', '/sales', b, CASHIER);

      // more units than the batch can cover with 3 months to spare: a warning, not a stop
      const warned = await post(withQty(fitDays + 5));
      expect(warned.status).toBe(409);
      expect(warned.body.code).toBe('SALE_WARNINGS');
      expect(warned.body.canOverride).toBe(true);
      expect(warned.body.needsManager).toBe(false);
      expect(warned.body.warnings[0]).toMatchObject({ code: 'SHORT_DATED_FOR_SUPPLY', blocking: false });
      expect(warned.body.warnings[0].message).toContain('months');

      // what the batch can cover is fine; a parked bill is not checked
      expect((await post(withQty(fitDays - 1))).status).toBeLessThan(300);
      expect((await post(withQty(fitDays + 5, {}, 'PENDING'))).status).toBeLessThan(300);

      // the cashier can sell through it once they confirm, and it is audited
      expect((await post(withQty(fitDays + 5, { bill: { ackwarnings: true } }))).status).toBeLessThan(300);
      const log = (await api.request('GET', '/audit?action=sale.batch_warning_overridden&limit=10', undefined, MGR)).body;
      expect(JSON.stringify(Array.isArray(log) ? log : (log.rows || log.items || []))).toContain('SHORT_DATED_FOR_SUPPLY');
    } finally {
      await api.request('PUT', `/products/${LONG!.productid}`, { props: LONG_PROPS }, MGR);
    }
  });
});
