import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AiProvider } from '../alerts/ai-provider';
import { resolveModel } from '../alerts/ai-models';
import { classifyForm, dosageFormLabel } from '../dictionary/dosage-form';
import { compositionKey } from './composition-match';
import { isFresh, marketInstruction, MarketAnswer, MARKET_SYSTEM, parseMarketAnswer } from './market-price-rules';
import { customerPrice, gapPct, RefItem, summarise, SourceSummary, worstGap } from './price-compare-rules';

export const MARKET_TASK = 'look_up_market_price';

/**
 * Compares the shop's MRP and selling prices with the loaded price lists (PMBI Jan Aushadhi, other sellers) for the same composition and form, one product at
 * a time (the Set the price dialog), for all products (the comparison page), or for a composition (the Check brand dialog). The market price of a composition
 * from the web is an AI request made on demand and kept for a month per composition and form.
 */
@Injectable()
export class PriceCompareService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly ai: AiProvider) {}

  // ------------------------------------------------------------------ the loaded lists

  private cache: { at: number; byKey: Map<string, RefItem[]>; lists: { id: number; name: string; kind: string; rows: number }[] } | null = null;

  /** every list item that has a composition and strength, by composition key (kept for a minute: the comparison page asks for many products at once) */
  private async refs() {
    if (this.cache && Date.now() - this.cache.at < 60_000) return this.cache;
    const rows = await this.manager.query(
      `select i.source_id, s.name as source_name, s.kind, i.name, i.unit_size, i.pack_qty::float8 as pack_qty, i.pack_kind, i.mrp::float8 as mrp, i.sell_price::float8 as sell_price,
              i.composition, i.composition_key, i.dosage_form as form
         from price_ref_item i join price_ref_source s on s.id = i.source_id where i.has_strength and i.composition_key is not null`);
    const lists = await this.manager.query(`select id, name, kind, row_count as rows from price_ref_source order by (kind = 'PMBI') desc, lower(name)`);
    const byKey = new Map<string, RefItem[]>();
    for (const r of rows) {
      const g = byKey.get(r.composition_key) || [];
      g.push({ sourceId: r.source_id, sourceName: r.source_name, kind: r.kind, name: r.name, unitSize: r.unit_size, packQty: r.pack_qty, packKind: r.pack_kind, mrp: r.mrp, sellPrice: r.sell_price, composition: r.composition, form: r.form });
      byKey.set(r.composition_key, g);
    }
    this.cache = { at: Date.now(), byKey, lists };
    return this.cache;
  }

  /** a composition's list prices, per list: no shop price to compare with (the Check brand dialog) */
  async forComposition(composition: string, form: string | null) {
    const key = compositionKey(composition);
    const { byKey, lists } = await this.refs();
    if (!key || !key.hasStrength) return { known: false, lists: lists.length, sources: [] as SourceSummary[] };
    return { known: true, lists: lists.length, sources: summarise(byKey.get(key.key) || [], form, null) };
  }

  // ------------------------------------------------------------------ one product

  private async productRow(productId: number) {
    const [p] = await this.manager.query(
      `select p.id, p.title, coalesce(p.pack, 1)::int as pack, p.more_props->>'composition' as composition, p.dosage_form as form,
              v.mrp::float8 as mrp, v.price::float8 as price, coalesce(v.sale_tax, 0)::float8 as sale_tax
         from product p left join price_view v on v.id = p.id where p.id = $1 and p.active and not p.archive`, [productId]);
    return p || null;
  }

  /** the product's own price and the lists' prices for its composition; `candidate` is a price before GST being considered (the Set the price dialog) */
  async forProduct(productId: number, candidate?: number | null) {
    const p = await this.productRow(productId);
    if (!p) throw new NotFoundException('Product not found.');
    const key = compositionKey(p.composition);
    const form = p.form || classifyForm(p.title);
    const pack = Math.max(Number(p.pack) || 1, 1);
    const mrp = Number(p.mrp) || 0;
    const now = customerPrice(p.price, p.sale_tax, mrp);
    const cand = candidate && candidate > 0 ? customerPrice(candidate, p.sale_tax, mrp) : null;
    const base: any = {
      known: !!(key && key.hasStrength), productid: p.id, title: p.title, composition: p.composition ? String(p.composition).trim() : null, form, formLabel: dosageFormLabel(form) || null, pack, mrp: mrp || null,
      price: now, unitMrp: mrp ? Math.round((mrp / pack) * 10000) / 10000 : null, unitPrice: now === null ? null : Math.round((now / pack) * 10000) / 10000,
      candidate: cand, candidateUnit: cand === null ? null : Math.round((cand / pack) * 10000) / 10000,
    };
    const { byKey, lists } = await this.refs();
    base.lists = lists.length;
    if (!key || !key.hasStrength) return { ...base, sources: [] };
    const items = byKey.get(key.key) || [];
    const shown = base.candidateUnit ?? base.unitPrice;
    const sources = summarise(items, form, shown);
    return { ...base, sources, gap: worstGap(sources), details: items.filter((i) => sources.some((s) => s.sourceId === i.sourceId)).slice(0, 40) };
  }

  // ------------------------------------------------------------------ every product

  /**
   * What is on the shelf per product: the batches of the store (or of every store when none is given) in date for at least 30 days, as the till counts them
   * (bought, less sold, plus approved adjustments, less approved disposals).
   */
  private async stockOf(storeId: number | null): Promise<Map<number, number>> {
    const s = storeId ? 'and s.store_id = $1' : '';
    const q = storeId ? 'and pq.store_id = $1' : '';
    const d = storeId ? 'and dp.store_id = $1' : '';
    const bought = storeId ? '(case when i.store_id = $1 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)' : '((pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1))';
    const rows = await this.manager.query(
      `select x.product_id, sum(x.available)::int as available from (
         select pii.product_id,
                (${bought}
                 - coalesce((select sum(si.qty) from sale_item si join sale s on s.id = si.sale_id where si.purchase_item_id = pii.id and si.active = true and si.archive = false ${s}), 0)
                 + coalesce((select sum(pq.qty) from product_qtychange pq where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active = true and pq.archive = false ${q}), 0)
                 - coalesce((select sum(l.qty) from disposal_pass_line l join disposal_pass dp on dp.id = l.pass_id where l.item_id = pii.id and dp.status = 'APPROVED' ${d}), 0))::int as available
           from purchase_invoice_item pii join purchase_invoice i on i.id = pii.invoice_id join product p on p.id = pii.product_id
          where pii.status = 'VERIFIED' and pii.active = true and pii.archive = false and p.active = true and p.archive = false
            and (pii.exp_date is null or public.expiry_end(pii.exp_date) >= current_date + 30)) x
        where x.available > 0 group by x.product_id`, storeId ? [storeId] : []);
    return new Map(rows.map((r: any) => [Number(r.product_id), Number(r.available)]));
  }

  /**
   * The comparison page: each product that has a composition, its price and the lists' prices; `inStock` keeps what is on the shelf now (at the store, when
   * one is given), `source` compares with that list only, `onlyMatched` keeps those with at least one comparable list price.
   */
  async list(opts: { q?: string; source?: number | null; onlyMatched?: boolean; minGap?: number | null; inStock?: boolean; storeId?: number | null }) {
    const rows = await this.manager.query(
      `select p.id, p.title, coalesce(p.pack, 1)::int as pack, p.more_props->>'composition' as composition, p.dosage_form as form,
              v.mrp::float8 as mrp, v.price::float8 as price, coalesce(v.sale_tax, 0)::float8 as sale_tax
         from product p join price_view v on v.id = p.id where p.active and not p.archive and v.active`);
    const { byKey, lists } = await this.refs();
    const stock = opts.inStock ? await this.stockOf(opts.storeId ?? null) : null;
    const onShelf = stock ?? (await this.stockOf(opts.storeId ?? null));
    const q = String(opts.q || '').trim().toLowerCase();
    const out: any[] = [];
    let noComposition = 0;
    for (const p of rows) {
      if (q && !String(p.title).toLowerCase().includes(q)) continue;
      if (stock && !stock.has(Number(p.id))) continue;
      const key = compositionKey(p.composition);
      if (!key || !key.hasStrength) { noComposition++; continue; }
      const pack = Math.max(Number(p.pack) || 1, 1), mrp = Number(p.mrp) || 0;
      const price = customerPrice(p.price, p.sale_tax, mrp);
      const unitPrice = price === null ? null : price / pack;
      const form = p.form || classifyForm(p.title);
      let sources = summarise(byKey.get(key.key) || [], form, unitPrice);
      if (opts.source) sources = sources.filter((s) => s.sourceId === opts.source);
      const gap = worstGap(sources);
      if (opts.onlyMatched && !sources.some((s) => s.unitSell || s.unitMrp)) continue;
      if (opts.minGap !== null && opts.minGap !== undefined && (gap === null || gap < opts.minGap)) continue;
      out.push({ productid: p.id, title: p.title, composition: String(p.composition).trim(), form, pack, available: onShelf.get(Number(p.id)) ?? 0, mrp: mrp || null, price, unitPrice: unitPrice === null ? null : Math.round(unitPrice * 100) / 100, sources, gap });
    }
    out.sort((a, b) => (b.gap ?? -1e9) - (a.gap ?? -1e9) || String(a.title).localeCompare(String(b.title)));
    return { lists, products: out.slice(0, 1500), total: out.length, noComposition };
  }

  // ------------------------------------------------------------------ the market price from the web (AI, on demand, kept a month)

  /** the composition and form a product, a brand or the typed text stands for */
  private async subject(b: { productid?: any; composition?: any; form?: any }) {
    let composition = String(b?.composition || '').trim();
    let form: string | null = classifyForm(b?.form) ?? (b?.form ? String(b.form) : null);
    if (Number(b?.productid) > 0) {
      const p = await this.productRow(Number(b.productid));
      if (!p) throw new NotFoundException('Product not found.');
      composition = String(p.composition || '').trim();
      form = p.form || classifyForm(p.title);
    }
    const key = compositionKey(composition);
    if (!key || !key.hasStrength) throw new BadRequestException('This needs a composition with a strength (for example "Telmisartan 40 mg"). Add it to the product first.');
    return { composition, form, lookupKey: `${key.key}|${form || ''}`.slice(0, 400) };
  }

  private view(row: any, cached: boolean) {
    return { ...(row.answer as MarketAnswer), asOf: row.looked_up_on, model: row.model, cached, fresh: isFresh(row.looked_up_on) };
  }

  /** what was kept for the composition (free), and whether the assistant is on */
  async marketKept(b: { productid?: any; composition?: any; form?: any }) {
    const s = await this.subject(b);
    const [row] = await this.manager.query(`select answer, model, looked_up_on from market_price_lookup where lookup_key = $1`, [s.lookupKey]);
    return { available: this.ai.configured, composition: s.composition, kept: row ? this.view(row, true) : null };
  }

  /** looks the composition up on the web (or returns what was kept while it is under a month old, unless a new look is asked for) */
  async marketLookup(b: { productid?: any; composition?: any; form?: any; refresh?: boolean }, user: any) {
    const s = await this.subject(b);
    const [row] = await this.manager.query(`select answer, model, looked_up_on from market_price_lookup where lookup_key = $1`, [s.lookupKey]);
    if (row && !b.refresh && isFresh(row.looked_up_on)) return this.view(row, true);
    if (!this.ai.configured) throw new ServiceUnavailableException('The online lookup needs the assistant, which the Business Head switches on under Settings > AI assistant.');
    const model = await resolveModel(this.manager, this.ai, MARKET_TASK);
    if (!model) throw new BadRequestException('Choose a model for the assistant under Settings > AI assistant first.');
    const web = await this.ai.askWeb(MARKET_SYSTEM, marketInstruction(s.composition, dosageFormLabel(s.form) || null), model, MARKET_TASK);
    const answer = parseMarketAnswer(web.text, web.sources, s.composition, s.form);
    // only an answer that passed the checks replaces a kept one: a failed look must not wipe a good earlier answer
    if (!answer.found && row?.answer?.found) return { ...this.view(row, true), retryNote: answer.note };
    const [saved] = await this.manager.query(
      `insert into market_price_lookup (lookup_key, composition, form, found, answer, model, looked_up_by) values ($1, $2, $3, $4, $5::jsonb, $6, $7)
       on conflict (lookup_key) do update set composition = excluded.composition, form = excluded.form, found = excluded.found, answer = excluded.answer, model = excluded.model,
         looked_up_on = now(), looked_up_by = excluded.looked_up_by returning answer, model, looked_up_on`,
      [s.lookupKey, s.composition.slice(0, 400), s.form, answer.found, JSON.stringify(answer), model, user?.id ?? null]);
    return this.view(saved, false);
  }
}
