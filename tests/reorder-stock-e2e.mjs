// Reorder stock: batches that have expired (or expire within 30 days) are not stock, a product is never below 0 on the Reorder screen, and a product whose
// records say it would be is flagged "Stock Below Zero". Same setup as tests/invoice-scan-e2e.mjs, plus products 212 and 213 (no purchase history), a scratch
// database reachable as the container rgp-db-dev-alt (edit the docker exec line in sql() for another), then:  node tests/reorder-stock-e2e.mjs
import { execSync } from 'node:child_process';
const base = 'http://localhost:3100';
let token = '';
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
};
const sql = (q) => execSync(`docker exec -i rgp-db-dev-alt psql -U rgpapp -d rgp_todotest -Atc "${q}"`, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString().trim();
let failed = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(extra))); if (!ok) failed++; };
const tag = String(Date.now()).slice(-7);

// start clean: remove what an earlier run of this script left
sql(`delete from product_qtychange where item_id in (select id from purchase_invoice_item where invoice_id in (select id from purchase_invoice where invoice_no like 'RS%'))`);
sql(`delete from purchase_invoice_item where invoice_id in (select id from purchase_invoice where invoice_no like 'RS%')`);
sql(`delete from purchase_invoice where invoice_no like 'RS%'`);
sql(`update product set min_stock = 5, pack = 1 where id in (212, 213)`);
token = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'scan-e2e@example.com', password: 'Scan#Test1' }) })).json()).token;

// a draft invoice with: product 212 = an EXPIRED batch (10) and a good batch (30); product 213 = one good batch (30)
let r = await call('POST', '/purchases', { vendorid: 101, storeid: 2, draft: true, invoiceno: 'RS' + tag, invoicedate: new Date().toISOString().slice(0, 10) });
const inv = r.body.id;
const L = (pid, batch, exp, qty) => ({ description: 'L' + pid, productid: pid, batch, exp, mrp: 50, qty, free: 0, rate: 20, disc: 0, tax: 5 });
r = await call('PUT', `/purchases/${inv}/scan`, { lines: [L(212, 'OLD' + tag, '2024-01', 10), L(212, 'NEW' + tag, '2028-06', 30), L(213, 'ONLY' + tag, '2028-06', 30)] });
r = await call('POST', `/purchases/${inv}/scan/verify-all`);
check('three batches are in', r.body.verified === 3, r.body);

const itemOf = (pid, batch) => sql(`select id from purchase_invoice_item where product_id=${pid} and batch='${batch}'`);
const oldItem = itemOf(212, 'OLD' + tag), only = itemOf(213, 'ONLY' + tag);
// the old batch was written off far below what was bought; the only batch of 213 is oversold by 50
sql(`insert into product_qtychange (item_id, qty, sale_price, reason, reason_code, status, comments, store_id, discarded, created_by) values (${oldItem}, -50, 0, 'test', 'OTHER', 'APPROVED', 'test', 2, false, 1)`);
sql(`insert into product_qtychange (item_id, qty, sale_price, reason, reason_code, status, comments, store_id, discarded, created_by) values (${only}, -50, 0, 'test', 'OTHER', 'APPROVED', 'test', 2, false, 1)`);

r = await call('GET', '/purchase-suggestions?includezero=true&days=30&targetdays=21&storeid=2');
check('the suggestions load', r.status === 200 && Array.isArray(r.body), r);
const row = (id) => r.body.find((x) => Number(x.product_id) === id);
const a = row(212), b = row(213);
check('product 212: the expired oversold batch is not stock; the good batch is: 30', a && Number(a.available_stock) === 30 && Number(a.raw_stock) === 30, a && { s: a.available_stock, raw: a.raw_stock });
check('product 212 is not flagged', a && !a.reasons.includes('Stock Below Zero'), a && a.reasons);
check('product 213: a genuinely oversold batch shows 0, never below', b && Number(b.available_stock) === 0, b && { s: b.available_stock });
check('product 213 keeps what the records say (-20) and is flagged', b && Number(b.raw_stock) === -20 && b.reasons.includes('Stock Below Zero'), b && { raw: b.raw_stock, reasons: b.reasons });
check('product 213 order is not inflated by a negative stock: Trend Qty is not above the pace + min', b && Number(b.trend_qty) <= Number(b.forecast_qty) + Number(b.min_stock), b && { trend: b.trend_qty, forecast: b.forecast_qty });

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
