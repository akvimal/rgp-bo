import { CanonicalRow } from './drug-ref-rules';
import { PriceListRow } from './price-list-rules';

/** a query function over a connection already in a transaction: the importers (a pg client) and the upload screen (a typeorm manager) both fit it */
export type Q = (sql: string, params?: any[]) => Promise<any[]>;

const CHUNK = 500;

function insertChunks<T>(rows: T[], perRow: number, run: (values: string, params: any[]) => Promise<any>, flat: (r: T) => any[]) {
  const jobs: Promise<any>[] = [];
  const chain = async () => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const params: any[] = [];
      const values = rows.slice(i, i + CHUNK).map((r, j) => {
        params.push(...flat(r));
        return `(${Array.from({ length: perRow }, (_, n) => `$${j * perRow + n + 1}`).join(',')})`;
      });
      await run(values.join(','), params);
    }
  };
  jobs.push(chain());
  return Promise.all(jobs);
}

/**
 * Writes the brand dictionary: a new source with its brands, which becomes the active list and replaces the previous one (its brands go with it). The caller
 * opens and closes the transaction. Returns the new source's id.
 */
export async function writeBrandDictionary(q: Q, rows: CanonicalRow[], meta: { kind: string; name: string; version: string | null; skipped: number; by: string; note: string | null }): Promise<number> {
  const [src] = await q(
    `insert into drug_ref_source (kind, name, version, row_count, skipped_count, active, imported_by, note) values ($1,$2,$3,$4,$5,false,$6,$7) returning id`,
    [meta.kind, meta.name, meta.version, rows.length, meta.skipped, meta.by, meta.note]);
  const id = Number(src.id);
  await insertChunks(rows, 13, (values, params) => q(
    `insert into drug_ref_brand (source_id, brand, brand_key, manufacturer, dosage_form, form_text, composition, composition_key, salts_key, has_strength, pack, discontinued, code) values ${values}`, params),
    (r) => [id, r.brand, r.brandKey, r.manufacturer, r.dosageForm, r.formText, r.composition, r.compositionKey, r.saltsKey, r.hasStrength, r.pack, r.discontinued, r.code]);
  await q(`update drug_ref_source set active = false where active`);
  await q(`update drug_ref_source set active = true where id = $1`, [id]);
  await q(`delete from drug_ref_source where id <> $1`, [id]);
  return id;
}

/**
 * Writes a price list (the PMBI list from its PDF, or a competitor's from CSV / Excel) as a source with its items. A list with the same name is replaced
 * (its items go with it); other lists stay. The caller opens and closes the transaction. Returns the new source's id.
 */
export async function writePriceList(q: Q, rows: PriceListRow[], meta: { kind: 'PMBI' | 'COMPETITOR'; name: string; version: string | null; skipped: number; by: string; note: string | null }): Promise<number> {
  await q(`delete from price_ref_source where lower(name) = lower($1)`, [meta.name]);
  const [src] = await q(
    `insert into price_ref_source (kind, name, version, row_count, skipped_count, imported_by, note) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [meta.kind, meta.name, meta.version, rows.length, meta.skipped, meta.by, meta.note]);
  const id = Number(src.id);
  await insertChunks(rows, 14, (values, params) => q(
    `insert into price_ref_item (source_id, sr, code, name, unit_size, pack_qty, pack_kind, mrp, sell_price, composition, composition_key, salts_key, has_strength, dosage_form) values ${values}`, params),
    (r) => [id, r.sr, r.code || null, r.name.slice(0, 300), r.unitSize.slice(0, 60) || null, r.packQty, r.packKind, r.mrp, r.sellPrice, r.composition, r.compositionKey, r.saltsKey, r.hasStrength, r.form]);
  return id;
}
