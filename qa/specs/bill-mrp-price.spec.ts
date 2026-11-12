/**
 * The customer's bill when items are sold at the MRP — BILLP-1
 * An item sold at its MRP has a rate before GST of MRP / (1 + GST), so the line amount is the MRP itself. With 5% and 18% GST on one bill, the lines show the
 * MRP as the amount, there is no "You saved" box (nothing was saved), and the totals tally: Total (GST included) + round off = Net total.
 * Set QA_SHOT_DIR to keep a picture of the bill.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const COUNTER = 'sales1@local.test';
const run = Date.now().toString().slice(-7);

/** a fresh product with one batch bought at a cost well below the MRP, GST as given, pack 1 */
async function product(api: any, tag: string, tax: number, mrp: number) {
  const v = (await api.request('GET', '/vendors', undefined, MGR)).body[0].id;
  const inv = await api.request('POST', '/purchases', { vendorid: v, invoiceno: `QA-BP-${tag}`, invoicedate: '2026-10-01' }, MGR);
  const prod = await api.request('POST', '/products', { title: `QA MRP ITEM ${tag} (${tax}%)`, taxpcnt: tax, category: 'Analgesic', code: `BP${tag}`, pack: 1, props: {} }, MGR);
  const it = await api.request('POST', '/purchaseitems', {
    invoiceid: inv.body.id, productid: prod.body.id, qty: 50, ptrvalue: mrp * 0.5, ptrcost: mrp * 0.5, mrpcost: mrp, saleprice: mrp, taxpcnt: tax, total: 50 * mrp * 0.5, batch: `BP-${tag}`, expdate: '2028-06-30',
  }, MGR);
  expect(it.status, JSON.stringify(it.body)).toBeLessThan(300);
  return { itemid: it.body.id as number, productid: prod.body.id as number, batch: `BP-${tag}`, title: `QA MRP ITEM ${tag} (${tax}%)`, tax, mrp };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

test.describe('Bill at the MRP @p1', () => {
  test('BILLP-1 items sold at their MRP, with 5% and 18% GST, give a bill that tallies @happy', async ({ api, app }, testInfo) => {
    const a = await product(api, `a-${run}`, 5, 105);          // 5%: rate 100.00, amount 105.00
    const b = await product(api, `b-${run}`, 18, 118);         // 18%: rate 100.00, amount 118.00
    const c = await product(api, `c-${run}`, 5, 77);           // an MRP that does not divide evenly: rate 73.33
    const d = await product(api, `d-${run}`, 18, 50);          // rate 42.37
    const lines = [
      { p: a, qty: 2 }, { p: b, qty: 1 }, { p: c, qty: 3 }, { p: d, qty: 1 },
    ].map(({ p, qty }) => {
      const price = r2(p.mrp / (1 + p.tax / 100));              // the rate before GST, as the till sets it
      const total = r2(qty * price * (1 + p.tax / 100));        // the amount: GST on top of the rate, which is the MRP again
      return { itemid: p.itemid, productid: p.productid, batch: p.batch, price, mrpcost: p.mrp, taxpcnt: p.tax, qty, total, status: 'Complete' };
    });
    const sum = r2(lines.reduce((t, l) => t + l.total, 0));
    const net = Math.round(sum);
    const now = new Date().toISOString();
    const sale = await api.request('POST', '/sales', {
      billdate: now, orderdate: now, cashamt: net, digiamt: 0, total: net, discamount: 0, expreturndays: 7, status: 'COMPLETE', ordertype: 'Walk-in', deliverytype: 'Counter',
      customer: { name: 'QA MRP Customer', mobile: `9${Math.floor(100000000 + Math.random() * 899999999)}` }, items: lines,
    }, COUNTER);
    expect(sale.status, JSON.stringify(sale.body)).toBeLessThan(300);

    const biz = (await api.request('GET', '/businesses/mine', undefined, MGR)).body;
    try {
      await api.request('PUT', '/businesses/mine', { showmrp: true, showsaving: true }, MGR);
      const { page } = await app.open(MGR, `/secure/sales/pos/view/${sale.body.id}`);
      await page.setViewportSize({ width: 1280, height: 900 });
      await expect(page.getByTestId('bill-line')).toHaveCount(4);
      await expect(page.getByTestId('bill-mrp-col')).toHaveCount(1);                                // the business's choice of columns arrives with the bill header

      // every line: the amount is the MRP times the quantity, the rate is before GST, the MRP column agrees
      const rows = await page.getByTestId('bill-line').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())));
      const num = (s: string) => Number(s.replace(/[^0-9.\-]/g, ''));
      const col = { qty: 3, mrp: 4, rate: 5, gst: 6, amount: 7 };
      lines.forEach((l, i) => {
        expect(num(rows[i][col.qty])).toBe(l.qty);
        expect(num(rows[i][col.mrp])).toBe(l.mrpcost);
        expect(num(rows[i][col.rate])).toBe(l.price);
        expect(num(rows[i][col.gst])).toBe(l.taxpcnt);
        expect(num(rows[i][col.amount])).toBe(l.total);
        expect(Math.abs(num(rows[i][col.amount]) - l.mrpcost * l.qty)).toBeLessThan(0.05);      // sold at the MRP
      });

      // nothing was saved against the MRP, so no saving box; the totals tally
      await expect(page.getByTestId('bill-saved')).toHaveCount(0);
      await expect(page.getByTestId('bill-net')).toHaveText(`₹${net.toFixed(2)}`);
      const roundOff = r2(net - sum);
      if (Math.abs(roundOff) > 0.004) {
        await expect(page.getByTestId('bill-total')).toContainText(sum.toFixed(2));
        await expect(page.locator('.bill-totals')).toContainText(Math.abs(roundOff).toFixed(2));
      }
      if (await page.getByTestId('bill-total').count()) await expect(page.getByTestId('bill-total')).toContainText('Total (GST included)');
      const shown = await page.locator('.bill-totals tr').evaluateAll((trs) => trs.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()));
      expect(shown.some((x) => x.startsWith('GST included')), 'no separate GST line: the total says it is GST included').toBe(false);
      const total = num(shown.find((s) => s.startsWith('Total'))?.replace('Total (GST included)', '') ?? String(net));
      const round = num((shown.find((s) => s.startsWith('Round off')) ?? 'Round off 0').replace('Round off', '').replace('−', '-'));
      expect(r2(total + round)).toBe(net);                                                          // Total + round off = Net total
      await expect(page.getByTestId('bill-words')).toContainText('Rupees');

      // columns still line up with the extra MRP column, and nothing overflows the page
      for (const c2 of [3, 4, 5, 6, 7]) {
        const edges = await page.getByTestId('bill-line').evaluateAll((trs, k) => trs.map((tr) => Math.round(tr.children[k as number].getBoundingClientRect().right)), c2);
        expect(new Set(edges).size, `column ${c2}`).toBe(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      if (process.env.QA_SHOT_DIR) await page.getByTestId('bill').screenshot({ path: `${process.env.QA_SHOT_DIR}/bill-at-mrp-with-mrp-column.png` });

      // the default: the MRP column hidden, the product column wider
      await api.request('PUT', '/businesses/mine', { showmrp: false }, MGR);
      await page.reload();
      await expect(page.getByTestId('bill-line')).toHaveCount(4);
      await expect(page.getByTestId('bill-mrp-col')).toHaveCount(0);
      await expect(page.getByTestId('bill-net')).toHaveText(`₹${net.toFixed(2)}`);
      if (process.env.QA_SHOT_DIR) await page.getByTestId('bill').screenshot({ path: `${process.env.QA_SHOT_DIR}/bill-at-mrp-default.png` });
      testInfo.annotations.push({ type: 'bill', description: `lines ${lines.map((l) => l.total).join(' + ')} = ${sum}, net ${net}` });
    } finally {
      await api.request('PUT', '/businesses/mine', { showmrp: biz.showmrp ?? false, showsaving: biz.showsaving ?? true }, MGR);
    }
  });
});
