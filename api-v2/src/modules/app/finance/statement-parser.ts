/**
 * Reads a bank statement from any bank. Nothing here is specific to one bank: the header row is found by what its headings mean, every column is
 * given a role (date, narration, debit, credit and so on), and a person can correct the roles for a bank it does not recognise. Pure, so it is tested
 * without a database; the file itself is read in memory and never kept.
 */

export type Role = 'date' | 'valueDate' | 'narration' | 'debit' | 'credit' | 'amount' | 'type' | 'ref' | 'balance' | 'ignore';
export const ROLES: Role[] = ['date', 'valueDate', 'narration', 'debit', 'credit', 'amount', 'type', 'ref', 'balance', 'ignore'];

export interface Mapping {
  headerRow: number;                       // index in the cleaned table
  delimiter: string;
  columns: Role[];                         // one role per header column
  dateFormat: string;                      // e.g. dd/mm/yy
}

export interface ParsedRow {
  date: string; valueDate: string | null; narration: string; ref: string;
  debit: number; credit: number; balance: number | null;
}

export interface Meta {
  from: string | null; to: string | null; opening: number | null; closing: number | null;
  debits: number; credits: number; breaks: number[]; hasBalance: boolean; reversed: boolean;
}

export interface Parsed {
  recognised: boolean;
  mapping: Mapping | null;
  header: string[];
  sample: string[][];                      // the first rows of the file, for a person to map columns by
  rows: ParsedRow[];
  skipped: number;
  warnings: string[];
  meta: Meta;
}

const EMPTY_META: Meta = { from: null, to: null, opening: null, closing: null, debits: 0, credits: 0, breaks: [], hasBalance: false, reversed: false };

// ------------------------------------------------------------------ splitting a line
export function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const DELIMS = [',', ';', '\t', '|'];

/** the delimiter that gives the most columns, consistently, over the first lines */
export function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 12);
  let best = ',', bestScore = -1;
  for (const d of DELIMS) {
    const counts = sample.map((l) => splitLine(l, d).length);
    const mode = counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)];
    const consistent = counts.filter((c) => c >= mode).length;
    const score = mode >= 3 ? mode * 10 + consistent : 0;
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

// ------------------------------------------------------------------ what a heading means
const norm = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const ROLE_WORDS: [Role, string[]][] = [
  ['valueDate', ['value date', 'value dat', 'val date', 'value dt']],
  ['balance', ['closing balance', 'running balance', 'balance', 'bal']],
  ['debit', ['debit', 'withdrawal', 'withdrawals', 'dr amount', 'paid out', 'money out']],
  ['credit', ['credit', 'deposit', 'deposits', 'cr amount', 'paid in', 'money in']],
  ['type', ['dr cr', 'cr dr', 'type']],
  ['ref', ['chq', 'cheque', 'ref', 'reference', 'utr', 'instrument']],
  ['date', ['date', 'dt']],
  ['narration', ['narration', 'description', 'particulars', 'remarks', 'details', 'transaction']],
  ['amount', ['amount', 'amt']],
];

export function roleOf(heading: string): Role {
  const h = norm(heading);
  if (!h) return 'ignore';
  for (const [role, words] of ROLE_WORDS) if (words.some((w) => (w.length <= 3 ? h.split(' ').includes(w) : h.includes(w)))) return role;
  return 'ignore';
}

/** the first row whose headings include a date, a narration and money */
export function findHeader(table: string[][]): number {
  for (let i = 0; i < Math.min(table.length, 30); i++) {
    const roles = table[i].map(roleOf);
    const money = roles.includes('debit') || roles.includes('credit') || roles.includes('amount');
    if (roles.includes('date') && roles.includes('narration') && money) return i;
  }
  return -1;
}

