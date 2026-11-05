// End-to-end check of the scanned-invoice draft (migration 157): save a draft with only a vendor and a store, keep the reading with it, check lines one at a time
// (each becomes a VERIFIED item), discard what is not on the invoice, and complete only when nothing is left to check.
//
// Run it against a SCRATCH database, never the production one api-v2/.env points at:
//   1. apply sql/migrations/157_invoice_scan_lines.sql to the scratch database
//   2. start the API on the scratch database:  DATABASE_URL=<scratch url> PORT=3100 MFA_MODE=off node dist/main
//   3. add a login (Business Head) with email scan-e2e@example.com and password Scan#Test1, and make sure vendor 101, store 2 and products 201, 202, 204, 209
//      exist (change the ids below to match your scratch data; 209 must have no purchase history)
//   4. node tests/invoice-scan-e2e.mjs
const base = 'http://localhost:3100';
let token = '';
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
};
let failed = 0;
const tag = String(Date.now()).slice(-7);
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(extra))); if (!ok) failed++; };

const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'scan-e2e@example.com', password: 'Scan#Test1' }) });
token = (await login.json()).token;

// 1. a draft with only a vendor and a store
let r = await call('POST', '/purchases', { vendorid: 101, storeid: 2, draft: true });
check('a draft is saved with only a vendor and a store', r.status === 201 || r.status === 200, r);
const inv = r.body.id;
const [rowNo] = [r.body.invoiceno];
check('the draft has no number yet', rowNo === null || rowNo === undefined, r.body);

// 2. without the draft flag a number is still required
r = await call('POST', '/purchases', { vendorid: 101, storeid: 2 });
check('without the draft flag the number is still required', r.status === 400, r);

// 3. the reading is saved with the draft
const lines = [
  { description: 'PARACETAMOL 650 STRIP', productid: 201, suggestions: [{ id: 201, title: 'Paracetamol 650', score: 0.95, tax_pcnt: 12 }], batch: 'pc650a', exp: '2027-08', mrp: 30, qty: 10, free: 0, rate: 20, disc: 0, tax: 12, warnings: [] },
  { description: 'VITAMIN C 500 TAB', productid: 202, suggestions: [], batch: '', exp: '', mrp: 90, qty: 5, free: 1, rate: 60, disc: 5, tax: 12, warnings: ['batch not read'] },
  { description: 'GOODS VALUE SUBTOTAL', productid: null, suggestions: [], batch: '', exp: '', mrp: null, qty: 1, free: 0, rate: 5, disc: 0, tax: null, warnings: [] },
];
r = await call('PUT', `/purchases/${inv}/scan`, { meta: { method: 'text', cashFactor: 1 }, lines });
check('the reading is saved: 3 open lines', r.status === 200 && r.body.counts?.open === 3, r);
const [l1, l2, l3] = r.body.lines;
check('line 1 is complete, line 2 lacks batch and expiry, line 3 lacks product etc.', l1.complete && l2.missing.join() === 'batch,expiry' && l3.missing.includes('product'), r.body.lines.map((l) => l.missing));
check('the batch was upper-cased', l1.batch === 'PC650A', l1);

// 4. check line 1: it becomes a VERIFIED item and the invoice total follows
r = await call('POST', `/purchases/${inv}/scan/lines/${l1.id}/verify`);
check('line 1 is checked', r.status === 201 || r.status === 200, r);
check('it is now a verified state with an item', r.body.state === 'VERIFIED' && r.body.itemid > 0, r.body);
const item1 = r.body.itemid;
r = await call('GET', `/purchases/${inv}`);
check('the invoice total follows (10 x 20 = 200)', Math.round(r.body.total) === 200, { total: r.body.total });
r = await call('GET', `/purchases/${inv}`);

// 5. an incomplete line cannot be checked; after the fix it can
r = await call('POST', `/purchases/${inv}/scan/lines/${l2.id}/verify`);
check('line 2 cannot be checked while incomplete', r.status === 400 && /needs: batch, expiry/.test(JSON.stringify(r.body)), r);
r = await call('PUT', `/purchases/${inv}/scan/lines/${l2.id}`, { batch: 'vc1', exp: '2026-12' });
check('a correction is saved and the line is now complete', r.status === 200 && r.body.complete === true, r);
r = await call('PUT', `/purchases/${inv}/scan/lines/${l2.id}`, { exp: '12/26' });
check('a badly typed expiry is refused', r.status === 400, r);

