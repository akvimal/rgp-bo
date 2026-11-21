/**
 * Loads the PMBI Jan Aushadhi price list (the published PDF: Sr. No., Drug Code, Generic Name, Unit Size, MRP) into price_ref_item, to compare the shop's MRP and
 * selling prices with it.
 *
 *   node dist/tools/import-price-list.js --pdf "Product List.pdf" [--name "PMBI price list"] [--version "2026-11"] [--dry-run]
 *
 * It prints what it found first. A dry run writes nothing. A list with the same name is replaced in a single transaction; other lists stay.
 * The database is the DATABASE_URL of the environment, so check which one that is before running it for real.
 */
import { readFileSync } from 'fs';
import { userInfo } from 'os';
import { Client } from 'pg';
import { pdfPieces } from '../modules/app/dictionary/price-list-pdf';
import { readPriceList } from '../modules/app/dictionary/price-list-rules';
import { writePriceList } from '../modules/app/dictionary/reference-import';

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

async function main() {
  const a = args();
  if (!a.pdf || a.pdf === true) { console.error('Give --pdf <the price list PDF>.'); process.exit(2); }
  const read = readPriceList(await pdfPieces(readFileSync(String(a.pdf))));
  const { rows, problems } = read;
  const zero = problems.filter((p) => /MRP 0/.test(p)).length;
  const other = problems.filter((p) => !/MRP 0/.test(p));
  const forms: Record<string, number> = {};
  rows.forEach((r) => { forms[r.form ?? '(not known)'] = (forms[r.form ?? '(not known)'] || 0) + 1; });
  console.log(`pages: ${read.pages}; rows read: ${rows.length}; left out for an MRP of 0: ${zero}; other problems: ${other.length}`);
  other.slice(0, 20).forEach((p) => console.log('  ' + p));
  console.log(`with a composition and strength to match on: ${rows.filter((r) => r.hasStrength).length}`);
  console.log('dosage forms:', JSON.stringify(forms));
  console.log('sample:', JSON.stringify(rows.slice(0, 3).map((r) => [r.sr, r.composition, r.form, r.unitSize, r.mrp])));
  if (!rows.length || other.length) { console.error(other.length ? '\nResolve the problems above first: nothing written.' : 'Nothing to import.'); process.exit(2); }
  if (a['dry-run']) { console.log('\nDry run: nothing written.'); return; }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(2); }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('begin');
    const id = await writePriceList(async (sql, params) => (await db.query(sql, params)).rows, rows,
      { kind: 'PMBI', name: String(a.name || 'PMBI Jan Aushadhi'), version: a.version ? String(a.version) : null, skipped: zero, by: userInfo().username, note: `read from ${String(a.pdf).split(/[\\/]/).pop()}` });
    await db.query('commit');
    console.log(`
Imported ${rows.length} items as list ${id}. A list with the same name was replaced; other lists stay.`);
  } catch (e) {
    await db.query('rollback');
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