// ------------------------------------------------------------------ dates and amounts
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const DATE_FORMATS = ['dd/mm/yy', 'dd/mm/yyyy', 'dd-mm-yyyy', 'dd-mm-yy', 'dd-mmm-yy', 'dd-mmm-yyyy', 'dd mmm yyyy', 'dd.mm.yyyy', 'yyyy-mm-dd', 'yyyy/mm/dd', 'mm/dd/yyyy'];

export function parseDate(s: string, fmt: string): string | null {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const parts = t.split(/[\/\-. ]+/);
  if (parts.length < 3) return null;
  const f = fmt.split(/[\/\-. ]+/);
  let d = 0, m = 0, y = 0;
  for (let i = 0; i < 3; i++) {
    const v = parts[i];
    if (f[i] === 'dd') d = +v;
    else if (f[i] === 'mm') m = +v;
    else if (f[i] === 'mmm') m = MONTHS.indexOf(v.slice(0, 3).toLowerCase()) + 1;
    else if (f[i] === 'yy') y = 2000 + +v;
    else if (f[i] === 'yyyy') y = +v;
  }
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return new Date(iso + 'T00:00:00Z').getUTCDate() === d ? iso : null;
}

/** the first format that reads every date in the sample (day first, as banks in India write it) */
export function detectDateFormat(samples: string[]): string | null {
  // a footer line ("Closing balance", "*** end ***") is not a date and must not stop the others being read
  const s = samples.filter((x) => /\d/.test(String(x ?? '')) && String(x).trim().length <= 14).slice(0, 40);
  if (!s.length) return null;
  return DATE_FORMATS.find((f) => s.every((x) => parseDate(x, f) !== null)) ?? null;
}

