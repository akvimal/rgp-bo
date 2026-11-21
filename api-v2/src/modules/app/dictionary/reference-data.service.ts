import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isOwnerRole } from 'src/core/roles';
import { canonicalRows, cdciToCanonical } from './drug-ref-rules';
import { pdfPieces } from './price-list-pdf';
import { readPriceList, PriceListRow } from './price-list-rules';
import { readTable } from './price-sheet-reader';
import { BrandIndex, detectColumns, FIELD_LABELS, FIELDS, makeBrandIndex, Mapping, rowsFromTable } from './price-sheet-rules';
import { writeBrandDictionary, writePriceList } from './reference-import';

const CDCI_NOTE = 'CC BY 4.0, NRCeS / C-DAC, Ministry of Health and Family Welfare. Brand names are the property of their owners.';
const CDCI_NAME = 'Common Drug Codes for India (Flat Files)';
const PMBI_NAME = 'PMBI Jan Aushadhi';

/**
 * Loading and refreshing the reference data behind Check brand and the price comparison, from the screen: the brand dictionary (the CDCI Flat Files), the PMBI
 * Jan Aushadhi price list (its PDF) and other sellers' price lists (CSV or Excel). Each is shown first (what was found, what it would replace) and written
 * only when applied, in one transaction. A list with the same name is replaced; other lists stay. The Business Head only. The same readers and writers as the
 * command-line importers.
 */
