// The price changes staff sheet (migration 158): what changed in the sale prices, grouped into increased and decreased, in what the customer pays. Gives four products a
// price history (it renames them ZZ price test N, so only use a scratch database): same setup as tests/invoice-scan-e2e.mjs, then  node tests/price-changes-e2e.mjs
import { execSync } from 'node:child_process';
const base = 'http://localhost:3100';
let token = '';
const get = async (path) => {
  const r = await fetch(base + path, { headers: { authorization: 'Bearer ' + token } });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
};
const sql = (q) => execSync(`docker exec -i rgp-db-dev-alt psql -U rgpapp -d rgp_todotest -Atc "${q}"`, { env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString().trim();
let failed = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + JSON.stringify(extra))); if (!ok) failed++; };
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// four products to give a price history to
const ids = sql(`select string_agg(id::text, ',') from (select id from product where active and not archive order by id desc limit 4) x`).split(',').map(Number);
const [pUp, pDown, pBack, pOld] = ids;
sql(`delete from product_price2 where product_id in (${ids.join(',')})`);
sql(`update product set title = 'ZZ price test ' || id where id in (${ids.join(',')})`);
const ins = (pid, eff, end, price, reason) => sql(`insert into product_price2 (product_id, eff_date, end_date, sale_price, reason, active, archive, created_by) values (${pid}, '${eff}', '${end}', ${price}, '${reason}', true, false, 1)`);
// rise: 100 -> 120 three days ago (GST 5% unless a purchase says otherwise)
ins(pUp, day(-30), day(-4), 100, 'Initial'); ins(pUp, day(-3), '2099-12-31', 120, 'MRP change');
// cut: 200 -> 150 two days ago
ins(pDown, day(-30), day(-3), 200, 'Initial'); ins(pDown, day(-2), '2099-12-31', 150, 'Policy');
// up and back within the period: no change to tell
ins(pBack, day(-30), day(-6), 80, 'Initial'); ins(pBack, day(-5), day(-3), 90, 'Market'); ins(pBack, day(-2), '2099-12-31', 80, 'Correction');
// changed long ago: outside the default period
ins(pOld, day(-90), day(-61), 50, 'Initial'); ins(pOld, day(-60), '2099-12-31', 70, 'Policy');

token = (await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'scan-e2e@example.com', password: 'Scan#Test1' }) })).json()).token;

let r = await get('/price-changes');
check('the sheet loads for the default period (last 14 days)', r.status === 200 && Array.isArray(r.body.increased), r);
const find = (list, pid) => list.find((c) => c.productid === pid);
const up = find(r.body.increased, pUp), down = find(r.body.decreased, pDown);
check('the rise is listed as an increase: 100 -> 120 before GST, in what the customer pays', up && up.newprice > up.oldprice && Math.abs(up.pct - 20) < 0.2, up);
check('its reason is in plain words', up && up.reasonlabel === 'MRP change', up);
check('the cut is listed as a decrease', down && down.newprice < down.oldprice && down.change < 0, down);
check('a price that went up and came back is not listed', !find(r.body.increased, pBack) && !find(r.body.decreased, pBack), r.body.counts);
check('a change from 60 days ago is not in the default period', !find(r.body.increased, pOld), null);
check('the cut comes under decreased and the rise under increased, never mixed', !find(r.body.decreased, pUp) && !find(r.body.increased, pDown), null);

r = await get(`/price-changes?from=${day(-100)}&to=${day(0)}`);
check('a longer period includes the old change', !!find(r.body.increased, pOld), r.body.counts);
r = await get(`/price-changes?min=25`);
check('a minimum percent hides the smaller ones (the 20% rise is hidden, the 25% cut stays)', !find(r.body.increased, pUp) && !!find(r.body.decreased, pDown), r.body.counts);
r = await get(`/price-changes?from=${day(0)}&to=${day(-5)}`);
check('a backwards period is refused', r.status === 400, r.body);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
