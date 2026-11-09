import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { CompositionKey, compositionKey, needsPrescription } from './composition-match';
import { formRelation } from '../dictionary/dosage-form';

/** a pair has to have been bought together on at least this many bills before it is worth saying */
const MIN_TOGETHER = 2;
/** how far back "bought together" looks */
const LOOKBACK_DAYS = 180;
/** a same-composition alternative is offered only when it earns this many percentage points more margin */
const MIN_MARGIN_GAIN = 3;
/** never sell a batch this close to its expiry as a suggestion */
const MIN_SHELF_DAYS = 30;
const KINDS = ['CROSS_SELL', 'SAME_COMPOSITION', 'BULK_SUPPLY'];
const ACTIONS = ['SHOWN', 'ADDED', 'DISMISSED'];

/**
 * What to say to the customer at the counter. Cross-sell: what customers who bought these also bought, if the store has it.
 * Up-sell: the same composition with a better margin, and a longer supply for a chronic medicine. Restricted (H1) drugs are
 * never suggested. Every suggestion that is shown, taken or dismissed can be logged to measure how well it works.
 */
@Injectable()
export class SaleSuggestionService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  /** the batch of each product to sell first at the store: in date for long enough, with stock left */
  private async liveBatches(productIds: number[], storeId: number | null, withRestricted = false) {
    if (!productIds.length) return [];
    return this.manager.query(
      `select * from (
         select distinct on (pii.product_id) pii.product_id, pii.id as item_id, pii.batch, to_char(pii.exp_date, 'YYYY-MM-DD') as exp_date, p.title, p.mfr, p.more_props,
                coalesce(pii.sale_price, pii.mrp_cost)::float as price, pii.mrp_cost::float as mrp, pii.ptr_cost::float as ptr_cost, coalesce(p.pack, 1) as pack,
                ((case when i.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
                 - coalesce((select sum(si.qty) from sale_item si inner join sale s on s.id = si.sale_id
                              where si.purchase_item_id = pii.id and si.active = true and si.archive = false and s.store_id = $2), 0)
                 + coalesce((select sum(pq.qty) from product_qtychange pq
                              where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active = true and pq.archive = false and pq.store_id = $2), 0))::int as available
           from purchase_invoice_item pii join purchase_invoice i on i.id = pii.invoice_id join product p on p.id = pii.product_id
          where pii.product_id = any($1::int[]) and pii.status = 'VERIFIED' and pii.active = true and pii.archive = false and p.active = true and p.archive = false
            and (pii.exp_date is null or public.expiry_end(pii.exp_date) >= current_date + ${MIN_SHELF_DAYS})
          order by pii.product_id, pii.exp_date nulls last, pii.id) x
       where x.available > 0 ${withRestricted ? '' : "and coalesce(x.more_props->>'schedule', '') <> 'H1'"}`, [productIds, storeId]);
  }

  /** every product's cleaned composition and dosage form, kept for a minute so a lookup at the counter does not rescan the catalogue */
  private compCache: { at: number; rows: { id: number; title: string; comp: string; key: string; salts: string; hasStrength: boolean; form: string | null }[] } | null = null;

  private async compositions() {
    if (this.compCache && Date.now() - this.compCache.at < 60_000) return this.compCache.rows;
    const rows = await this.manager.query(`select id, title, more_props->>'composition' as comp, dosage_form as form from product where active and not archive and nullif(btrim(more_props->>'composition'), '') is not null`);
    const out: { id: number; title: string; comp: string; key: string; salts: string; hasStrength: boolean; form: string | null }[] = [];
    for (const r of rows) {
      const k = compositionKey(r.comp);
      if (k) out.push({ id: Number(r.id), title: r.title, comp: String(r.comp).trim(), form: r.form || null, ...k });
    }
    this.compCache = { at: Date.now(), rows: out };
    return out;
  }

  /**
   * What the shop has for a composition: the same composition and strength in the same dosage form (or a form not recorded, said so), the same ingredients in
   * other strengths, and the same composition in another known form (a sustained-release tablet is not a plain tablet) kept apart. `askedProductId` is the
   * product the customer asked for, when it is one of ours: it is left out of the lists and gives the price to compare against.
   */
  async matches(mk: CompositionKey, askedForm: string | null, storeId: number | null, askedProductId: number | null) {
    const all = await this.compositions();
    const rel = (c: { form: string | null }) => formRelation(askedForm, c.form);
    const keyed = all.filter((c) => c.id !== askedProductId && c.key === mk.key);
    const sameIds = keyed.filter((c) => rel(c) !== 'different').map((c) => c.id);
    const formIds = keyed.filter((c) => rel(c) === 'different').map((c) => c.id);
    const otherIds = all.filter((c) => c.id !== askedProductId && c.key !== mk.key && c.salts === mk.salts && c.hasStrength).map((c) => c.id);
    const live = await this.liveBatches([...(askedProductId ? [askedProductId] : []), ...sameIds, ...formIds, ...otherIds], storeId, true);
    const liveBy = new Map<number, any>(live.map((l: any) => [Number(l.product_id), l]));
    const mine = askedProductId ? liveBy.get(askedProductId) : undefined;
    const formOf = new Map<number, string | null>(all.map((c) => [c.id, c.form]));
    const unit = (l: any) => (l.pack > 0 ? l.price / l.pack : l.price);
    const detail = (l: any) => ({
      productid: Number(l.product_id), title: l.title, composition: String(l.more_props?.composition || '').trim(), mfr: (l.mfr || '').trim() || null,
      generic: l.more_props?.generic === true || l.more_props?.generic === 'true',
      schedule: l.more_props?.schedule || null, prescription: needsPrescription(l.more_props?.schedule),
      form: formOf.get(Number(l.product_id)) ?? null, formRelation: rel({ form: formOf.get(Number(l.product_id)) ?? null }),
      batch: l.batch, exp_date: l.exp_date, mrp: l.mrp, price: l.price, pack: l.pack, available: l.available,
      cheaperPct: mine && unit(mine) > 0 ? Math.round(((unit(mine) - unit(l)) / unit(mine)) * 1000) / 10 : null,
    });
    const byPrice = (x: any, y: any) => (x.cheaperPct === null || y.cheaperPct === null ? 0 : y.cheaperPct - x.cheaperPct);
    const same = sameIds.filter((id) => liveBy.has(id)).map((id) => detail(liveBy.get(id))).sort(byPrice);
    const otherForms = formIds.filter((id) => liveBy.has(id)).map((id) => detail(liveBy.get(id))).sort(byPrice);
    const otherStrengths = otherIds.filter((id) => liveBy.has(id)).map((id) => detail(liveBy.get(id))).sort((x: any, y: any) => x.composition.localeCompare(y.composition));
    // the same medicine the shop knows but does not have now: the starting point for asking a vendor
    const notStocked = all.filter((c) => c.key === mk.key && rel(c) !== 'different' && (c.id === askedProductId ? !mine : !liveBy.has(c.id))).slice(0, 8).map((c) => ({ productid: c.id, title: c.title }));
    return { mine, same, otherForms, otherStrengths, notStocked };
  }

  async alternatives(productId: number, storeId: number | null) {
    const [asked] = await this.manager.query(`select id, title, mfr, more_props, dosage_form from product where id = $1 and active and not archive`, [productId]);
    if (!asked) throw new BadRequestException('Product not found.');
    const mk = compositionKey(asked.more_props?.composition);
    const base = { asked: { id: Number(asked.id), title: asked.title, composition: asked.more_props?.composition?.trim() || null, schedule: asked.more_props?.schedule || null, form: asked.dosage_form || null } };
    if (!mk) return { ...base, status: 'NO_COMPOSITION', same: [], otherStrengths: [], otherForms: [], notStocked: [] };
    if (!mk.hasStrength) return { ...base, status: 'NO_STRENGTH', same: [], otherStrengths: [], otherForms: [], notStocked: [] };
    const m = await this.matches(mk, asked.dosage_form || null, storeId, productId);
    return { ...base, status: 'OK', askedInStock: !!m.mine, askedAvailable: m.mine?.available ?? 0, same: m.same, otherStrengths: m.otherStrengths, otherForms: m.otherForms, notStocked: m.notStocked };
  }

  private marginPct(price: number, cost: number, pack: number) {
    const unitCost = cost / Math.max(pack, 1);
    return price > 0 ? Math.round(((price - unitCost) / price) * 1000) / 10 : 0;
  }

  async suggest(b: any) {
    const storeId = Number(b?.storeid) || null;
    const cart: { productid: number; supplymonths: number | null }[] = (Array.isArray(b?.items) ? b.items : [])
      .map((i: any) => ({ productid: Number(i.productid ?? i.product_id), supplymonths: Number(i.supplymonths) > 0 ? Number(i.supplymonths) : null }))
      .filter((i: any) => Number.isFinite(i.productid) && i.productid > 0);
    if (!cart.length) return { crossSell: [], upsell: [] };
    const anchors = Array.from(new Set(cart.map(i => i.productid)));

    // ---- cross-sell: bought together on completed bills in the last months
    const together = await this.manager.query(
      `select si.product_id, count(distinct si.sale_id)::int as together
         from sale_item si
         join (select distinct si2.sale_id from sale_item si2 join sale s on s.id = si2.sale_id
                where si2.product_id = any($1::int[]) and s.status = 'COMPLETE' and s.active = true and s.bill_date >= now() - interval '${LOOKBACK_DAYS} days') b on b.sale_id = si.sale_id
        where si.product_id <> all($1::int[]) and si.active = true and si.archive = false
        group by si.product_id having count(distinct si.sale_id) >= ${MIN_TOGETHER}
        order by count(distinct si.sale_id) desc limit 20`, [anchors]);
    const candidateIds = together.map((t: any) => t.product_id);

    // ---- up-sell: the same composition earning more
    const anchorInfo = await this.manager.query(`select id, title, lower(btrim(more_props->>'composition')) as comp, (more_props->>'chronic') = 'true' as chronic from product where id = any($1::int[])`, [anchors]);
    const anchorBatches = await this.liveBatches(anchors, storeId);
    const comps = Array.from(new Set(anchorInfo.map((a: any) => a.comp).filter(Boolean)));
    const altProducts = comps.length ? await this.manager.query(
      `select id, lower(btrim(more_props->>'composition')) as comp from product where active and not archive and id <> all($1::int[]) and lower(btrim(more_props->>'composition')) = any($2::text[])`, [anchors, comps]) : [];

    const live = await this.liveBatches(Array.from(new Set([...candidateIds, ...altProducts.map((a: any) => a.id)])), storeId);
    const liveBy = new Map<number, any>(live.map((l: any) => [Number(l.product_id), l]));

    const crossSell = together
      .map((t: any) => ({ t, l: liveBy.get(Number(t.product_id)) }))
      .filter((x: any) => x.l)
      .slice(0, 6)
      .map((x: any) => ({ kind: 'CROSS_SELL', productid: x.l.product_id, title: x.l.title, together: x.t.together, price: x.l.price, mrp: x.l.mrp, available: x.l.available, batch: x.l.batch }));

    const upsell: any[] = [];
    for (const a of anchorInfo) {
      const mine = anchorBatches.find((l: any) => Number(l.product_id) === Number(a.id));
      if (a.comp && mine) {
        const myMargin = this.marginPct(mine.price, mine.ptr_cost, mine.pack);
        const best = altProducts
          .filter((p: any) => p.comp === a.comp && liveBy.has(Number(p.id)))
          .map((p: any) => liveBy.get(Number(p.id)))
          .map((l: any) => ({ l, margin: this.marginPct(l.price, l.ptr_cost, l.pack) }))
          .filter((x: any) => x.margin >= myMargin + MIN_MARGIN_GAIN)
          .sort((x: any, y: any) => y.margin - x.margin)[0];
        if (best) {
          upsell.push({ kind: 'SAME_COMPOSITION', anchorproductid: a.id, anchortitle: a.title, productid: best.l.product_id, title: best.l.title, price: best.l.price, mrp: best.l.mrp,
            available: best.l.available, batch: best.l.batch, marginGain: Math.round((best.margin - myMargin) * 10) / 10 });
        }
      }
      const line = cart.find(i => i.productid === Number(a.id));
      if (a.chronic && (!line?.supplymonths || line.supplymonths < 3)) {
        upsell.push({ kind: 'BULK_SUPPLY', anchorproductid: a.id, anchortitle: a.title, months: 3 });
      }
    }
    return { crossSell, upsell };
  }

  /** shown / added / dismissed, so acceptance can be measured */
  async log(events: any[], storeId: number | null, userId: number) {
    const rows = (Array.isArray(events) ? events : []).slice(0, 30);
    let n = 0;
    for (const e of rows) {
      if (!KINDS.includes(e?.kind) || !ACTIONS.includes(e?.action)) throw new BadRequestException('A suggestion event needs a valid kind and action.');
      await this.manager.query(
        `insert into sale_suggestion_event (store_id, user_id, kind, action, anchor_product_id, suggested_product_id, detail) values ($1,$2,$3,$4,$5,$6,$7)`,
        [storeId, userId, e.kind, e.action, Number(e.anchor_product_id) || null, Number(e.suggested_product_id) || null, e.detail ? String(e.detail).slice(0, 120) : null]);
      n++;
    }
    return { logged: n };
  }
}
