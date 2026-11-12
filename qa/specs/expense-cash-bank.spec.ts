/**
 * Expenses: where the cash came from, and which bank account — EXPC-1..5
 * Source: docs question "is an expense recorded outside the shift taken from the till, and can a bank line be matched to it".
 * A cash expense says whether it came from the drawer of an open shift (the shift's expected cash goes down) or not from the till; one paid another way
 * names the bank account and the payment reference, and the bank statement matches it by reference and account.
 */
import { test, expect } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';
const API = process.env.QA_API_URL as string;
const run = Date.now().toString().slice(-7);

const tokens: Record<string, string> = {};
async function token(email: string) {
  if (!tokens[email]) {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: process.env.QA_ADMIN_PASS || 'admin123', scope: 'business' }) });
    tokens[email] = (await r.json()).token;
  }
  return tokens[email];
}
async function upload(path: string, text: string) {
  const fd = new FormData();
  fd.append('file', new Blob([text]), 'statement.txt');
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { authorization: `Bearer ${await token(MGR)}` }, body: fd });
  return { status: r.status, body: await r.json().catch(() => null) };
}
/** an HDFC-style statement, as the finance specs write it */
function hdfc(lines: { d: string; narr: string; dr: number; ref?: string }[], opening = 100000) {
  let bal = opening;
  const rows = lines.map((l) => {
    bal = Math.round((bal - l.dr) * 100) / 100;
    return ` ${l.d}  ,${l.narr},${l.d} ,${l.dr.toFixed(2).padStart(14)}  ,${(0).toFixed(2).padStart(14)}  ,${(l.ref || '0000000000').padEnd(16)},${bal.toFixed(2).padStart(14)}  `;
  });
  return ['', '  Date     ,Narration     ,Value Dat,Debit Amount       ,Credit Amount      ,Chq/Ref Number   ,Closing Balance', ...rows].join('\r\n');
}
const March = (day: number) => `${String(day).padStart(2, '0')}/03/19`;

async function freshStore(api: any) {
  const s = await api.request('POST', '/stores', { location: `ExpC ${Date.now()}.${Math.random().toString(36).slice(2, 5)}`, depositthreshold: 9000, isActive: true }, MGR);
  expect(s.status).toBeLessThan(300);
  return s.body.id as number;
}
/** opens a shift; when the "do this to continue" gate asks for a reason on something left undone, one is given (the dev data may hold old unclosed shifts) */
async function openShift(api: any, storeid: number) {
  const body = { storeid, openingcash: 0, allowZero: true };
  const first = await api.request('POST', '/store-cash/shifts', body, MGR);
  if (first.status !== 409 || !Array.isArray(first.body?.required)) return first;
  const compliancereasons = Object.fromEntries(first.body.required.map((r: any) => [r.id, 'qa spec: left for later']));
  return api.request('POST', '/store-cash/shifts', { ...body, compliancereasons }, MGR);
}
const today = () => new Date().toISOString().slice(0, 10);
async function category(api: any, name = 'Cleaning') {
  const cats = (await api.request('GET', '/expenses/categories', undefined, MGR)).body;
  return cats.find((c: any) => c.name === name && c.active).id as number;
}
const expectedCash = async (api: any, storeid: number, shiftid: number) =>
  Number(((await api.request('GET', `/store-cash/shifts?storeid=${storeid}&status=OPEN`, undefined, MGR)).body || []).find((s: any) => s.id === shiftid)?.expectedcash);

