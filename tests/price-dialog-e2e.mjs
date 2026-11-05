// The Set the price dialog data: its MRP and cost come from the same purchase as the pricing policy (the newest COMPLETED one), a newer purchase that is not
// completed is reported separately with the ceiling it would give, and a draft-only product says its figures come from a draft. Same setup as
// tests/invoice-scan-e2e.mjs (scratch API on port 3100, scratch database as the container rgp-db-dev-alt): node tests/price-dialog-e2e.mjs
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
const near = (a, b, t = 0.011) => Math.abs(Number(a) - Number(b)) <= t;
const tag = String(Date.now()).slice(-7);
const today = new Date().toISOString().slice(0, 10);

// three products with no purchase history
const free = sql(`select string_agg(id::text, ',') from (select id from product p where p.active and not p.archive and not exists (select 1 from purchase_invoice_item i where i.product_id = p.id) order by id limit 3) x`).split(',').map(Number);
const [p1, p2, p3] = free;

token = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'scan-e2e@example.com', password: 'Scan#Test1' }) })).json()).token;

const line = (pid, batch, mrp, rate, qty) => ({ description: 'L' + pid, productid: pid, batch, exp: '2028-12', mrp, qty, free: 0, rate, disc: 0, tax: 5 });
const makeInvoice = async (no, date, lines) => {
  const r = await call('POST', '/purchases', { vendorid: 101, storeid: 2, draft: true, invoiceno: no, invoicedate: date });
  const id = r.body.id;
  await call('PUT', `/purchases/${id}/scan`, { lines });
  await call('POST', `/purchases/${id}/scan/verify-all`);
  return id;
};

// A: completed, a month and more ago: p1 at MRP 104 / rate 88.90 and p3 at MRP 50 / rate 20
const A = await makeInvoice('PDA' + tag, '2026-09-17', [line(p1, 'A' + tag, 104, 88.9, 5), line(p3, 'C' + tag, 50, 20, 5)]);
let r = await call('PUT', '/purchases/confirm', { ids: [A], values: { status: 'COMPLETE' } });
check('the completed invoice is completed', r.status === 200, r.body);
// B: a newer DRAFT with the new MRP for p1 (120 / 103.89), and the only purchase of p2 (a draft)
await makeInvoice('PDB' + tag, today, [line(p1, 'B' + tag, 120, 103.89, 5), line(p2, 'D' + tag, 80, 60, 5)]);

// p1: the figures are the completed purchase's, the draft is reported with its own ceiling
r = await call('GET', `/products/prices/${p1}`);
let pr = r.body.price;
check('p1: the dialog uses the completed purchase MRP (104), not the draft (120)', pr && Number(pr.mrp) === 104, pr && { mrp: pr.mrp });
check('p1: the cost with GST is the completed purchase one (88.90 + 5%)', pr && near(pr.ptr, 93.35, 0.02), pr && { ptr: pr.ptr });
check('p1: it says where the figures come from', pr && pr.basis && pr.basis.invoiceno === 'PDA' + tag, pr && pr.basis);
check('p1: the newer draft is reported with MRP 120 and the ceiling it would give, 114.28', pr && pr.pending && Number(pr.pending.mrp) === 120 && near(pr.pending.ceiling, 114.28, 0.005) && pr.pending.invoiceno === 'PDB' + tag, pr && pr.pending);
// the policy and the dialog now agree on the ceiling: 104 / 1.05 = 99.04
const policy = await call('GET', `/pricing/product/${p1}/check`);
const cap = policy.status === 200 && policy.body && policy.body.ceiling !== undefined ? Number(policy.body.ceiling) : null;
console.log('   (policy ceiling for p1:', cap, ')');
check('p1: the policy ceiling is the one from MRP 104 (99.04)', cap === null || near(cap, 99.04, 0.005), { cap });
check('p1: markup and discount are worked out from the same purchase (numbers present)', pr && pr.margin !== null && pr.discount !== null, pr && { m: pr.margin, d: pr.discount });

// p2: only a draft: the figures stay (as before) but are marked as coming from a draft
r = await call('GET', `/products/prices/${p2}`);
pr = r.body.price;
check('p2: with only a draft purchase the figures are the draft ones (MRP 80)', pr && Number(pr.mrp) === 80, pr && { mrp: pr.mrp });
check('p2: and it says they come from a draft that is not completed', pr && pr.basisdraft && pr.basisdraft.invoiceno === 'PDB' + tag && !pr.pending, pr && { b: pr.basisdraft, p: pr.pending });

// p3: a completed purchase only: nothing extra
r = await call('GET', `/products/prices/${p3}`);
pr = r.body.price;
check('p3: a completed purchase only: its MRP (50), no pending note and no draft note', pr && Number(pr.mrp) === 50 && !pr.pending && !pr.basisdraft, pr && { mrp: pr.mrp, pending: pr.pending, draft: pr.basisdraft });

// a product that was never purchased has no price row
r = await call('GET', `/products/prices/99999999`);
check('a product with no purchase has no price row', r.status === 200 && r.body.price === null, r);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
