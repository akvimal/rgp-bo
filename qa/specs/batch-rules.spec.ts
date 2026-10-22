/**
 * Batch checks at the counter — BR-1..2
 *  - an older batch of the same product still in stock should be sold first (a warning the cashier confirms)
 *  - a customer buying N months of medicine needs a batch that stays in date for N + 3 months (counter staff are stopped;
 *    a Store Head or Business Head can sell through it)
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const CASHIER = 'sales1@local.test';

type Batch = { itemid: number; productid: number; batch: string; exp: Date; price: number; mrpcost: number; taxpcnt: number };
let OLDER: Batch | null = null;
let NEWER: Batch | null = null;

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

  test('BR-2 a long supply needs a batch that outlasts it by the margin; counter staff are stopped, managers decide @edge', async ({ api }) => {
    test.skip(!OLDER || !NEWER, 'the seed has no product with two live batches');
    // choose the months so the older batch is too short and the newer one just long enough (3 months margin)
    const today = new Date();
    let months = 0;
    for (let s = 1; s <= 24; s++) {
      const need = addMonths(today, s + 3);
      if (need > OLDER!.exp && need <= NEWER!.exp) { months = s; break; }
    }
    test.skip(!months, 'the two batches are too close in date to separate with a whole number of months');

    const post = (b: any, who = CASHIER) => api.request('POST', '/sales', b, who);
    const short = { line: { supplymonths: months } };

    const stopped = await post(bill(OLDER!, short));
    expect(stopped.status).toBe(409);
    expect(stopped.body.warnings.some((w: any) => w.code === 'SHORT_DATED_FOR_SUPPLY' && w.blocking)).toBe(true);
    expect(stopped.body.warnings[0].suggest).toBeTruthy();                                        // points at a batch that is long enough
    expect(stopped.body.warnings[0].suggest).not.toBe(OLDER!.batch);
    expect(stopped.body.canOverride).toBe(false);
    expect(stopped.body.needsManager).toBe(true);

    // confirming is not enough for counter staff
    expect((await post(bill(OLDER!, { ...short, bill: { ackwarnings: true } }))).status).toBe(409);
    // the long-dated batch passes untouched, and the months are kept on the line
    const ok = await post(bill(NEWER!, short));
    expect(ok.status).toBeLessThan(300);
    const saved = (await api.request('GET', `/sales/${ok.body.id}`, undefined, CASHIER)).body;
    expect(Number(saved.items[0].supplymonths)).toBe(months);

    // a Business Head can sell through it knowingly; a parked bill is not checked
    expect((await post(bill(OLDER!, { ...short, bill: { ackwarnings: true } }), MGR)).status).toBeLessThan(300);
    expect((await post(bill(OLDER!, short, 'PENDING'))).status).toBeLessThan(300);
    // and a line with no stated supply is never held to it
    expect((await post(bill(OLDER!))).status).toBeLessThan(300);
  });
});
