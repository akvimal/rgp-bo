/**
 * Voiding a bill rung up by mistake - VOID-1..4
 * Allowed only while the bill's shift is still open, by the person who rang it (or a manager), and never once something was returned.
 * The bill stays on record as VOID; stock comes back and the shift's cash is corrected.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const OPERATOR = { operatorId: 3, operatorName: 'Sale Staff One' };

async function sellable(api: any) {
  const rows = (await api.request('POST', '/stock/filter', { available: true, limit: 400 }, COUNTER)).body
    .filter((x: any) => x.status === 'VERIFIED' && Number(x.sale_price) > 0 && Number(x.balance) >= 5 && x.exp_date);
  return rows[Math.floor(Math.random() * Math.min(rows.length, 20))];
}
const balanceOf = async (api: any, line: any) =>
  Number(((await api.request('POST', '/stock/filter', { available: true, limit: 400, id: line.id }, COUNTER)).body as any[]).find((r) => r.item_id === line.item_id)?.balance);

/** one unit of a stocked product, rung up as a completed cash bill by `who` */
async function bill(api: any, who: string, extra: any = {}) {
  const line = await sellable(api);
  const price = Number(line.sale_price);
  const total = +(price * (1 + Number(line.tax_pcnt || 0) / 100)).toFixed(2);
  const now = new Date().toISOString();
  const r = await api.request('POST', '/sales', {
    billdate: now, orderdate: now, cashamt: total, digiamt: 0, total, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
    items: [{ itemid: line.item_id, productid: line.id, batch: line.batch, price, mrpcost: line.mrp_cost, taxpcnt: Number(line.tax_pcnt || 0), qty: 1, total, status: 'Complete' }],
    ...extra,
  }, who);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return { id: r.body.id as number, line, total };
}
const saleOf = async (api: any, id: number) => (await api.request('GET', `/sales/${id}`, undefined, MGR)).body;

test.describe('Voiding a bill @p1', () => {
  test('VOID-1 a bill voided in its own shift stays on record as VOID, the stock comes back and the cash is reversed @happy', async ({ api }) => {
    const before = { stock: 0 };
    const line = await sellable(api);
    before.stock = await balanceOf(api, line);
    const b = await bill(api, COUNTER);                                  // its own line may differ from `line`: measure the one it sold
    const sold = await balanceOf(api, b.line);
    const sale = await saleOf(api, b.id);
    expect(sale.shiftid, 'the bill is on a shift').toBeTruthy();

    const beforeVoid = (await api.request('GET', `/store-cash/shifts/${sale.shiftid}/summary`, undefined, MGR)).body;
    const res = await api.request('POST', `/sales/${b.id}/void`, { reason: 'rung up twice' }, COUNTER);
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
    expect(res.body.status).toBe('VOID');
    expect(res.body.cashreversed).toBeGreaterThan(0);

    const after = await saleOf(api, b.id);
    expect(after.status).toBe('VOID');
    expect((after.items || []).length).toBe((sale.items || []).length);   // the voided bill still shows what was on it
    expect(await balanceOf(api, b.line)).toBe(sold + 1);                 // the unit is back on the shelf

    const summary = async () => (await api.request('GET', `/store-cash/shifts/${sale.shiftid}/summary`, undefined, MGR)).body;
    const after2 = await summary();
    expect(Number(after2.expected)).toBeCloseTo(Number(beforeVoid.expected) - b.total, 2);      // the shift's expected cash is back to what it was
    expect(Number(after2.bills)).toBe(Number(beforeVoid.bills) - 1);

    const again = await api.request('POST', `/sales/${b.id}/void`, { reason: 'again' }, COUNTER);
    expect(again.status).toBe(400);
    expect(again.body.message).toContain('already voided');
  });

  test('VOID-2 a reason is needed, and only your own bills can be voided unless you are a manager @permission', async ({ api }) => {
    const mine = await bill(api, MGR);
    const noReason = await api.request('POST', `/sales/${mine.id}/void`, { reason: ' ' }, MGR);
    expect(noReason.status).toBe(400);
    expect(noReason.body.message).toContain('why');

    const notYours = await api.request('POST', `/sales/${mine.id}/void`, { reason: 'not mine to void' }, COUNTER);   // a counter login with no void right
    expect(notYours.status).toBe(400);
    expect(notYours.body.message).toContain('only the bills you rang up');
    expect((await saleOf(api, mine.id)).status).toBe('COMPLETE');

    const theirs = await bill(api, COUNTER);
    const byManager = await api.request('POST', `/sales/${theirs.id}/void`, { reason: 'counter rang it twice' }, MGR);
    expect(byManager.status, JSON.stringify(byManager.body)).toBeLessThan(300);
    expect((await saleOf(api, theirs.id)).status).toBe('VOID');
  });

  test('VOID-3 a bill of a closed shift, or a held bill, cannot be voided @edge', async ({ api }) => {
    const closedShift = new Map<number, boolean>();
    let old: any = null;
    // newer bills are all on the shift that is open now: page back until one from a closed shift turns up
    for (let page = 1; page <= 12 && !old; page++) {
      const res = (await api.request('GET', `/sales?limit=200&page=${page}`, undefined, MGR)).body;
      const list = ((res.data || res) as any[]).filter((x) => x.status === 'COMPLETE' && x.shiftid);
      if (!list.length) break;
      for (const s of list) {
        if (!closedShift.has(s.shiftid)) {
          const sh = (await api.request('GET', `/store-cash/shifts/${s.shiftid}/summary`, undefined, MGR)).body;
          closedShift.set(s.shiftid, `${sh?.shift?.status}`.toUpperCase() === 'CLOSED');
        }
        if (closedShift.get(s.shiftid)) { old = s; break; }
      }
    }
    expect(old, 'a completed bill of a closed shift').toBeTruthy();
    const closed = await api.request('POST', `/sales/${old.id}/void`, { reason: 'too late' }, MGR);
    expect(closed.status).toBe(400);
    expect(closed.body.message).toContain('shift is closed');

    const held = await bill(api, COUNTER, { status: 'PENDING', cashamt: 0 });
    const heldVoid = await api.request('POST', `/sales/${held.id}/void`, { reason: 'held bill' }, COUNTER);
    expect(heldVoid.status).toBe(400);
    expect(heldVoid.body.message).toContain('discarded');
  });

  test('VOID-4 on the bill: Void bill asks why, then marks it voided @happy', async ({ app, api }) => {
    const b = await bill(api, COUNTER);
    const sale = await saleOf(api, b.id);
    const { page } = await app.open(COUNTER, `/secure/sales/pos/view/${b.id}`, { ...OPERATOR, storeId: sale.storeid });
    await page.getByTestId('bill-void').click();
    await page.getByTestId('bill-void-confirm').click();
    await expect(page.getByTestId('bill-void-error')).toContainText('why');
    await page.getByTestId('bill-void-reason').fill('rung up by mistake');
    await page.getByTestId('bill-void-confirm').click();
    await expect(page.getByTestId('bill-voided')).toBeVisible();
    await expect(page.getByTestId('bill-void')).toHaveCount(0);
    expect((await saleOf(api, b.id)).status).toBe('VOID');
  });
});