test.describe('Expenses: cash source and bank account @p1', () => {
  test('EXPC-1 a new expense starts as paid by cash @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/expenses');
    await page.getByTestId('exp-add').click();
    await expect(page.getByTestId('exp-d-mode')).toHaveValue('CASH');
  });

  test('EXPC-2 a cash expense from the drawer takes the shift\'s expected cash down once, and is not counted twice in the report @happy', async ({ api }) => {
    const sid = await freshStore(api);
    const shift = await openShift(api, sid);
    expect(shift.status, JSON.stringify(shift.body)).toBeLessThan(300);
    const open = await api.request('GET', `/expenses/open-shifts?store=${sid}`, undefined, MGR);
    expect(open.body.map((s: any) => s.id)).toContain(shift.body.id);

    const before = await expectedCash(api, sid, shift.body.id);
    const cat = await category(api);
    const r = await api.request('POST', '/expenses', { expense_date: today(), store_id: sid, category_id: cat, amount: 250, pay_mode: 'CASH', cash_source: 'DRAWER', shift_id: shift.body.id, payee: 'QA cleaner' }, MGR);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(await expectedCash(api, sid, shift.body.id)).toBe(before - 250);                      // the drawer paid it

    const list = (await api.request('GET', `/expenses?store=${sid}`, undefined, MGR)).body.rows;
    expect(list.find((e: any) => e.id === r.body.id)).toMatchObject({ cash_source: 'DRAWER', shift_id: shift.body.id });
    const report = (await api.request('GET', `/expenses/report?from=${today()}&to=${today()}&store=${sid}`, undefined, MGR)).body;
    expect(report.total).toBe(250);                                                              // once: the ledger row, not the ledger row and the drawer row

    await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { counteddenominations: [], allowZero: true }, MGR);
  });

  test('EXPC-3 the drawer is only for an open shift of the store; cash "not from the till" touches no shift @edge', async ({ api }) => {
    const sid = await freshStore(api);
    const cat = await category(api);
    const noShift = await api.request('POST', '/expenses', { expense_date: today(), store_id: sid, category_id: cat, amount: 100, pay_mode: 'CASH', cash_source: 'DRAWER', shift_id: 999999 }, MGR);
    expect(noShift.status).toBe(400);
    expect(JSON.stringify(noShift.body)).toMatch(/open shift/i);

    const shift = await openShift(api, sid);
    expect(shift.status, JSON.stringify(shift.body)).toBeLessThan(300);
    const before = await expectedCash(api, sid, shift.body.id);
    const out = await api.request('POST', '/expenses', { expense_date: today(), store_id: sid, category_id: cat, amount: 80, pay_mode: 'CASH', cash_source: 'OUTSIDE' }, MGR);
    expect(out.status, JSON.stringify(out.body)).toBeLessThan(300);
    expect(await expectedCash(api, sid, shift.body.id)).toBe(before);                            // not from the till: the drawer is as it was

    await api.request('PUT', `/store-cash/shifts/${shift.body.id}/close`, { counteddenominations: [], allowZero: true }, MGR);
    const closed = await api.request('POST', '/expenses', { expense_date: today(), store_id: sid, category_id: cat, amount: 60, pay_mode: 'CASH', cash_source: 'DRAWER', shift_id: shift.body.id }, MGR);
    expect(closed.status).toBe(400);                                                             // that shift has closed
  });

  test('EXPC-4 an expense paid by bank carries its account and reference, and the list says whether the bank has it; a caller that sends none still works @happy', async ({ api }) => {
    const acc = (await api.request('POST', '/finance/accounts', { name: `QA exp bank ${run}-a`, bank_name: 'QA Bank', last4: '4321' }, MGR)).body.id as number;
    const cat = await category(api, 'Rent');
    const listed = (await api.request('GET', '/expenses/bank-accounts', undefined, MGR)).body;
    expect(listed.map((a: any) => a.id)).toContain(acc);

    const bare = await api.request('POST', '/expenses', { expense_date: today(), category_id: cat, amount: 500, pay_mode: 'BANK' }, MGR);
    expect(bare.status, JSON.stringify(bare.body)).toBeLessThan(300);                            // the form asks for the account; the server does not insist
    const wrong = await api.request('POST', '/expenses', { expense_date: today(), category_id: cat, amount: 500, pay_mode: 'BANK', bank_account_id: 999999 }, MGR);
    expect(wrong.status).toBe(400);                                                              // but an account it names must be one of the business's
    const ok = await api.request('POST', '/expenses', { expense_date: today(), category_id: cat, amount: 500, pay_mode: 'BANK', bank_account_id: acc, reference: `UTR${run}A` }, MGR);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    const row = (await api.request('GET', '/expenses', undefined, MGR)).body.rows.find((e: any) => e.id === ok.body.id);
    expect(row).toMatchObject({ bank_account_id: acc, reference: `UTR${run}A`, bankable: true, bank_matched: false });
  });

  test('EXPC-5 the bank statement matches an expense by its reference when two are close in amount, and only from the account it was paid from @happy', async ({ api }) => {
    const accA = (await api.request('POST', '/finance/accounts', { name: `QA exp bank ${run}-m1`, bank_name: 'QA Bank', last4: '1111' }, MGR)).body.id as number;
    const accB = (await api.request('POST', '/finance/accounts', { name: `QA exp bank ${run}-m2`, bank_name: 'QA Bank', last4: '2222' }, MGR)).body.id as number;
    const cat = await category(api, 'Rent');
    const raise = async (amount: number, date: string, acc: number, reference?: string) => {
      const r = await api.request('POST', '/expenses', { expense_date: date, category_id: cat, amount, pay_mode: 'BANK', bank_account_id: acc, reference }, MGR);
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
      return r.body.id as number;
    };
    // two expenses within the matching tolerance of each other, in the same week: the amount alone cannot tell them apart
    const first = await raise(1000, '2019-03-10', accA, `UTR${run}X1`);
    await raise(1040, '2019-03-11', accA, `UTR${run}X2`);
    // one paid from the other account
    const elsewhere = await raise(555, '2019-03-12', accB, `UTR${run}Y1`);

    const imp = await upload(`/finance/accounts/${accA}/import`, hdfc([
      { d: March(10), narr: 'NEFT DR-QA LANDLORD', dr: 1000, ref: `UTR${run}X1` },
      { d: March(12), narr: 'NEFT DR-SOMEONE ELSE', dr: 555, ref: `UTR${run}Y1` },       // an expense of this amount exists, but it was paid from the other account
    ]));
    expect(imp.status, JSON.stringify(imp.body)).toBeLessThan(300);
    const lines = (await api.request('GET', `/finance/lines?account=${accA}`, undefined, MGR)).body.rows;
    const byRef = lines.find((l: any) => Math.abs(l.debit - 1000) < 0.01);
    expect(byRef).toMatchObject({ status: 'MATCHED', match_kind: 'EXPENSE', tag: 'EXPENSE' });
    expect(byRef.reason).toMatch(/payment reference/i);                                          // two were close in amount: the reference told them apart
    expect(first).toBeGreaterThan(0);
    const other = lines.find((l: any) => Math.abs(l.debit - 555) < 0.01);
    expect(other.status).not.toBe('MATCHED');                                                    // the expense of that amount was paid from the other account: this account's line does not claim it
    expect(elsewhere).toBeGreaterThan(0);
  });
});
