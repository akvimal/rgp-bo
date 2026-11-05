// End-to-end check of purchase invoice totals: the invoice comes to its lines WITH GST (less a cash discount), the taxable value and GST are worked out on top of
// each line's amount before tax, and the total follows a line that is edited, a cash discount that is typed, and a line that is removed.
//
// Run it against a SCRATCH database, never the production one api-v2/.env points at (same setup as tests/invoice-scan-e2e.mjs):
//   apply the migrations, start the API on the scratch database (DATABASE_URL=<scratch url> PORT=3100 MFA_MODE=off node dist/main), add the login
//   scan-e2e@example.com / Scan#Test1 (Business Head), make sure vendor 101, store 2 and products 201, 202, 204, 209, 210, 211 exist, then:
//   node tests/invoice-totals-e2e.mjs
const base = 'http://localhost:3100';
let token = '';
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
};
let failed = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(extra))); if (!ok) failed++; };
const near = (a, b, tol = 0.011) => Math.abs(Number(a) - Number(b)) <= tol;
const tag = String(Date.now()).slice(-7);

token = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'scan-e2e@example.com', password: 'Scan#Test1' }) })).json()).token;

let r = await call('POST', '/purchases', { vendorid: 101, storeid: 2, draft: true, invoiceno: 'TOT' + tag, invoicedate: new Date().toISOString().slice(0, 10) });
const inv = r.body.id;
const L = (pid, rate, qty, disc, mrp, free = 0) => ({ description: 'L' + pid, productid: pid, batch: 'b' + pid, exp: '2028-01', mrp, qty, free, rate, disc, tax: 5 });
r = await call('PUT', `/purchases/${inv}/scan`, { lines: [L(201, 90, 3, 0, 109), L(202, 104.56, 3, 4, 137.23), L(204, 131.8, 3, 0, 155), L(209, 39.5, 2, 0, 45.63), L(210, 28.75, 10, 4, 65.63, 5), L(211, 311.16, 2, 4, 399)] });
check('six lines saved with the draft', r.status === 200 && r.body.counts.open === 6, r);
r = await call('POST', `/purchases/${inv}/scan/verify-all`);
check('all six checked', r.body.verified === 6, r.body);

// 1. the invoice comes to the lines with GST (the case that showed 2,014.91 but a balance of 1,928)
r = await call('GET', `/purchases/${inv}`);
let i = r.body;
check('the invoice total is the lines with GST, rounded: 2015', Number(i.total) === 2015, { total: i.total });
check('the taxable value is the lines before tax: 1918.96', near(i.taxablevalue, 1918.96), { taxablevalue: i.taxablevalue });
check('CGST + SGST is the GST on them: 95.95', near(Number(i.cgstamount) + Number(i.sgstamount), 95.95), { cgst: i.cgstamount, sgst: i.sgstamount });
check('the round-off is the small remainder', near(i.roundoff, 0.09, 0.02), { roundoff: i.roundoff });
check('the balance owed is the total (nothing paid)', Number(i.balanceamount) === 2015, { balance: i.balanceamount });
const items = i.items || [];
const first = items.find((x) => Number(x.ptrvalue) === 90);
check('each line keeps its amount before tax, and its taxable value equals it', items.length === 6 && items.every((x) => near(x.taxablevalue, x.total)), items.map((x) => [x.total, x.taxablevalue]));

// 2. a line edited after it was added: the invoice total follows (it used to stay as it was)
r = await call('PUT', '/purchaseitems', { ids: [first.id], values: { ptrvalue: 100, total: 300 } });
check('the line is edited', r.status === 200, r);
r = await call('GET', `/purchases/${inv}`);
i = r.body;
check('the invoice total follows the edit: (1918.96 - 270 + 300) x 1.05 = 2046.41 -> 2046', Number(i.total) === 2046, { total: i.total });
check('and so do the taxable value and the GST', near(i.taxablevalue, 1948.96) && near(Number(i.cgstamount) + Number(i.sgstamount), 97.45, 0.03), { t: i.taxablevalue, c: i.cgstamount, s: i.sgstamount });

// 3. a cash discount typed after the lines: it comes off the goods before tax
r = await call('PUT', '/purchases', { ids: [inv], values: { cashdiscount: 100 } });
check('the cash discount is saved', r.status === 200, r);
r = await call('GET', `/purchases/${inv}`);
i = r.body;
const expected = Math.round(2046.408 * ((1948.96 - 100) / 1948.96));
check(`the total takes the cash discount off: ${expected}`, Number(i.total) === expected, { total: i.total, expected });

// 4. a line removed: the total follows
const last = items.find((x) => Number(x.ptrvalue) === 311.16);
r = await call('DELETE', '/purchaseitems', { invoiceid: inv, ids: [last.id] });
r = await call('GET', `/purchases/${inv}`);
i = r.body;
const goods = 1948.96 - 597.43;
const exp2 = Number((goods * 1.05 * ((goods - 100) / goods)).toFixed(2));
check(`a removed line leaves the others: about ${exp2}`, near(i.total, exp2, 0.011), { total: i.total, exp2 });

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