export function parseAmount(s: string): number {
  let t = String(s ?? '').trim();
  if (!t) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (/dr\.?$/i.test(t)) { neg = true; t = t.replace(/dr\.?$/i, ''); } else t = t.replace(/cr\.?$/i, '');
  t = t.replace(/[₹,\s]|rs\.?/gi, '');
  if (t.startsWith('-')) { neg = !neg; t = t.slice(1); }
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

const isDebitWord = (s: string) => /^(dr|debit|d|w|withdrawal)\.?$/i.test(String(s).trim());
const isCreditWord = (s: string) => /^(cr|credit|c|d|deposit)\.?$/i.test(String(s).trim()) && !isDebitWord(s);

// ------------------------------------------------------------------ the table
const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseTable(table: string[][], delimiter: string, override?: Partial<Mapping>): Parsed {
  const sample = table.slice(0, 14);
  const headerRow = override?.headerRow ?? findHeader(table);
  if (headerRow < 0 || !table[headerRow]) {
    return { recognised: false, mapping: null, header: [], sample, rows: [], skipped: 0, warnings: ['The columns of this file were not recognised. Choose what each column holds.'], meta: { ...EMPTY_META } };
  }
  const header = table[headerRow];
  const columns: Role[] = override?.columns && override.columns.length === header.length ? override.columns : header.map(roleOf);
  const col = (r: Role) => columns.indexOf(r);
  const warnings: string[] = [];

  const dateCol = col('date');
  const body = table.slice(headerRow + 1);
  const dateSamples = body.map((r) => r[dateCol] ?? '').filter(Boolean);
  const dateFormat = override?.dateFormat || detectDateFormat(dateSamples);
  const narrCol = col('narration');
  const haveMoney = col('debit') >= 0 || col('credit') >= 0 || col('amount') >= 0;
  if (dateCol < 0 || narrCol < 0 || !haveMoney || !dateFormat) {
    if (!dateFormat && dateCol >= 0) warnings.push('The dates in this file are not in a format I know. Choose one.');
    return { recognised: false, mapping: { headerRow, delimiter, columns, dateFormat: dateFormat || '' }, header, sample, rows: [], skipped: 0, warnings: warnings.length ? warnings : ['A date, a narration and an amount (or debit and credit) column are needed.'], meta: { ...EMPTY_META } };
  }

  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (const raw of body) {
    let cells = raw;
    // a narration can hold the delimiter: the extra fields belong to it
    if (cells.length > header.length) {
      const extra = cells.length - header.length;
      cells = [...cells.slice(0, narrCol), cells.slice(narrCol, narrCol + extra + 1).join(delimiter === ',' ? ',' : delimiter), ...cells.slice(narrCol + extra + 1)];
    }
    if (cells.length < header.length) { if (cells.some((c) => c)) skipped++; continue; }
    const date = parseDate(cells[dateCol], dateFormat);
    if (!date) { if (cells.some((c) => c)) skipped++; continue; }

    let debit = 0, credit = 0;
    if (col('debit') >= 0 || col('credit') >= 0) {
      debit = Math.abs(parseAmount(cells[col('debit')] ?? ''));
      credit = Math.abs(parseAmount(cells[col('credit')] ?? ''));
    } else {
      const a = parseAmount(cells[col('amount')] ?? '');
      const t = col('type') >= 0 ? cells[col('type')] : '';
      if (t && isDebitWord(t)) debit = Math.abs(a);
      else if (t && isCreditWord(t)) credit = Math.abs(a);
      else if (a < 0) debit = -a; else credit = a;
    }
    const balText = col('balance') >= 0 ? cells[col('balance')] : '';
    rows.push({
      date, valueDate: col('valueDate') >= 0 ? parseDate(cells[col('valueDate')], dateFormat) : null,
      narration: String(cells[narrCol] ?? '').replace(/\s+/g, ' ').trim(),
      ref: col('ref') >= 0 ? String(cells[col('ref')] ?? '').trim() : '',
      debit: round2(debit), credit: round2(credit), balance: balText && balText.trim() ? round2(parseAmount(balText)) : null,
    });
  }

  // a statement may list the newest first; the balances only chain in time order
  let reversed = false;
  if (rows.length > 1 && rows[0].date > rows[rows.length - 1].date) { rows.reverse(); reversed = true; }

  const hasBalance = rows.length > 0 && rows.every((r) => r.balance !== null);
  const breaks: number[] = [];
  if (hasBalance) {
    for (let i = 1; i < rows.length; i++) {
      if (Math.abs((rows[i - 1].balance as number) - rows[i].debit + rows[i].credit - (rows[i].balance as number)) > 0.01) breaks.push(i);
    }
  }
  const meta: Meta = {
    from: rows[0]?.date ?? null, to: rows[rows.length - 1]?.date ?? null,
    opening: hasBalance ? round2((rows[0].balance as number) + rows[0].debit - rows[0].credit) : null,
    closing: hasBalance ? (rows[rows.length - 1].balance as number) : null,
    debits: round2(rows.reduce((s, r) => s + r.debit, 0)), credits: round2(rows.reduce((s, r) => s + r.credit, 0)),
    breaks, hasBalance, reversed,
  };
  if (!hasBalance) warnings.push('This file has no balance column, so the running balance cannot be checked.');
  if (breaks.length) warnings.push(`The running balance does not follow from the amounts at ${breaks.length} line${breaks.length === 1 ? '' : 's'}: lines may be missing.`);
  if (skipped) warnings.push(`${skipped} line${skipped === 1 ? ' was' : 's were'} skipped (no date or too few columns).`);
  if (!rows.length) warnings.push('No transactions were found below the heading row.');
  return { recognised: true, mapping: { headerRow, delimiter, columns, dateFormat }, header, sample, rows, skipped, warnings, meta };
}

/** a text or CSV file (any bank), optionally with the columns a person chose */
export function parseText(text: string, override?: Partial<Mapping>): Parsed {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return { recognised: false, mapping: null, header: [], sample: [], rows: [], skipped: 0, warnings: ['The file is empty.'], meta: { ...EMPTY_META } };
  const delimiter = override?.delimiter || detectDelimiter(lines);
  return parseTable(lines.map((l) => splitLine(l, delimiter)), delimiter, override);
}
