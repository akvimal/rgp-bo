import { compositionKey } from '../sales/composition-match';
import { classifyForm, DosageForm } from './dosage-form';

/**
 * The brand dictionary's import rules, pure (no database), so they are tested on their own.
 * One canonical row per brand: brand, manufacturer, dosage form, composition (salts with strengths), pack, discontinued, code. Anything that can supply those
 * can fill the dictionary. The CDCI Flat Files adapter turns the official tab-separated masters into canonical rows.
 */

/** the key a brand is searched by: letters and digits only, lower case, so "Augmentin 625 Duo" and "AUGMENTIN-625DUO" meet */
export const brandKey = (name: unknown): string => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface CanonicalRow {
  brand: string;
  brandKey: string;
  manufacturer: string;
  dosageForm: DosageForm | null;
  formText: string;
  composition: string;
  compositionKey: string;
  saltsKey: string;
  hasStrength: boolean;
  pack: string;
  discontinued: boolean;
  code: string;
}

/** read a delimited text (CSV with quotes, or TSV): rows of cells; a leading byte-order mark and blank lines are dropped */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x !== '')) rows.push(row); }
  return rows;
}

/** rows as objects keyed by their header (the header cells are trimmed) */
export function withHeader(rows: string[][]): { headers: string[]; records: Record<string, string>[] } {
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  return { headers, records: rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

const TRUE = new Set(['1', 'y', 'yes', 'true', 't']);
const cut = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** one canonical row, or the reason it cannot be used (no brand, no composition) */
export function canonicalRow(raw: Record<string, any>): { ok: true; row: CanonicalRow } | { ok: false; reason: string } {
  const brand = cut(raw.brand, 200);
  if (!brand) return { ok: false, reason: 'no brand name' };
  const composition = cut(raw.composition, 400);
  const ck = compositionKey(composition);
  if (!ck) return { ok: false, reason: 'no composition' };
  const formText = cut(raw.dosage_form, 80);
  return {
    ok: true,
    row: {
      brand, brandKey: brandKey(brand), manufacturer: cut(raw.manufacturer, 200), formText,
      dosageForm: classifyForm(formText) ?? classifyForm(brand),
      composition, compositionKey: ck.key.slice(0, 400), saltsKey: ck.salts.slice(0, 400), hasStrength: ck.hasStrength,
      pack: cut(raw.pack, 80), discontinued: TRUE.has(String(raw.discontinued ?? '').trim().toLowerCase()), code: cut(raw.code, 60),
    },
  };
}

export interface CanonicalResult { rows: CanonicalRow[]; skipped: Record<string, number>; total: number }

export function canonicalRows(records: Record<string, any>[]): CanonicalResult {
  const rows: CanonicalRow[] = [];
  const skipped: Record<string, number> = {};
  for (const r of records) {
    const c = canonicalRow(r);
    if (c.ok) rows.push(c.row); else skipped[c.reason] = (skipped[c.reason] || 0) + 1;
  }
  return { rows, skipped, total: records.length };
}

// ------------------------------------------------------------------------------------------------ CDCI Flat Files adapter
/*
 * The Common Drug Codes for India Flat Files Package is tab-separated text: Substance, Generic, Brand, Product Name, Supplier, Drug Form and Route masters.
 * The release notes name the files and what each holds (a Brand Master row refers to a generic medicine; a generic refers to its substances and its drug form)
 * but not the column names, so the columns are found by header and the importer shows what it found before writing. This is built from the release notes
 * alone and must be checked against the real files.
 */
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

function pick(headers: string[], ...tests: ((n: string) => boolean)[]): string | null {
  for (const t of tests) {
    const h = headers.find((x) => t(norm(x)));
    if (h) return h;
  }
  return null;
}
const isCode = (n: string) => /code$|id$|identifier$/.test(n);
const isName = (n: string) => /name|description|term|display|fsn/.test(n);
const isOwnCode = (n: string) => n === 'code' || n === 'id' || n === 'identifier';

export interface CdciMap {
  brand: { code: string | null; name: string; generic: string; supplier: string | null };
  generic: { code: string; name: string; form: string | null };
  form: { code: string; name: string } | null;
  supplier: { code: string; name: string } | null;
}

/** the columns of each master, or what is missing */
export function detectCdciColumns(h: { brand: string[]; generic: string[]; form?: string[]; supplier?: string[] }): { map?: CdciMap; problems: string[] } {
  const problems: string[] = [];
  const bName = pick(h.brand, (n) => n === 'brandname' || n === 'name', isName);
  const bGeneric = pick(h.brand, (n) => n.includes('generic') && isCode(n), (n) => n.includes('generic'));
  const bCode = pick(h.brand, (n) => n.includes('brand') && isCode(n), isOwnCode);
  const bSupplier = pick(h.brand, (n) => /supplier|manufacturer|marketer|company/.test(n) && isCode(n), (n) => /supplier|manufacturer|marketer|company/.test(n));
  const gCode = pick(h.generic, (n) => n.includes('generic') && isCode(n), isOwnCode, isCode);
  const gName = pick(h.generic, (n) => n === 'genericname' || n === 'name', isName);
  const gForm = pick(h.generic, (n) => n.includes('form') && isCode(n), (n) => n.includes('form'));
  const fCode = h.form ? pick(h.form, (n) => n.includes('form') && isCode(n), isOwnCode, isCode) : null;
  const fName = h.form ? pick(h.form, (n) => n.includes('form') && isName(n), (n) => n === 'name', isName, (n) => n.includes('form')) ?? h.form.find((x) => x !== fCode) ?? null : null;
  const sCode = h.supplier ? pick(h.supplier, (n) => n.includes('supplier') && isCode(n), isOwnCode, isCode) : null;
  const sName = h.supplier ? pick(h.supplier, (n) => n.includes('supplier') && isName(n), (n) => n === 'name', isName) : null;
  if (!bName) problems.push(`Brand Master: no column for the brand name (found: ${h.brand.join(', ')})`);
  if (!bGeneric) problems.push(`Brand Master: no column that refers to the generic medicine (found: ${h.brand.join(', ')})`);
  if (!gCode) problems.push(`Generic Master: no code column (found: ${h.generic.join(', ')})`);
  if (!gName) problems.push(`Generic Master: no name or description column (found: ${h.generic.join(', ')})`);
  if (problems.length) return { problems };
  return {
    problems,
    map: {
      brand: { code: bCode, name: bName!, generic: bGeneric!, supplier: bSupplier },
      generic: { code: gCode!, name: gName!, form: gForm },
      form: fCode && fName ? { code: fCode, name: fName } : null,
      supplier: sCode && sName ? { code: sCode, name: sName } : null,
    },
  };
}

const FORM_WORDS = new Set(('tablet tablets capsule capsules oral solution suspension syrup injection cream ointment gel drops drop eye ear nasal film coated extended release prolonged ' +
  'modified delayed chewable dispersible powder for sachet topical inhalation inhaler spray sustained enteric gastro resistant soft hard sublingual buccal vaginal rectal suppository ' +
  'conventional lotion patch transdermal intravenous intramuscular subcutaneous infusion vial ampoule concentrate emulsion granules lozenge pessary paste').split(' '));

/** "Amoxicillin 500 mg + Clavulanic acid 125 mg oral tablet" -> the part before the form words; the drug-form text, when known, is cut off first */
export function compositionOfGeneric(name: string, formName?: string | null): string {
  let t = name.replace(/\s+/g, ' ').trim();
  if (formName && t.toLowerCase().endsWith(formName.toLowerCase())) t = t.slice(0, t.length - formName.length).trim();
  const words = t.split(' ');
  const isFormWord = (w: string) => w.toLowerCase().replace(/[(),]/g, '').split('-').every((x) => FORM_WORDS.has(x));      // gastro-resistant, prolonged-release
  while (words.length > 1 && isFormWord(words[words.length - 1])) words.pop();
  return words.join(' ').replace(/[,;(]+$/, '').trim();
}

/** the official generic names write a combination with "and" and the salt in brackets: "Aspirin 75 mg and atorvastatin (as Atorvastatin calcium) 10 mg" -> "Aspirin 75 mg + atorvastatin 10 mg" */
export function readableComposition(text: string): string {
  return text.replace(/\(\s*as\b[^)]*\)/gi, ' ').replace(/\s+and\s+/gi, ' + ').replace(/\s+/g, ' ').trim();
}

export interface CdciConversion { rows: Record<string, string>[]; map?: CdciMap; problems: string[]; brands: number; unlinked: number }

/** the four masters as text -> canonical records (ready for canonicalRows) */
export function cdciToCanonical(files: { brand: string; generic: string; form?: string; supplier?: string }): CdciConversion {
  const b = withHeader(parseDelimited(files.brand, '\t'));
  const g = withHeader(parseDelimited(files.generic, '\t'));
  const f = files.form ? withHeader(parseDelimited(files.form, '\t')) : null;
  const s = files.supplier ? withHeader(parseDelimited(files.supplier, '\t')) : null;
  const d = detectCdciColumns({ brand: b.headers, generic: g.headers, form: f?.headers, supplier: s?.headers });
  if (!d.map) return { rows: [], problems: d.problems, brands: b.records.length, unlinked: 0 };
  const m = d.map;
  const forms = new Map(f && m.form ? f.records.map((r) => [r[m.form!.code], r[m.form!.name]] as [string, string]) : []);
  const suppliers = new Map(s && m.supplier ? s.records.map((r) => [r[m.supplier!.code], r[m.supplier!.name]] as [string, string]) : []);
  const generics = new Map(g.records.map((r) => [r[m.generic.code], r] as [string, Record<string, string>]));
  const rows: Record<string, string>[] = [];
  let unlinked = 0;
  for (const r of b.records) {
    const gen = generics.get(r[m.brand.generic]);
    if (!gen) { unlinked++; continue; }
    const formName = m.generic.form ? forms.get(gen[m.generic.form]) || '' : '';
    const full = gen[m.generic.name];
    rows.push({
      brand: r[m.brand.name], manufacturer: m.brand.supplier ? suppliers.get(r[m.brand.supplier]) || '' : '',
      dosage_form: formName || full, composition: readableComposition(compositionOfGeneric(full, formName)), pack: '', discontinued: '', code: m.brand.code ? r[m.brand.code] : '',
    });
  }
  return { rows, map: m, problems: [], brands: b.records.length, unlinked };
}
