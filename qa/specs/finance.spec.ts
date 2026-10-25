/**
 * Finance — FIN-1..6
 * Bank accounts at business or store level, statements from any bank read by their headings, each line tagged, the bank balance checked line by line,
 * the books compared with the bank (a difference up to the tolerance is accepted, a larger one needs a reason), and the records check.
 * Statements here are for a past month (March 2019), so the books side is empty and the sums are exact.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const STORE_HEAD = 'storehead@local.test';
const SALES = 'sales1@local.test';
const API = process.env.QA_API_URL as string;

const tokens: Record<string, string> = {};
async function token(email: string) {
  if (!tokens[email]) {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: process.env.QA_ADMIN_PASS || 'admin123', scope: 'business' }) });
    tokens[email] = (await r.json()).token;
  }
  return tokens[email];
}

/** a file upload to the API */
async function upload(path: string, text: string, filename = 'statement.txt', extra: Record<string, string> = {}, who = MGR) {
  const fd = new FormData();
  fd.append('file', new Blob([text]), filename);
  Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { authorization: `Bearer ${await token(who)}` }, body: fd });
  return { status: r.status, body: await r.json().catch(() => null) };
}

interface L { d: string; narr: string; dr?: number; cr?: number; ref?: string; }

/** an HDFC-style statement: padded, comma separated, a blank first line, dd/mm/yy dates */
function hdfc(lines: L[], opening = 100000, dropBalanceCheck = false) {
  let bal = opening;
  const rows = lines.map((l) => {
    bal = Math.round((bal - (l.dr || 0) + (l.cr || 0)) * 100) / 100;
    return ` ${l.d}  ,${l.narr},${l.d} ,${(l.dr || 0).toFixed(2).padStart(14)}  ,${(l.cr || 0).toFixed(2).padStart(14)}  ,${(l.ref || '0000000000').padEnd(16)},${bal.toFixed(2).padStart(14)}  `;
  });
  return ['', '  Date     ,Narration     ,Value Dat,Debit Amount       ,Credit Amount      ,Chq/Ref Number   ,Closing Balance', ...rows].join('\r\n');
}

const run = Date.now().toString().slice(-7);
const March = (day: number) => `${String(day).padStart(2, '0')}/03/19`;

async function newAccount(api: any, extra: any = {}) {
  const r = await api.request('POST', '/finance/accounts', { name: `QA bank ${run}-${Math.random().toString(36).slice(2, 6)}`, bank_name: 'QA Bank', last4: '1412', ...extra }, MGR);
  expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return r.body.id as number;
}

