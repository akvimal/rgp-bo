/**
 * Fills the brand dictionary (drug_ref_brand) from the official Common Drug Codes for India Flat Files package, or from a prepared CSV.
 *
 *   node dist/tools/import-drug-ref.js --cdci-dir <folder with BrandMaster.txt ...> --version "2026-08-31" [--dry-run]
 *   node dist/tools/import-drug-ref.js --file brands.csv --kind canonical|dev --name "..." [--dry-run]
 *
 * The CSV columns are brand, manufacturer, dosage_form, composition, pack, discontinued, code (a header row is required; extra columns are ignored).
 * It prints what it found first. A dry run writes nothing. The new list becomes the active one in a single transaction and the previous list is removed.
 * The database is the DATABASE_URL of the environment, so check which one that is before running it for real.
 * Attribution (CC BY 4.0): Common Drug Codes for India, NRCeS, C-DAC, MoHFW. Brand names belong to their owners.
 */
import { readFileSync } from 'fs';
import { userInfo } from 'os';
import { join } from 'path';
import { Client } from 'pg';
import { canonicalRows, cdciToCanonical, parseDelimited, withHeader } from '../modules/app/dictionary/drug-ref-rules';

function args() {
  const a: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) a[k] = true; else { a[k] = v; i++; }
  }
  return a;
}

const read = (file: string) => readFileSync(file, 'utf8');

async function main() {
  const a = args();
  let kind = String(a.kind || 'canonical');
  let name = String(a.name || '');
  let records: Record<string, any>[] = [];
  let note = '';

  if (a['cdci-dir']) {
    const dir = String(a['cdci-dir']);
    const conv = cdciToCanonical({
      brand: read(join(dir, 'BrandMaster.txt')), generic: read(join(dir, 'GenericMaster.txt')),
      form: read(join(dir, 'DrugFormMaster.txt')), supplier: read(join(dir, 'SupplierMaster.txt')),
    });
    if (conv.problems.length) { console.error('Cannot read the CDCI files:\n - ' + conv.problems.join('\n - ')); process.exit(2); }
    console.log('CDCI columns used:', JSON.stringify(conv.map));
    console.log(`Brand Master rows: ${conv.brands}; left out because their generic medicine is not in the Generic Master: ${conv.unlinked}`);
    records = conv.rows;
    kind = 'cdci';
    name = name || 'Common Drug Codes for India (Flat Files)';
    note = 'CC BY 4.0, NRCeS / C-DAC, Ministry of Health and Family Welfare. Brand names are the property of their owners.';
  } else if (a.file) {
    const { records: r } = withHeader(parseDelimited(read(String(a.file)), String(a.file).toLowerCase().endsWith('.tsv') ? '\t' : ','));
    records = r;
    name = name || String(a.file);
  } else {
    console.error('Give --cdci-dir <folder> or --file <csv>.');
    process.exit(2);
  }
  if (!['cdci', 'canonical', 'dev'].includes(kind)) { console.error('--kind must be canonical or dev for a CSV.'); process.exit(2); }

  const { rows, skipped, total } = canonicalRows(records);
  const forms: Record<string, number> = {};
  rows.forEach((r) => { forms[r.dosageForm ?? '(not known)'] = (forms[r.dosageForm ?? '(not known)'] || 0) + 1; });
  console.log(`\nrecords: ${total}; usable: ${rows.length}; skipped: ${JSON.stringify(skipped)}`);
  console.log(`with a strength in the composition: ${rows.filter((r) => r.hasStrength).length} (${Math.round((100 * rows.filter((r) => r.hasStrength).length) / Math.max(rows.length, 1))}%)`);
  console.log('dosage forms:', JSON.stringify(forms));
  console.log('sample:', JSON.stringify(rows.slice(0, 3).map((r) => [r.brand, r.manufacturer, r.dosageForm, r.compositionKey])));
  if (a['dry-run']) { console.log('\nDry run: nothing written.'); return; }
  if (!rows.length) { console.error('Nothing to import.'); process.exit(2); }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('begin');
    const [src] = (await db.query(
      `insert into drug_ref_source (kind, name, version, row_count, skipped_count, active, imported_by, note) values ($1,$2,$3,$4,$5,false,$6,$7) returning id`,
      [kind, name, a.version ? String(a.version) : null, rows.length, total - rows.length, userInfo().username, note || null])).rows;
    const cols = 12;
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      const params: any[] = [];
      const values = chunk.map((r, j) => {
        params.push(src.id, r.brand, r.brandKey, r.manufacturer, r.dosageForm, r.formText, r.composition, r.compositionKey, r.saltsKey, r.hasStrength, r.pack, r.discontinued, r.code);
        const o = j * (cols + 1);
        return `(${Array.from({ length: cols + 1 }, (_, n) => `$${o + n + 1}`).join(',')})`;
      });
      await db.query(`insert into drug_ref_brand (source_id, brand, brand_key, manufacturer, dosage_form, form_text, composition, composition_key, salts_key, has_strength, pack, discontinued, code) values ${values.join(',')}`, params);
    }
    await db.query(`update drug_ref_source set active = false where active`);
    await db.query(`update drug_ref_source set active = true where id = $1`, [src.id]);
    await db.query(`delete from drug_ref_source where id <> $1`, [src.id]);   // the previous list goes (its brands with it)
    await db.query('commit');
    console.log(`\nImported ${rows.length} brands as source ${src.id} (${name}). It is now the active list.`);
  } catch (e) {
    await db.query('rollback');
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
