/**
 * What a bank line is, and how the books and the bank are compared. Nothing here depends on one bank: it reads the narration for what it says. Pure, so
 * it is tested without a database.
 */
import { createHash } from 'crypto';

// ------------------------------------------------------------------ tags
export const INCOME_TAGS = ['DIGITAL_SETTLEMENT', 'CASH_DEPOSIT', 'OTHER_INCOME'] as const;
export const EXPENSE_TAGS = ['VENDOR_PAYMENT', 'EXPENSE', 'SALARY', 'GST_TAX', 'BANK_CHARGES', 'OTHER_OUT'] as const;
/** not income or expense of the business: money moved between the owner, the accounts and lenders */
export const NEUTRAL_TAGS = ['TRANSFER', 'OWNER', 'LOAN'] as const;
export const TAGS: string[] = [...INCOME_TAGS, ...EXPENSE_TAGS, ...NEUTRAL_TAGS];
export const TAG_LABEL: Record<string, string> = {
  DIGITAL_SETTLEMENT: 'Card / UPI settlement', CASH_DEPOSIT: 'Cash deposit', OTHER_INCOME: 'Other income',
  VENDOR_PAYMENT: 'Vendor payment', EXPENSE: 'Expense', SALARY: 'Salary', GST_TAX: 'GST / tax', BANK_CHARGES: 'Bank charges', OTHER_OUT: 'Other payment',
  TRANSFER: 'Transfer between accounts', OWNER: 'Owner money in or out', LOAN: 'Loan',
};
export const isIncomeTag = (t: string | null) => !!t && (INCOME_TAGS as readonly string[]).includes(t);
export const isExpenseTag = (t: string | null) => !!t && (EXPENSE_TAGS as readonly string[]).includes(t);

// ------------------------------------------------------------------ reading a narration
export type Kind = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'CASH' | 'TRANSFER' | 'CHEQUE' | 'CHARGE' | 'OTHER';

export function kindOf(narration: string): Kind {
  const n = String(narration || '').toUpperCase();
  if (/^NEFT/.test(n)) return 'NEFT';
  if (/^RTGS/.test(n)) return 'RTGS';
  if (/^IMPS/.test(n)) return 'IMPS';
  if (/^UPI/.test(n)) return 'UPI';
  if (/CASH DEP|CDM|CASH WDL|ATM/.test(n)) return 'CASH';
  if (/(^|-)TPT-/.test(n)) return 'TRANSFER';
  if (/^(CHQ|CHEQUE|CLG|MICR)/.test(n)) return 'CHEQUE';
  if (/CHRG|CHARGES|\bCHG\b|\bFEE\b|\bSMS\b|GST ON|INT\.? ?PD|INTEREST|MIN(IMUM)? BAL|MAINT/.test(n)) return 'CHARGE';
  return 'OTHER';
}

/** who the money came from or went to, as the narration says it */
export function counterpartyOf(narration: string): string | null {
  const n = String(narration || '').replace(/\s+/g, ' ').trim();
  let m: RegExpExecArray | null;
  let name: string | undefined;
  if (/^(NEFT|RTGS|IMPS)/i.test(n)) name = n.split('-')[2];
  else if (/(^|-)TPT-/i.test(n) && (m = /TPT-[^-]*-(.+?)-[A-Za-z]{2,5}$/i.exec(n))) name = m[1];
  else if (/^UPI-/i.test(n)) name = n.split('-')[1];
  else if ((m = /^CASH DEPOSIT BY\s*-?\s*(.+?)\s*-/i.exec(n))) name = m[1];
  name = name?.trim();
  return name ? name.slice(0, 80) : null;
}

export interface Classified { kind: Kind; counterparty: string | null; tag: string | null; category: string | null; reason: string | null; }

interface BuiltIn { test: RegExp; direction: 'DEBIT' | 'CREDIT' | 'ANY'; tag: string; category?: string; reason: string; }
const BUILT_IN: BuiltIn[] = [
  { test: /PAYTM PAYMENTS|PHONEPE|RAZORPAY|PINE LABS|MSWIPE|BHARATPE|CASHFREE|BILLDESK/i, direction: 'CREDIT', tag: 'DIGITAL_SETTLEMENT', reason: 'Card / UPI settlement' },
  { test: /CASH DEP|CDM/i, direction: 'CREDIT', tag: 'CASH_DEPOSIT', reason: 'Cash deposited' },
  { test: /SALARY|PAYROLL|WAGES|STAFF PAY/i, direction: 'DEBIT', tag: 'SALARY', reason: 'Salary' },
  { test: /CBDT|INCOME TAX|GSTN|GST PAYMENT|GOODS AND SERVICE|TAX PAYMENT|CHALLAN|PMT-06|TDS/i, direction: 'DEBIT', tag: 'GST_TAX', reason: 'GST or tax payment' },
  { test: /AIRTEL|JIO|BSNL|VODAFONE|VI|ACT FIBERNET|HATHWAY|TATA PLAY/i, direction: 'DEBIT', tag: 'EXPENSE', category: 'Internet and phone', reason: 'Phone or internet bill' },
  { test: /RENT/i, direction: 'DEBIT', tag: 'EXPENSE', category: 'Rent', reason: 'Rent' },
  { test: /ELECTRICITY|TNEB|EB BILL|TANGEDCO|BESCOM|MSEDCL/i, direction: 'DEBIT', tag: 'EXPENSE', category: 'Electricity', reason: 'Electricity' },
  { test: /INSURANCE|\bLIC\b/i, direction: 'DEBIT', tag: 'EXPENSE', category: 'Insurance', reason: 'Insurance' },
];

