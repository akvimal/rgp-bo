import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AiProvider } from '../alerts/ai-provider';
import { resolveModel } from '../alerts/ai-models';
import { dosageFormLabel } from '../dictionary/dosage-form';
import { isFresh, parsePriceAnswer, PRICE_SYSTEM, priceInstruction, PriceAnswer } from './brand-price-rules';

export const BRAND_PRICE_TASK = 'look_up_brand_price';

/**
 * The online price of a brand from the dictionary (which has no prices): a model with web search reads pharmacy pages for the MRP, the pack and the selling
 * prices; rules check the answer; it is kept for a month per brand so the same brand is not searched twice. Indicative only, and shown with its sources.
 */
@Injectable()
export class BrandPriceService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly ai: AiProvider) {}

  private view(row: any, cached: boolean) {
    return { ...(row.answer as PriceAnswer), brand: row.brand, asOf: row.looked_up_on, model: row.model, cached, fresh: isFresh(row.looked_up_on) };
  }

  private async brandRow(brandId: number) {
    const [b] = await this.manager.query(`select id, brand, manufacturer, dosage_form, form_text, composition from drug_ref_brand where id = $1`, [brandId]);
    if (!b) throw new NotFoundException('That brand is not in the dictionary.');
    return b;
  }

  /** what was kept for the brand, if anything: costs nothing */
  async kept(brandId: number) {
    const b = await this.brandRow(brandId);
    const [row] = await this.manager.query(`select brand, answer, model, looked_up_on from brand_price_lookup where brand_key = $1`, [String(b.brand).toLowerCase()]);
    return { available: this.ai.configured, kept: row ? this.view(row, true) : null };
  }

  /** looks the brand up online (or returns what was kept while it is fresh, unless a new look is asked for) */
  async lookup(brandId: number, refresh: boolean, user: any) {
    const b = await this.brandRow(brandId);
    const key = String(b.brand).toLowerCase();
    const [row] = await this.manager.query(`select brand, answer, model, looked_up_on from brand_price_lookup where brand_key = $1`, [key]);
    // an answer kept before the per-site list existed has no sites to show: it is looked up again
    if (row && !refresh && isFresh(row.looked_up_on) && Array.isArray(row.answer?.listings)) return this.view(row, true);

    if (!this.ai.configured) throw new ServiceUnavailableException('The online lookup needs the assistant, which the Business Head switches on under Settings > AI assistant.');
    const model = await resolveModel(this.manager, this.ai, BRAND_PRICE_TASK);
    if (!model) throw new BadRequestException('Choose a model for the assistant under Settings > AI assistant first.');

    const web = await this.ai.askWeb(PRICE_SYSTEM,
      priceInstruction({ brand: b.brand, composition: b.composition, manufacturer: b.manufacturer, formLabel: dosageFormLabel(b.dosage_form) || b.form_text || null }),
      model, BRAND_PRICE_TASK);
    const answer = parsePriceAnswer(web.text, web.sources);
    // only a price that passed the checks replaces what was kept: a failed look must not wipe a good earlier answer
    if (!answer.found && row?.answer?.found) return { ...this.view(row, true), retryNote: answer.note };
    const [saved] = await this.manager.query(
      `insert into brand_price_lookup (brand_key, brand, found, answer, model, looked_up_by) values ($1, $2, $3, $4::jsonb, $5, $6)
       on conflict (brand_key) do update set brand = excluded.brand, found = excluded.found, answer = excluded.answer, model = excluded.model, looked_up_on = now(), looked_up_by = excluded.looked_up_by
       returning brand, answer, model, looked_up_on`, [key, b.brand, answer.found, JSON.stringify(answer), model, user?.id ?? null]);
    return this.view(saved, false);
  }
}
