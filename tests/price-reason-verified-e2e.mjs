// A rate rise against the last purchase needs a reason before the invoice is completed, and the reason can be given on a VERIFIED line (the page used to show the
// reason box only for lines not yet verified, so a fully verified invoice could never be completed). Same setup as tests/invoice-scan-e2e.mjs: node tests/price-reason-verified-e2e.mjs
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
const today = new Date().toISOString().slice(0, 10);
const [p] = sql(`select id from product p where p.active and not p.archive and not exists (select 1 from purchase_invoice_item i where i.product_id = p.id) order by id limit 1`).split(',').map(Number);

token = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'scan-e2e@example.com', password: 'Scan#Test1' }) })).json()).token;
const line = (rate, batch) => ({ description: 'L', productid: p, batch, exp: '2028-12', mrp: 100, qty: 5, free: 0, rate, disc: 0, tax: 5 });
const make = async (no, date, rate, batch) => {
  const r = await call('POST', '/purchases', { vendorid: 101, storeid: 2, draft: true, invoiceno: no, invoicedate: date });
  await call('PUT', `/purchases/${r.body.id}/scan`, { lines: [line(rate, batch)] });
  await call('POST', `/purchases/${r.body.id}/scan/verify-all`);
  return r.body.id;
};

const A = await make('RA' + tag, '2026-09-01', 50, 'A' + tag);
let r = await call('PUT', '/purchases/confirm', { ids: [A], values: { status: 'COMPLETE' } });
check('the first purchase is completed', r.status === 200, r.body);

const B = await make('RB' + tag, today, 75, 'B' + tag);        // +50% against the last purchase
const items = (await call('GET', `/purchases/${B}`)).body.items;
check('the new line is VERIFIED (it came through the scan check)', items.length === 1 && items[0].status === 'VERIFIED', items.map((x) => x.status));
r = await call('PUT', '/purchases/confirm', { ids: [B], values: { status: 'COMPLETE' } });
check('completing is refused: a reason is needed for the rate rise', r.status === 400 && /Give a reason for the rate change/.test(JSON.stringify(r.body)), r.body);

// the reason is given on the VERIFIED line (this is what the page could not do)
r = await call('PUT', '/purchaseitems', { ids: [items[0].id], values: { pricereason: 'PRICE_REVISED' } });
check('a reason can be saved on a verified line', r.status === 200, r.body);
const chk = await call('GET', `/purchases/${B}/price-check`);
check('the price check now shows the reason on that line', chk.status === 200 && chk.body.lines.every((l) => l.level === 'NONE' || !!l.reason), chk.body.lines);
r = await call('PUT', '/purchases/confirm', { ids: [B], values: { status: 'COMPLETE' } });
check('the invoice is completed once the reason is given', r.status === 200, r.body);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
