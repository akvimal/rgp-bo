import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LOOKUP_KINDS, LookupOutcome, cleanTyped, outcomeOf } from './lookup-log';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { dosageFormLabel } from '../dictionary/dosage-form';
import { brandKey } from '../dictionary/drug-ref-rules';
import { compositionKey } from './composition-match';
import { SaleSuggestionService } from './sale-suggestion.service';

/**
 * The brand dictionary at the counter: a customer names a brand the shop may not carry; look it up in the dictionary (filled from the official Common Drug Codes
 * for India list by the importer), read its composition and dosage form, and show what the shop has with the same composition and form. When nothing is in stock,
 * a few other brands of that composition are listed to order. The dictionary carries no prices; prices shown are the shop's own.
 */
@Injectable()
export class DrugRefService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly suggestions: SaleSuggestionService) {}

  /** the list in use, or none (the importer has not been run) */
  async status() {
    const [s] = await this.manager.query(`select id, kind, name, version, row_count, imported_on, note from drug_ref_source where active`);
    return s
      ? { available: true, source: { id: s.id, kind: s.kind, name: s.name, version: s.version, rows: s.row_count, importedOn: s.imported_on, note: s.note } }
      : { available: false, source: null };
  }

  private shape(r: any) {
    return { id: Number(r.id), brand: r.brand, manufacturer: r.manufacturer || null, form: r.dosage_form, formLabel: dosageFormLabel(r.dosage_form) || r.form_text || null, composition: r.composition, discontinued: !!r.discontinued };
  }

  /** brands whose name starts with what was typed first, then those that contain it; at least three letters or digits */
  async search(q: string, limit = 15) {
    const key = brandKey(q);
    const st = await this.status();
    if (!st.available || key.length < 3) return { ...st, results: [] };
    const sourceId = st.source!.id;
    const starts = await this.manager.query(
      `select id, brand, manufacturer, dosage_form, form_text, composition, discontinued from drug_ref_brand
        where source_id = $1 and brand_key like $2 order by discontinued, length(brand_key), brand_key limit $3`, [sourceId, `${key}%`, limit]);
    let rows = starts;
    if (rows.length < limit) {
      const more = await this.manager.query(
        `select id, brand, manufacturer, dosage_form, form_text, composition, discontinued from drug_ref_brand
          where source_id = $1 and brand_key like $2 and brand_key not like $3 order by discontinued, length(brand_key), brand_key limit $4`, [sourceId, `%${key}%`, `${key}%`, limit - rows.length]);
      rows = rows.concat(more);
    }
    return { ...st, results: rows.map((r: any) => this.shape(r)) };
  }

  /**
   * Keeps what a brand check found: a brand picked from the dictionary, a product picked from our own list, or a brand typed that nothing matched.
   * The outcome is worked out here from the same lookup the screen used, not taken from the screen.
   */
  async logLookup(userId: number, storeId: number | null, b: any) {
    const kind = String(b?.kind);
    if (!(LOOKUP_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('Say what was looked up.');
    let text: string | null, composition: string | null = null, form: string | null = null, outcome: LookupOutcome;
    let brandId: number | null = null, productId: number | null = null;
    if (kind === 'TYPED') {
      text = cleanTyped(b?.text);
      if (!text) throw new BadRequestException('Nothing to keep: type at least three letters.');
      outcome = 'NOT_FOUND';
    } else if (kind === 'BRAND') {
      brandId = Number(b?.brandid) || null;
      if (!brandId) throw new BadRequestException('Say which brand.');
      const r: any = await this.forBrand(brandId, storeId);
      text = r.asked.title; composition = r.asked.composition ?? null; form = r.asked.form ?? null; outcome = outcomeOf(r);
    } else {
      productId = Number(b?.productid) || null;
      if (!productId) throw new BadRequestException('Say which product.');
      const r: any = await this.suggestions.alternatives(productId, storeId);
      text = r.asked.title; composition = r.asked.composition ?? null; form = r.asked.form ?? null; outcome = outcomeOf(r);
    }
    await this.manager.query(
      `insert into brand_lookup_event (store_id, user_id, kind, text, composition, form, brand_id, product_id, outcome) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [storeId, userId || null, kind, String(text).slice(0, 160), composition ? String(composition).slice(0, 300) : null, form, brandId, productId, outcome]);
    return { outcome };
  }

  async forBrand(brandId: number, storeId: number | null) {
    const st = await this.status();
    if (!st.available) throw new NotFoundException('The brand dictionary has not been loaded.');
    const [b] = await this.manager.query(
      `select id, brand, manufacturer, dosage_form, form_text, composition, discontinued from drug_ref_brand where id = $1 and source_id = $2`, [brandId, st.source!.id]);
    if (!b) throw new NotFoundException('That brand is not in the dictionary.');
    const asked = { ...this.shape(b), title: b.brand, fromDictionary: true };
    const base = { asked, source: st.source };
    const mk = compositionKey(b.composition);
    if (!mk) return { ...base, status: 'NO_COMPOSITION', same: [], otherStrengths: [], otherForms: [], notStocked: [], orderIdeas: [] };
    if (!mk.hasStrength) return { ...base, status: 'NO_STRENGTH', same: [], otherStrengths: [], otherForms: [], notStocked: [], orderIdeas: [] };
    const m = await this.suggestions.matches(mk, b.dosage_form || null, storeId, null);
    // nothing in stock: other brands of the same composition and form, to ask a vendor for
    const orderIdeas = m.same.length
      ? []
      : (await this.manager.query(
          `select id, brand, manufacturer, dosage_form, form_text, composition, discontinued from drug_ref_brand
            where source_id = $1 and composition_key = $2 and id <> $3 and not discontinued and ($4::text is null or dosage_form is null or dosage_form = $4)
            order by (brand_key ~ '^[0-9]'), brand_key limit 8`, [st.source!.id, mk.key, b.id, b.dosage_form || null])).map((r: any) => this.shape(r));
    return { ...base, status: 'OK', same: m.same, otherStrengths: m.otherStrengths, otherForms: m.otherForms, notStocked: m.notStocked, orderIdeas };
  }
}
