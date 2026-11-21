import { classifyForm } from './dosage-form';
import { compositionKey } from '../sales/composition-match';
import { brandKey } from './drug-ref-rules';
import { compositionOfListName, PriceListRow, packOf } from './price-list-rules';

/**
 * Pure rules for another seller's price list as a table (CSV or Excel): which column is which, and each row as a price list item. Column names are found by
 * what they say ("Product", "Composition", "Pack", "MRP", "Selling price"); the person can correct the choice on the screen. The composition comes from the
 * file when it has one; otherwise from the brand dictionary when the product name is one of its brands (see `BrandIndex`). Nothing is guessed: a row
 * whose composition cannot be found is kept without one, so it is listed but never matched.
 */

export const FIELDS = ['name', 'composition', 'pack', 'mrp', 'price', 'form', 'code'] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Partial<Record<Field, string>>;

export const FIELD_LABELS: Record<Field, string> = {
  name: 'Product name', composition: 'Composition / generic', pack: 'Pack / unit size', mrp: 'MRP', price: 'Selling price', form: 'Dosage form', code: 'Code',
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES: Record<Field, string[][]> = {
  // each inner list is tried in turn: exact names first, then names that contain the word
  name: [['productname', 'product', 'brand', 'brandname', 'itemname', 'item', 'medicine', 'medicinename', 'drugname', 'drug', 'name', 'description']],
  composition: [['composition', 'generic', 'genericname', 'salt', 'salts', 'contents', 'ingredients', 'molecule', 'formula', 'content']],
  pack: [['packsize', 'pack', 'unitsize', 'unit', 'packing', 'packaging', 'qty', 'quantity', 'strip', 'size']],
  mrp: [['mrp', 'mrpinrs', 'maxretailprice', 'maximumretailprice', 'listprice', 'printedprice']],
  price: [['sellingprice', 'saleprice', 'ourprice', 'offerprice', 'discountedprice', 'netprice', 'price', 'rate', 'sp', 'selling']],
  form: [['dosageform', 'form', 'type', 'dosage']],
  code: [['code', 'itemcode', 'productcode', 'sku', 'drugcode', 'id']],
};

/** the column for each field, by its heading; a column is used for one field only */
export function detectColumns(headers: string[]): Mapping {
  const out: Mapping = {};
  const used = new Set<string>();
  for (const f of FIELDS) {
    for (const group of ALIASES[f]) {
      const exact = headers.find((h) => !used.has(h) && group.includes(norm(h)));
      const part = exact ?? headers.find((h) => !used.has(h) && group.some((a) => a.length > 3 && norm(h).includes(a)));
      if (part) { out[f] = part; used.add(part); break; }
    }
  }
  return out;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** "10", "10's", "Strip of 10", "10 tablets", "15 g", "60 ml" -> a pack */
export function packFromCell(raw: unknown): { unitSize: string; qty: number | null; kind: PriceListRow['packKind'] } {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { unitSize: '', qty: null, kind: 'other' };
  if (/^\d+(\.0+)?$/.test(text)) return { unitSize: `${parseInt(text, 10)}'s`, qty: parseInt(text, 10), kind: 'units' };
  const direct = packOf(text);
  if (direct.qty !== null) return { unitSize: text, ...direct };
  const m = /(\d+)\s*(?:'?s\b|tabs?\b|tablets?\b|caps?\b|capsules?\b|pcs?\b|units?\b)/i.exec(text) || /\b(?:of|x)\s*(\d+)\b/i.exec(text);
  if (m) return { unitSize: text, qty: Number(m[1]), kind: 'units' };
  const ml = /(\d+(?:\.\d+)?)\s*(ml|g|gm)\b/i.exec(text);
  if (ml) return { unitSize: text, qty: Number(ml[1]), kind: ml[2].toLowerCase() === 'ml' ? 'ml' : 'g' };
  return { unitSize: text.slice(0, 60), qty: null, kind: 'other' };
}

/** the dictionary's brands by name, to find the composition of a product the file names but does not describe */
export interface BrandIndex { find(name: string): { composition: string; form: string | null } | null }
export function makeBrandIndex(brands: { brand_key: string; composition: string; composition_key: string; dosage_form: string | null }[]): BrandIndex {
  const sorted = brands.slice().sort((a, b) => (a.brand_key < b.brand_key ? -1 : a.brand_key > b.brand_key ? 1 : 0));
  return {
    find(name: string) {
      const key = brandKey(name);
      if (key.length < 4) return null;
      // every brand whose name starts with the product name (the file says "Telmiten 40", the dictionary "Telmiten 40 mg oral tablet"): used only when they all agree
      let lo = 0, hi = sorted.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid].brand_key < key) lo = mid + 1; else hi = mid; }
      const first = sorted[lo];
      if (!first || !first.brand_key.startsWith(key)) return null;
      let i = lo;
      while (i < sorted.length && sorted[i].brand_key.startsWith(key) && sorted[i].composition_key === first.composition_key && sorted[i].dosage_form === first.dosage_form) i++;
      if (i < sorted.length && sorted[i].brand_key.startsWith(key)) return null;       // the matches disagree: not safe
      return { composition: first.composition, form: first.dosage_form };
    },
  };
}