/** a rule a person made: a line that contains this text is tagged like this */
export interface UserRule { pattern: string; direction: 'ANY' | 'DEBIT' | 'CREDIT'; tag: string; vendor_id?: number | null; expense_category?: string | null; }

const dirOf = (debit: number, credit: number): 'DEBIT' | 'CREDIT' => (debit > 0 ? 'DEBIT' : 'CREDIT');

export function classify(narration: string, debit: number, credit: number, rules: UserRule[] = []): Classified & { vendorId?: number | null } {
  const dir = dirOf(debit, credit);
  const kind = kindOf(narration);
  const counterparty = counterpartyOf(narration);
  const n = String(narration || '').toUpperCase();
  for (const r of rules) {
    if (r.pattern && n.includes(r.pattern.toUpperCase()) && (r.direction === 'ANY' || r.direction === dir)) {
      return { kind, counterparty, tag: r.tag, category: r.expense_category ?? null, reason: 'Your rule: ' + r.pattern, vendorId: r.vendor_id ?? null };
    }
  }
  if (kind === 'CHARGE') {
    return dir === 'DEBIT'
      ? { kind, counterparty, tag: 'BANK_CHARGES', category: null, reason: 'Bank charge' }
      : { kind, counterparty, tag: 'OTHER_INCOME', category: null, reason: 'Interest or refund from the bank' };
  }
  for (const b of BUILT_IN) {
    if ((b.direction === 'ANY' || b.direction === dir) && b.test.test(n)) return { kind, counterparty, tag: b.tag, category: b.category ?? null, reason: b.reason };
  }
  return { kind, counterparty, tag: null, category: null, reason: null };
}

// ------------------------------------------------------------------ vendors
const STOP = new Set(['PVT', 'PRIVATE', 'LTD', 'LIMITED', 'AND', 'CO', 'COMPANY', 'THE', 'OF', 'M/S', 'MS', 'LLP', 'INDIA']);
const tokens = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));

/** the one vendor a payee name belongs to, if it is clearly one */
export function vendorMatch(counterparty: string | null, vendors: { id: number; names: string[] }[]): number | null {
  if (!counterparty) return null;
  const a = tokens(counterparty);
  if (!a.length) return null;
  let best: { id: number; score: number } | null = null, tie = false;
  for (const v of vendors) {
    for (const name of v.names) {
      const b = tokens(name);
      if (!b.length) continue;
      const shared = a.filter((t) => b.includes(t)).length;
      const enough = shared >= 2 || (shared >= 1 && Math.min(a.length, b.length) <= 2);
      if (!enough) continue;
      const score = shared / Math.min(a.length, b.length) + shared / 100;
      if (!best || score > best.score + 1e-9) { best = { id: v.id, score }; tie = false; }
      else if (best && Math.abs(score - best.score) <= 1e-9 && best.id !== v.id) tie = true;
    }
  }
  return best && !tie ? best.id : null;
}

// ------------------------------------------------------------------ the same line is never kept twice
export interface KeyRow { date: string; narration: string; debit: number; credit: number; balance: number | null; ref: string; }

/** one key per line; two truly identical lines in one file get different keys, the same line in another file gets the same key */
export function dedupeKeys(rows: KeyRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = [r.date, r.narration.replace(/\s+/g, ' ').trim().toUpperCase(), r.debit.toFixed(2), r.credit.toFixed(2), r.balance === null ? '' : r.balance.toFixed(2), r.ref].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return createHash('sha1').update(base + '#' + n).digest('hex');
  });
}

// ------------------------------------------------------------------ the bridge and the tolerance
const r2 = (n: number) => Math.round(n * 100) / 100;

/** opening + credits - debits should be the closing balance */
export const bridge = (opening: number, credits: number, debits: number, closing: number) => ({
  expected: r2(opening + credits - debits), difference: r2(closing - (opening + credits - debits)),
});

export const within = (difference: number, tolerance: number) => Math.abs(difference) <= tolerance + 1e-9;

export interface Channel { key: string; label: string; books: number; bank: number; difference: number; within: boolean; }

/** the books against the bank for one kind of money: the gap, and whether it is small enough to accept */
export function channel(key: string, label: string, books: number, bank: number, tolerance: number): Channel {
  const difference = r2(books - bank);
  return { key, label, books: r2(books), bank: r2(bank), difference, within: within(difference, tolerance) };
}

export const REASONS: Record<string, string> = {
  TIMING: 'Timing: money arrives a day or more after the sale, or a cheque has not cleared',
  FEES: 'Fees or charges taken before the money arrived',
  OTHER_ACCOUNT: 'Paid into another account (another bank, or the owner)',
  CASH_IN_HAND: 'Cash still in hand, or spent in cash',
  BOOKS_INCOMPLETE: 'The books are incomplete for this period',
  OTHER: 'Another reason (explain in the note)',
};

/** what a month needs before it can be signed: every channel outside the tolerance has a reason and a note */
export function signoffProblems(channels: Channel[], reasons: Record<string, { code?: string; note?: string }> | undefined): string[] {
  const out: string[] = [];
  for (const c of channels) {
    if (c.within) continue;
    const r = reasons?.[c.key];
    if (!r || !r.code || !(r.code in REASONS)) out.push(`Choose a reason for the ${c.label.toLowerCase()} difference (${c.difference.toFixed(2)}).`);
    else if (!String(r.note || '').trim() || String(r.note).trim().length < 5) out.push(`Add a note for the ${c.label.toLowerCase()} difference.`);
  }
  return out;
}

/** the first day of the month a date falls in, and the first day of the next */
export const monthBounds = (month: string) => {
  const [y, m] = month.slice(0, 7).split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)), next = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString().slice(0, 10), next: next.toISOString().slice(0, 10) };
};