// 6. completing is refused while a line is open, and while there is no number
r = await call('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } });
check('completing is refused (no number yet)', r.status === 400 && /invoice number/.test(JSON.stringify(r.body)), r);
r = await call('POST', '/purchases', { id: inv, invoiceno: 'SE1' + tag, invoicedate: new Date().toISOString().slice(0, 10), vendorid: 101, storeid: 2 });
check('the number can be added to the draft later', r.status === 201 || r.status === 200, r);
r = await call('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } });
check('completing is refused while lines are still open', r.status === 400 && /still to check/.test(JSON.stringify(r.body)), r);

// 7. check line 2, discard line 3 with a reason
r = await call('POST', `/purchases/${inv}/scan/lines/${l2.id}/verify`);
check('line 2 is checked', r.status === 201 || r.status === 200, r);
r = await call('POST', `/purchases/${inv}/scan/lines/${l3.id}/discard`, { reason: 'x' });
check('a discard needs a reason', r.status === 400, r);
r = await call('POST', `/purchases/${inv}/scan/lines/${l3.id}/discard`, { reason: 'the subtotal row, not a product' });
check('line 3 is discarded', r.body.state === 'DISCARDED', r);
r = await call('GET', `/purchases/${inv}/scan`);
check('progress is 2 checked, 1 discarded, 0 open', r.body.counts.verified === 2 && r.body.counts.discarded === 1 && r.body.counts.open === 0, r.body.counts);

// 8. an edit of a checked line is refused until it is unchecked; unchecking removes the item
r = await call('PUT', `/purchases/${inv}/scan/lines/${l1.id}`, { qty: 99 });
check('a checked line cannot be edited', r.status === 400, r);
r = await call('POST', `/purchases/${inv}/scan/lines/${l1.id}/unverify`);
check('unchecking puts the line back to open', r.status === 201 || r.status === 200 ? r.body.state === 'OPEN' : false, r);
r = await call('GET', `/purchases/${inv}`);
check('and the invoice total drops back (only line 2: 5 x 60 x 0.95 = 285)', Math.round(r.body.total) === 285, { total: r.body.total });
r = await call('POST', `/purchases/${inv}/scan/verify-all`);
check('check all complete lines re-checks line 1', r.status === 201 || r.status === 200 ? r.body.verified === 1 && r.body.skipped === 0 : false, r.body?.message ?? r.body);

// 9. a second reading replaces only open lines
r = await call('PUT', `/purchases/${inv}/scan`, { lines: [{ description: 'ORS POWDER', productid: 204, batch: 'o1', exp: '2027-01', mrp: 20, qty: 3, rate: 12, tax: 5 }] });
check('a new reading keeps the checked lines and adds the new open one', r.body.counts.verified === 2 && r.body.counts.open === 1, r.body.counts);

// 10. completing now: the new line is open
r = await call('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } });
check('completing is still refused with an open line', r.status === 400 && /still to check/.test(JSON.stringify(r.body)), r);
const open = (await call('GET', `/purchases/${inv}/scan`)).body.lines.find((l) => l.state === 'OPEN');
await call('POST', `/purchases/${inv}/scan/lines/${open.id}/discard`, { reason: 'not on this invoice' });
r = await call('POST', `/purchases/${inv}/scan/lines/${open.id}/restore`);
check('a discarded line can be restored', r.body.state === 'OPEN', r);
await call('POST', `/purchases/${inv}/scan/lines/${open.id}/discard`, { reason: 'not on this invoice' });

// 11. the draft can now be completed (other rules of the invoice permitting) and has no scan left open
r = await call('PUT', '/purchases/confirm', { ids: [inv], values: { status: 'COMPLETE' } });
console.log('complete ->', r.status, JSON.stringify(r.body).slice(0, 200));
check('the gate no longer blocks completion (any refusal is another rule)', !/still to check|invoice number/.test(JSON.stringify(r.body)), r.body);

// 12. a clean second invoice is completed for real; afterwards its scan cannot be changed
r = await call('POST', '/purchases', { vendorid: 101, storeid: 2, draft: true, invoiceno: 'SE2' + tag, invoicedate: new Date().toISOString().slice(0, 10) });
const inv2 = r.body.id;
r = await call('PUT', `/purchases/${inv2}/scan`, { lines: [{ description: 'PARACETAMOL', productid: 209, batch: 'z1', exp: '2027-08', mrp: 30, qty: 4, rate: 20, tax: 12 }] });
const only = r.body.lines[0];
await call('POST', `/purchases/${inv2}/scan/verify-all`);
r = await call('PUT', '/purchases/confirm', { ids: [inv2], values: { status: 'COMPLETE' } });
console.log('complete 2 ->', r.status, JSON.stringify(r.body).slice(0, 160));
check('a fully checked scanned invoice is completed', r.status === 200, r.body);
r = await call('POST', `/purchases/${inv2}/scan/lines/${only.id}/unverify`);
check('a completed invoice cannot be changed through its scan', r.status === 400 && /draft/.test(JSON.stringify(r.body)), r);
r = await call('GET', `/purchases/${inv2}/scan`);
check('but its scan can still be read', r.status === 200 && r.body.counts.verified === 1, r.body.counts);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