test.describe('Finance @p1', () => {
  test('FIN-1 only the Business Head reaches finance @negative', async ({ api }) => {
    expect((await api.request('GET', '/finance/accounts', undefined, STORE_HEAD)).status).toBe(403);
    expect((await api.request('GET', '/finance/accounts', undefined, SALES)).status).toBe(403);
    expect((await api.request('GET', '/finance/overview', undefined, STORE_HEAD)).status).toBe(403);
    const ok = await api.request('GET', '/finance/accounts', undefined, MGR);
    expect(ok.status).toBe(200);
    expect(ok.body.tolerance).toBe(100);
  });

  test('FIN-2 an account is for the business or one store, with only the last four digits @edge', async ({ api }) => {
    expect((await api.request('POST', '/finance/accounts', { name: '' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/finance/accounts', { name: 'x', last4: '12345678' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/finance/accounts', { name: 'x', store_id: 99999999 }, MGR)).status).toBe(400);
    const storeId = (await api.request('GET', '/finance/accounts', undefined, MGR)).body.stores[0].id;
    const business = await newAccount(api);
    const store = await newAccount(api, { store_id: storeId });
    const list = (await api.request('GET', '/finance/accounts', undefined, MGR)).body.accounts;
    expect(list.find((a: any) => a.id === business).store_id).toBeNull();
    expect(list.find((a: any) => a.id === store).store_id).toBe(storeId);
  });

  test('FIN-3 a statement is read, tagged, checked and imported once @happy', async ({ api }) => {
    const acc = await newAccount(api);
    const text = hdfc([
      { d: March(1), narr: `NEFT CR-YESB0000001-PAYTM PAYMENTS SERVICES LIMITED-SHOP-YESAP${run}`, cr: 6000, ref: `YESAP${run}` },
      { d: March(2), narr: 'CASH DEPOSIT BY - A PERSON - AREA', cr: 30000 },
      { d: March(3), narr: `NEFT DR-BARB0X-SOME PERSON ${run}-SHOP,MUM-HDFCH000-2307`, dr: 2000, ref: 'HDFCH000' },     // a comma inside a narration
      { d: March(4), narr: 'SMS CHARGES', dr: 20 },
      { d: March(5), narr: `UPI-RAVI KUMAR ${run}-ravi@okbank-ICIC0001-998`, dr: 500 },
    ]);
    const pv = await upload(`/finance/accounts/${acc}/preview`, text);
    expect(pv.status, JSON.stringify(pv.body)).toBeLessThan(300);
    expect(pv.body.recognised).toBe(true);
    expect(pv.body.rows).toBe(5);
    expect(pv.body.fresh).toBe(5);
    expect(pv.body.meta.opening).toBe(100000);
    expect(pv.body.meta.breaks).toEqual([]);

    const im = await upload(`/finance/accounts/${acc}/import`, text);
    expect(im.status, JSON.stringify(im.body)).toBeLessThan(300);
    expect(im.body).toMatchObject({ rows: 5, fresh: 5, duplicates: 0, breaks: 0, unexplained: 2 });   // the person and the UPI payment need a person
    const again = await upload(`/finance/accounts/${acc}/import`, text);
    expect(again.body).toMatchObject({ fresh: 0, duplicates: 5 });                                    // the same lines are never kept twice

    const lines = (await api.request('GET', `/finance/lines?account=${acc}`, undefined, MGR)).body;
    const by = (n: string) => lines.rows.find((r: any) => r.narration.includes(n));
    expect(by('PAYTM').tag).toBe('DIGITAL_SETTLEMENT');
    expect(by('CASH DEPOSIT').tag).toBe('CASH_DEPOSIT');
    expect(by('SMS CHARGES').tag).toBe('BANK_CHARGES');
    expect(by('SOME PERSON').narration).toContain(',MUM-HDFCH000');                                  // the comma stayed in the narration
    expect(by('SOME PERSON').status).toBe('UNEXPLAINED');

    // money that came in cannot be an expense, and money that went out cannot be income
    const credit = by('PAYTM'), debit = by('RAVI KUMAR');
    expect((await api.request('PUT', `/finance/lines/${credit.id}`, { tag: 'EXPENSE' }, MGR)).status).toBe(400);
    expect((await api.request('PUT', `/finance/lines/${debit.id}`, { tag: 'CASH_DEPOSIT' }, MGR)).status).toBe(400);
    // say what it is, and ask for the same next time: a rule is made and the like lines already there are tagged
    const done = await api.request('PUT', `/finance/lines/${debit.id}`, { tag: 'OWNER', remember: true, pattern: `RAVI KUMAR ${run}` }, MGR);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    const rules = (await api.request('GET', '/finance/rules', undefined, MGR)).body;
    expect(rules.some((r: any) => r.pattern === `RAVI KUMAR ${run}` && r.tag === 'OWNER' && r.direction === 'DEBIT')).toBe(true);
    const next = hdfc([{ d: March(9), narr: `UPI-RAVI KUMAR ${run}-ravi@okbank-ICIC0001-999`, dr: 300 }], 100000 - 2520 - 500 + 36000 - 0);
    const more = await upload(`/finance/accounts/${acc}/import`, next);
    expect(more.body.unexplained).toBe(0);                                                            // the rule tagged the new line as it came in
  });

  test('FIN-4 a missing line is found, an unreadable file is refused, and chosen columns are accepted @edge', async ({ api }) => {
    const acc = await newAccount(api);
    const full: L[] = [{ d: March(1), narr: 'CASH DEPOSIT BY - A - B', cr: 1000 }, { d: March(2), narr: 'CASH DEPOSIT BY - C - D', cr: 2000 }, { d: March(3), narr: 'CASH DEPOSIT BY - E - F', cr: 3000 }];
    const t = hdfc(full).split('\r\n');
    const missing = [...t.slice(0, 3), t[4]].join('\r\n');                                           // the second line is gone: the balance no longer follows
    const pv = await upload(`/finance/accounts/${acc}/preview`, missing);
    expect(pv.body.meta.breaks.length).toBe(1);
    expect(pv.body.warnings.join(' ')).toMatch(/may be missing/);
    expect((await upload(`/finance/accounts/${acc}/import`, 'a,b,c\n1,2,3\n')).status).toBe(400);   // columns not recognised

    // another bank: Withdrawal and Deposit columns, dd-mmm-yyyy dates, newest first
    const other = ['Txn Date,Description,Ref No.,Withdrawal Amt.,Deposit Amt.,Balance', '"05-Mar-2019","Rent","R1","1,500.00","","8,500.00"', '"04-Mar-2019","Cash deposit","","","2,000.00","10,000.00"'].join('\n');
    const p2 = await upload(`/finance/accounts/${acc}/preview`, other, 'other.csv');
    expect(p2.body.recognised).toBe(true);
    expect(p2.body.meta).toMatchObject({ opening: 8000, closing: 8500, reversed: true });

    // columns a person chose, for a file whose headings mean nothing to us
    const odd = 'when,what,how much,left\n2019-03-01,Fee,-50.00,950.00\n2019-03-02,Deposit,200.00,1150.00\n';
    const bad = await upload(`/finance/accounts/${acc}/preview`, odd, 'odd.csv');
    expect(bad.body.recognised).toBe(false);
    const mapped = await upload(`/finance/accounts/${acc}/preview`, odd, 'odd.csv', { mapping: JSON.stringify({ headerRow: 0, columns: ['date', 'narration', 'amount', 'balance'], dateFormat: 'yyyy-mm-dd' }) });
    expect(mapped.body.recognised).toBe(true);
    expect(mapped.body.rows).toBe(2);
  });

  test('FIN-5 a month is signed only when every difference outside the tolerance has a reason @happy', async ({ api }) => {
    const acc = await newAccount(api);
    // March 2019 has no sales in the books, so any cash deposited is a difference: 50 is inside the 100 tolerance, 30,000 is not
    await upload(`/finance/accounts/${acc}/import`, hdfc([{ d: March(2), narr: 'CASH DEPOSIT BY - A PERSON - AREA', cr: 30000 }, { d: March(20), narr: 'SMS CHARGES', dr: 20 }]));
    const m = (await api.request('GET', `/finance/reconcile?account=${acc}&month=2019-03`, undefined, MGR)).body;
    expect(m.bridge).toMatchObject({ opening: 100000, credits: 30000, debits: 20, closing: 129980, difference: 0, within: true });
    const cash = m.channels.find((c: any) => c.key === 'cash');
    expect(cash).toMatchObject({ books: 0, bank: 30000, difference: -30000, within: false });
    expect(m.channels.find((c: any) => c.key === 'digital').within).toBe(true);                       // nothing either side

    const base = { account: acc, month: '2019-03-01' };
    const no = await api.request('POST', '/finance/reconcile/signoff', base, MGR);
    expect(no.status).toBe(400);
    expect(JSON.stringify(no.body)).toMatch(/reason/);
    const noNote = await api.request('POST', '/finance/reconcile/signoff', { ...base, reasons: { cash: { code: 'CASH_IN_HAND' } } }, MGR);
    expect(noNote.status).toBe(400);
    expect((await api.request('POST', '/finance/reconcile/signoff', { ...base, reasons: { cash: { code: 'NOPE', note: 'because' } } }, MGR)).status).toBe(400);
    const ok = await api.request('POST', '/finance/reconcile/signoff', { ...base, note: 'checked', reasons: { cash: { code: 'BOOKS_INCOMPLETE', note: 'sales were not entered then' } } }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect((await api.request('POST', '/finance/reconcile/signoff', base, MGR)).status).toBe(400);   // once
    const signed = (await api.request('GET', `/finance/reconcile?account=${acc}&month=2019-03`, undefined, MGR)).body;
    expect(signed.signoff.by_name).toBeTruthy();
    expect((await api.request('POST', '/finance/reconcile/reopen', base, MGR)).status).toBe(400);     // a reason is needed to open it again
    expect((await api.request('POST', '/finance/reconcile/reopen', { ...base, reason: 'a deposit was missed' }, MGR)).status).toBeLessThan(300);
  });

  test('FIN-6 a difference of 100 rupees or less is accepted, and a month that does not add up is not signed @edge', async ({ api }) => {
    const small = await newAccount(api);
    await upload(`/finance/accounts/${small}/import`, hdfc([{ d: March(3), narr: 'CASH DEPOSIT BY - A PERSON - AREA', cr: 100 }]));
    const a = (await api.request('GET', `/finance/reconcile?account=${small}&month=2019-03`, undefined, MGR)).body;
    expect(a.channels.find((c: any) => c.key === 'cash')).toMatchObject({ difference: -100, within: true });   // exactly the tolerance
    expect((await api.request('POST', '/finance/reconcile/signoff', { account: small, month: '2019-03-01' }, MGR)).status).toBeLessThan(300);   // no reasons needed

    const big = await newAccount(api);
    await upload(`/finance/accounts/${big}/import`, hdfc([{ d: March(3), narr: 'CASH DEPOSIT BY - A PERSON - AREA', cr: 100.01 }]));
    const b = (await api.request('GET', `/finance/reconcile?account=${big}&month=2019-03`, undefined, MGR)).body;
    expect(b.channels.find((c: any) => c.key === 'cash').within).toBe(false);                          // a paisa over

    // a statement with a line missing does not add up, so the month cannot be signed
    const gap = await newAccount(api);
    const t = hdfc([{ d: March(1), narr: 'CASH DEPOSIT BY - A - B', cr: 50 }, { d: March(2), narr: 'CASH DEPOSIT BY - C - D', cr: 20 }, { d: March(3), narr: 'SMS CHARGES', dr: 5 }]).split('\r\n');
    await upload(`/finance/accounts/${gap}/import`, [...t.slice(0, 3), t[4]].join('\r\n'));
    const g = (await api.request('GET', `/finance/reconcile?account=${gap}&month=2019-03`, undefined, MGR)).body;
    expect(g.bridge.within).toBe(false);
    const refused = await api.request('POST', '/finance/reconcile/signoff', { account: gap, month: '2019-03-01' }, MGR);
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.body)).toMatch(/do not add up/);
  });

  test('FIN-7 the overview and the records check answer, and the paper H1 register is marked once a month @happy', async ({ api }) => {
    const ov = await api.request('GET', '/finance/overview?from=2019-03-01&to=2019-03-31', undefined, MGR);
    expect(ov.status).toBe(200);
    expect(ov.body.books.sales.total).toBe(0);
    expect(ov.body.bank.lines).toBeGreaterThan(0);
    expect(ov.body.trend.length).toBe(1);
    expect((await api.request('GET', '/finance/overview?from=2026-02-01&to=2026-01-01', undefined, MGR)).status).toBe(400);

    const rec = (await api.request('GET', '/finance/records', undefined, MGR)).body;
    expect(rec.retentionYears).toBe(8);
    expect(rec.years.length).toBe(9);
    expect(rec.h1.length).toBe(12);
    const month = rec.h1[11].month;                                                                  // the oldest of the twelve, to leave this month alone
    const first = await api.request('POST', '/finance/records/attest', { period: month }, MGR);
    if (first.status < 300) expect((await api.request('POST', '/finance/records/attest', { period: month }, MGR)).status).toBe(400);
    else expect(first.status).toBe(400);                                                             // already marked by an earlier run
    expect((await api.request('POST', '/finance/records/attest', { period: 'soon' }, MGR)).status).toBe(400);
    expect((await api.request('POST', '/finance/records/attest', { period: '2999-01' }, MGR)).status).toBe(400);
  });
});