export interface SheetRead { rows: PriceListRow[]; problems: string[]; total: number; fromDictionary: number }

/** the table's rows (heading -> text) as price list items; `mapping` says which heading is which field */
export function rowsFromTable(records: Record<string, any>[], mapping: Mapping, brands: BrandIndex | null): SheetRead {
  const problems: string[] = [];
  const rows: PriceListRow[] = [];
  let fromDictionary = 0;
  if (!mapping.name) problems.push('No column was chosen for the product name.');
  if (!mapping.mrp && !mapping.price) problems.push('No column was chosen for the MRP or the selling price.');
  if (problems.length) return { rows, problems, total: records.length, fromDictionary };
  const get = (r: Record<string, any>, f: Field) => (mapping[f] ? r[mapping[f] as string] : undefined);
  let n = 0;
  for (const r of records) {
    n++;
    const name = String(get(r, 'name') ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!name) continue;                                              // a blank line
    const mrpRaw = num(get(r, 'mrp')), sell = num(get(r, 'price'));
    const mrp = mrpRaw && mrpRaw > 0 ? mrpRaw : sell && sell > 0 ? sell : null;     // a list with only one price: it is both
    if (mrp === null) { problems.push(`line ${n + 1} (${name}): no price, left out`); continue; }
    if (sell !== null && sell > mrp + 0.005) { problems.push(`line ${n + 1} (${name}): the selling price is above the MRP, left out`); continue; }
    const pack = packFromCell(get(r, 'pack'));
    let composition: string | null = String(get(r, 'composition') ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) || null;
    let form: string | null = classifyForm(get(r, 'form')) ?? null;
    if (composition) {
      // a composition typed as a generic name ("Aceclofenac 100mg and Paracetamol 325mg Tablets") is read the same way as the PMBI names
      const read = compositionOfListName(composition);
      composition = read.composition ?? composition;
      form = form ?? read.form;
    } else {
      const found = brands?.find(name) ?? null;
      if (found) { composition = found.composition; form = form ?? found.form; fromDictionary++; }
    }
    form = form ?? classifyForm(name);
    const key = composition ? compositionKey(composition) : null;
    rows.push({
      sr: rows.length + 1, code: String(get(r, 'code') ?? '').trim().slice(0, 40), name, unitSize: pack.unitSize, packQty: pack.qty, packKind: pack.kind,
      mrp: Math.round(mrp * 100) / 100, sellPrice: sell !== null && sell > 0 ? Math.round(sell * 100) / 100 : null,
      composition, compositionKey: key?.key ?? null, saltsKey: key?.salts ?? null, hasStrength: !!key?.hasStrength, form,
    });
  }
  return { rows, problems, total: records.length, fromDictionary };
}