@Injectable()
export class ReferenceDataService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async owner(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!isOwnerRole(r?.name)) throw new ForbiddenException('Loading reference data is for the Business Head.');
    const [u] = await this.manager.query(`select coalesce(full_name, email) as name from app_user where id = $1`, [user?.id || 0]);
    return String(u?.name || 'the Business Head');
  }

  private async sources() {
    const [b] = await this.manager.query(
      `select s.id, s.name, s.version, s.row_count, s.skipped_count, s.imported_on, s.imported_by, s.note, (select count(*)::int from drug_ref_brand where source_id = s.id) as loaded from drug_ref_source s where s.active`);
    const lists = await this.manager.query(
      `select s.id, s.kind, s.name, s.version, s.row_count, s.skipped_count, s.imported_on, s.imported_by, s.note,
              (select count(*)::int from price_ref_item i where i.source_id = s.id and i.has_strength) as matchable,
              (select count(*)::int from price_ref_item i where i.source_id = s.id and i.sell_price is not null) as with_selling_price
         from price_ref_source s order by (s.kind = 'PMBI') desc, lower(s.name)`);
    return {
      brands: b ? { id: b.id, name: b.name, version: b.version, rows: b.row_count, skipped: b.skipped_count, loaded: b.loaded, importedOn: b.imported_on, importedBy: b.imported_by, note: b.note } : null,
      lists: lists.map((s: any) => ({ id: s.id, kind: s.kind, name: s.name, version: s.version, rows: s.row_count, skipped: s.skipped_count, matchable: s.matchable, withSellingPrice: s.with_selling_price, importedOn: s.imported_on, importedBy: s.imported_by, note: s.note })),
    };
  }

  async status(user: any) {
    await this.owner(user);
    return this.sources();
  }

  private async sameName(name: string) {
    const [s] = await this.manager.query(`select id, name, row_count from price_ref_source where lower(name) = lower($1)`, [name]);
    return s ? { id: s.id, name: s.name, rows: s.row_count } : null;
  }

  async deleteList(user: any, id: number) {
    await this.owner(user);
    const [s] = await this.manager.query(`delete from price_ref_source where id = $1 returning name`, [id]);
    if (!s) throw new NotFoundException('That list is not there.');
    await this.audit.record({ userId: user.id, action: 'reference.price_list_removed', entityType: 'price_ref_source', entityId: id, summary: `price list removed: ${s.name}`, details: {} });
    return this.sources();
  }

  private summary(rows: PriceListRow[]) {
    const forms: Record<string, number> = {};
    rows.forEach((r) => { forms[r.form ?? '(not known)'] = (forms[r.form ?? '(not known)'] || 0) + 1; });
    return {
      rows: rows.length, matchable: rows.filter((r) => r.hasStrength).length, withSellingPrice: rows.filter((r) => r.sellPrice !== null).length, forms,
      sample: rows.slice(0, 5).map((r) => ({ name: r.name, composition: r.composition, form: r.form, unitSize: r.unitSize, mrp: r.mrp, sellPrice: r.sellPrice })),
    };
  }

  // ---------------------------------------------------------------- the PMBI price list (PDF)

  private async readPmbi(buf: Buffer) {
    if (!buf?.length || buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new BadRequestException('Choose the price list as a PDF file.');
    let read;
    try { read = readPriceList(await pdfPieces(buf)); } catch { throw new BadRequestException('That PDF could not be read.'); }
    const zero = read.problems.filter((p) => /MRP 0/.test(p)).length;
    const other = read.problems.filter((p) => !/MRP 0/.test(p));
    return { read, zero, other };
  }

  async previewPmbi(user: any, buf: Buffer, body: { name?: string }) {
    await this.owner(user);
    const { read, zero, other } = await this.readPmbi(buf);
    const name = String(body?.name || '').trim().slice(0, 200) || PMBI_NAME;
    return { name, pages: read.pages, leftOutZeroMrp: zero, problems: other.slice(0, 30), ...this.summary(read.rows), canApply: read.rows.length > 0 && other.length === 0, replaces: await this.sameName(name) };
  }

  async applyPmbi(user: any, buf: Buffer, body: { version?: string; name?: string }) {
    const by = await this.owner(user);
    const { read, zero, other } = await this.readPmbi(buf);
    if (!read.rows.length || other.length) throw new BadRequestException(other.length ? 'The list has problems: preview it and resolve them first.' : 'No rows were found in that PDF.');
    const version = String(body?.version || '').trim().slice(0, 60) || null;
    const name = String(body?.name || '').trim().slice(0, 200) || PMBI_NAME;
    const id = await this.manager.transaction((tm) => writePriceList((s, p) => tm.query(s, p), read.rows, { kind: 'PMBI', name, version, skipped: zero, by, note: 'loaded from the screen' }));
    await this.audit.record({ userId: user.id, action: 'reference.price_list_loaded', entityType: 'price_ref_source', entityId: id, summary: `price list loaded: ${name}, ${read.rows.length} items${version ? ` (${version})` : ''}`, details: { rows: read.rows.length, version } });
    return { ok: true, id, rows: read.rows.length, status: await this.sources() };
  }

  // ---------------------------------------------------------------- another seller's list (CSV / Excel)

  private parseMapping(raw: any): Mapping {
    if (!raw) return {};
    let m: any = raw;
    if (typeof raw === 'string') { try { m = JSON.parse(raw); } catch { throw new BadRequestException('The column choices could not be read.'); } }
    const out: Mapping = {};
    for (const f of FIELDS) if (m?.[f]) out[f] = String(m[f]);
    return out;
  }

  private async readSheet(buf: Buffer, fileName: string, body: { mapping?: any }) {
    const table = await readTable(buf, fileName);
    const detected = detectColumns(table.headers);
    const chosen = this.parseMapping(body?.mapping);
    for (const f of Object.keys(chosen) as (keyof Mapping)[]) if (chosen[f] && !table.headers.includes(chosen[f] as string)) throw new BadRequestException(`There is no column "${chosen[f]}" in the file.`);
    const mapping: Mapping = Object.keys(chosen).length ? chosen : detected;
    // the brand dictionary names the composition of a product the file does not describe
    let brands: BrandIndex | null = null;
    const col = mapping.composition;
    if (!col || table.records.some((r) => !String(r[col] ?? '').trim())) {
      const all = await this.manager.query(`select brand_key, composition, composition_key, dosage_form from drug_ref_brand where source_id = (select id from drug_ref_source where active)`);
      brands = all.length ? makeBrandIndex(all) : null;
    }
    return { table, detected, mapping, sheet: rowsFromTable(table.records, mapping, brands) };
  }

  async previewSheet(user: any, buf: Buffer, fileName: string, body: { name?: string; mapping?: any }) {
    await this.owner(user);
    const { table, detected, mapping, sheet } = await this.readSheet(buf, fileName, body);
    const name = String(body?.name || '').trim().slice(0, 200);
    return {
      name, headers: table.headers, mapping, detected, fields: FIELDS.map((f) => ({ key: f, label: FIELD_LABELS[f] })),
      lines: table.records.length, fromDictionary: sheet.fromDictionary, problems: sheet.problems.slice(0, 30), moreProblems: Math.max(0, sheet.problems.length - 30),
      ...this.summary(sheet.rows), canApply: sheet.rows.length > 0 && name.length >= 2, replaces: name ? await this.sameName(name) : null,
    };
  }

  async applySheet(user: any, buf: Buffer, fileName: string, body: { name?: string; version?: string; mapping?: any }) {
    const by = await this.owner(user);
    const name = String(body?.name || '').trim().slice(0, 200);
    if (name.length < 2) throw new BadRequestException('Give the list a name, for example the seller it belongs to.');
    if (name.toLowerCase() === PMBI_NAME.toLowerCase()) throw new BadRequestException('That name is the Jan Aushadhi list: use its own upload.');
    const { sheet } = await this.readSheet(buf, fileName, body);
    if (!sheet.rows.length) throw new BadRequestException(sheet.problems[0] || 'No usable rows were found in that file.');
    const version = String(body?.version || '').trim().slice(0, 60) || null;
    const id = await this.manager.transaction((tm) => writePriceList((s, p) => tm.query(s, p), sheet.rows,
      { kind: 'COMPETITOR', name, version, skipped: sheet.problems.length, by, note: `from ${fileName.slice(0, 120)}` }));
    await this.audit.record({ userId: user.id, action: 'reference.price_list_loaded', entityType: 'price_ref_source', entityId: id, summary: `price list loaded: ${name}, ${sheet.rows.length} items${version ? ` (${version})` : ''}`, details: { rows: sheet.rows.length, version } });
    return { ok: true, id, rows: sheet.rows.length, status: await this.sources() };
  }

  // ---------------------------------------------------------------- the brand dictionary (CDCI files)

  private readBrands(files: { originalname: string; buffer: Buffer }[]) {
    const by = (n: string) => files.find((f) => f.originalname.toLowerCase().replace(/\s+/g, '') === n.toLowerCase());
    const brand = by('BrandMaster.txt'), generic = by('GenericMaster.txt');
    if (!brand || !generic) throw new BadRequestException('Choose the CDCI files: BrandMaster.txt and GenericMaster.txt are needed, with DrugFormMaster.txt and SupplierMaster.txt.');
    const text = (f?: { buffer: Buffer }) => (f ? f.buffer.toString('utf8') : undefined);
    const conv = cdciToCanonical({ brand: text(brand)!, generic: text(generic)!, form: text(by('DrugFormMaster.txt')), supplier: text(by('SupplierMaster.txt')) });
    if (conv.problems.length) throw new BadRequestException('Cannot read the CDCI files: ' + conv.problems.join('; '));
    const { rows, skipped, total } = canonicalRows(conv.rows);
    return { conv, rows, skipped, total };
  }

  async previewBrands(user: any, files: { originalname: string; buffer: Buffer }[]) {
    await this.owner(user);
    const { conv, rows, skipped } = this.readBrands(files);
    const forms: Record<string, number> = {};
    rows.forEach((r) => { forms[r.dosageForm ?? '(not known)'] = (forms[r.dosageForm ?? '(not known)'] || 0) + 1; });
    return {
      brandRows: conv.brands, leftOutNoGeneric: conv.unlinked, usable: rows.length, skipped, withStrength: rows.filter((r) => r.hasStrength).length, forms,
      sample: rows.slice(0, 5).map((r) => ({ brand: r.brand, manufacturer: r.manufacturer, form: r.dosageForm, composition: r.composition })),
      canApply: rows.length > 0, replaces: (await this.sources()).brands,
    };
  }

  async applyBrands(user: any, files: { originalname: string; buffer: Buffer }[], body: { version?: string }) {
    const by = await this.owner(user);
    const { rows, total } = this.readBrands(files);
    if (!rows.length) throw new BadRequestException('No usable brands were found in those files.');
    const version = String(body?.version || '').trim().slice(0, 60) || null;
    const id = await this.manager.transaction((tm) => writeBrandDictionary((s, p) => tm.query(s, p), rows,
      { kind: 'cdci', name: CDCI_NAME, version, skipped: total - rows.length, by, note: CDCI_NOTE }));
    await this.audit.record({ userId: user.id, action: 'reference.brand_dictionary_loaded', entityType: 'drug_ref_source', entityId: id, summary: `brand dictionary loaded: ${rows.length} brands${version ? ` (${version})` : ''}`, details: { rows: rows.length, version } });
    return { ok: true, id, rows: rows.length, status: await this.sources() };
  }
}
