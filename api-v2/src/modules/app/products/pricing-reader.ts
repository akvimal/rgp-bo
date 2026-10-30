import { EntityManager } from 'typeorm';
import { PRICING_SUBJECTS_SQL } from './pricing-subjects.sql';
import { PRICING_UNPRICED_SQL } from './pricing-unpriced.sql';
import { effectivePolicy, effectiveSteps, ModeSettings, readModeSettings } from './pricing-mode';
import { Abc, classKey, ClassPolicy, DEFAULT_SETTINGS, evaluate, Evaluation, Level, lineImpact, LineStatus, PolicySettings, Subject, Suggestion, suggestPrice, tradeBand, Violation } from './price-policy';

export interface PricingItem {
  productid: number; title: string; pack: number; classkey: string; abc: Abc;
  price: number | null; cost: number; mrp: number; tax: number; lastchange: string | null;
  action: Evaluation['action']; violations: Violation[]; markuppct: number | null; discountpct: number | null;
  target: number | null; next: number | null; waituntil: string | null; level: Level | null;
  packsuspect: boolean; exception: { reason: string; until: string } | null;
  gp12: number; rev12: number;
}

export const today = () => new Date().toISOString().slice(0, 10);

/**
 * The price policy at work: which prices are out of policy now (the review queue), what the next step is, who may apply it, and the
 * check every price change goes through. See price-policy.ts for the rules.
 */

export interface UnpricedItem {
  productid: number; title: string; pack: number; classkey: string; abc: Abc;
  cost: number; mrp: number; tax: number; units: number; packsuspect: boolean; suggestion: Suggestion | null;
}

export interface LineIn { itemid: number; productid: number; mrp: number; ptrvalue: number; ptrcost: number | null; disc: number; qty: number; free: number; taxbatch: number }
export interface LineOut {
  itemid: number; curprice: number | null; status: LineStatus; markuppct: number | null; discountpct: number | null;
  ceiling: number; lower: number; suggestion: Suggestion | null; classkey: string;
}

/**
 * The read side of the price policy: settings, class limits and the evaluated price of every product. It needs only the database, so the
 * alert engine can use it without the HTTP-side service (its audit and permission dependencies). PricingService extends it.
 */
export class PricingReader {
  constructor(protected readonly manager: EntityManager) {}

  private async pricingRows(): Promise<any[]> {
    return this.manager.query(`select setting_key, setting_value from app_setting where category = 'pricing' and active and not archive`);
  }

  /** how this business prices (at the MRP, a discount off it, or the class rules) and whether prices are shown with GST */
  async modeSettings(): Promise<ModeSettings> {
    return readModeSettings(await this.pricingRows());
  }

  /** the stepping and approval settings, as the current pricing mode applies them (under MRP a raise is not stepped) */
  async settings(): Promise<PolicySettings> {
    const rows = await this.pricingRows();
    const get = (k: string, d: number) => {
      const n = Number(rows.find((r: any) => r.setting_key === k)?.setting_value);
      return Number.isFinite(n) && n > 0 ? n : d;
    };
    return effectiveSteps(readModeSettings(rows), {
      stepPricePct: get('price_step_pct', DEFAULT_SETTINGS.stepPricePct),
      stepMrpPct: get('price_step_mrp_pct', DEFAULT_SETTINGS.stepMrpPct),
      stepDays: get('price_step_days', DEFAULT_SETTINGS.stepDays),
      storeHeadLimitPct: get('price_store_head_limit_pct', DEFAULT_SETTINGS.storeHeadLimitPct),
    });
  }

  async policyTable() {
    return this.manager.query(
      `select class_key, floor_markup_pct::float8 as floor_markup_pct, max_discount_pct::float8 as max_discount_pct, usual_discount_pct::float8 as usual_discount_pct from price_policy order by class_key`);
  }

  /** how many priced products sit in each class, so the limits screen can say which groups matter */
  async classCounts(): Promise<{ [classkey: string]: number }> {
    const counts: { [classkey: string]: number } = {};
    for (const i of await this.itemsCached()) counts[i.classkey] = (counts[i.classkey] || 0) + 1;
    return counts;
  }

  /** the limits of each class under the current pricing mode: the stored class rows only count under SMART */
  protected async policyMap(): Promise<Map<string, ClassPolicy>> {
    const [rows, ms] = await Promise.all([this.policyTable(), this.modeSettings()]);
    return new Map(rows.map((r: any) => [r.class_key, effectivePolicy(ms, { floorMarkupPct: Number(r.floor_markup_pct), maxDiscountPct: Number(r.max_discount_pct), usualDiscountPct: Number(r.usual_discount_pct) })]));
  }

  protected toItem(r: any, policies: Map<string, ClassPolicy>, st: PolicySettings, exception: any): PricingItem {
    const key = classKey(tradeBand(r.trade_margin), r.abc as Abc);
    const policy = policies.get(key) ?? { floorMarkupPct: 8, maxDiscountPct: 20 };
    const e = evaluate({ price: r.price, cost: r.cost, mrp: r.mrp, tax: r.tax, abc: r.abc, lastChange: r.last_change, today: today() }, policy, st);
    return {
      productid: +r.product_id, title: r.title, pack: +r.pack, classkey: key, abc: r.abc, price: r.price, cost: r.cost, mrp: r.mrp, tax: r.tax, lastchange: r.last_change,
      action: r.pack_suspect ? 'CHECK_COST' : e.action, violations: r.pack_suspect ? [] : e.violations, markuppct: e.markupPct, discountpct: e.discountPct,
      target: r.pack_suspect ? null : e.target, next: r.pack_suspect ? null : e.next, waituntil: e.waitUntil, level: e.level,
      packsuspect: !!r.pack_suspect, exception: !r.pack_suspect && e.action === 'CUT' ? null : exception, gp12: Number(r.gp12 || 0), rev12: Number(r.rev12 || 0),
    };
  }

  protected async items(productid: number | null): Promise<PricingItem[]> {
    const [rows, policies, st, exceptions] = await Promise.all([
      this.manager.query(PRICING_SUBJECTS_SQL, [productid]),
      this.policyMap(),
      this.settings(),
      this.manager.query(`select distinct on (product_id) product_id, reason, to_char(until_date, 'YYYY-MM-DD') as until
                            from price_exception where active and until_date >= current_date order by product_id, until_date desc`),
    ]);
    const ex = new Map<number, any>(exceptions.map((e: any) => [+e.product_id, { reason: e.reason, until: e.until }]));
    return rows.map((r: any) => this.toItem(r, policies, st, ex.get(+r.product_id) ?? null));
  }

  /** Products with stock and no price, each with the class and a suggested first price (none when the pack or cost looks wrong). */
  async unpriced(productid: number | null = null): Promise<UnpricedItem[]> {
    const [rows, policies, st] = await Promise.all([this.manager.query(PRICING_UNPRICED_SQL, [productid]), this.policyMap(), this.settings()]);
    const today0 = today();
    return rows.map((r: any) => {
      const key = classKey(tradeBand(r.trade_margin), r.abc as Abc);
      const policy = policies.get(key) ?? { floorMarkupPct: 8, maxDiscountPct: 20, usualDiscountPct: 5 };
      const suggestion = r.pack_suspect ? null : suggestPrice({ price: null, cost: r.cost, mrp: r.mrp, tax: r.tax, abc: r.abc, lastChange: null, today: today0 }, policy);
      void st;
      return { productid: +r.product_id, title: r.title, pack: +r.pack, classkey: key, abc: r.abc, cost: r.cost, mrp: r.mrp, tax: r.tax, units: Number(r.units), packsuspect: !!r.pack_suspect, suggestion };
    });
  }

  protected cache: { at: number; items: PricingItem[] } | null = null;

  /** every product's evaluated price, kept for a minute: a screen that asks for many lines should not repeat the 12-month profit sums */
  protected async itemsCached(): Promise<PricingItem[]> {
    if (this.cache && Date.now() - this.cache.at < 60_000) return this.cache.items;
    const items = await this.items(null);
    this.cache = { at: Date.now(), items };
    return items;
  }

  /**
   * What each purchase line's cost and MRP mean for the product's current sale price: no price yet, a price that would charge above this
   * batch's MRP, below the class floor markup, deeper than the discount cap, or fine. Nothing is saved.
   */
  async lineImpacts(lines: LineIn[]): Promise<LineOut[]> {
    if (!lines.length) return [];
    const c = await this.contextFor(lines);
    return lines.map((l) => {
      const k = this.subjectOf(l, c);
      const impact = lineImpact(k.subject, k.policy, c.st);
      return { itemid: l.itemid, curprice: k.subject.price, classkey: k.classkey, status: impact.status, markuppct: impact.markupPct, discountpct: impact.discountPct, ceiling: impact.ceiling, lower: impact.lower, suggestion: impact.suggestion };
    });
  }

  /** what is needed to judge purchase lines: current prices, class limits, the settings, each product's profit rank, and the GST billed */
  private async contextFor(lines: LineIn[]) {
    const ids = [...new Set(lines.map((l) => l.productid))];
    const pairs = [...new Map(lines.map((l) => [`${l.productid}|${l.taxbatch}`, l])).values()];
    const [prices, policies, st, all, gst] = await Promise.all([
      this.manager.query(
        `select distinct on (product_id) product_id, round(sale_price::numeric, 2)::float8 as price, to_char(eff_date, 'YYYY-MM-DD') as eff
           from product_price2 where end_date > current_date and sale_price > 0 and product_id = any($1::int[]) order by product_id, eff_date desc, id desc`, [ids]),
      this.policyMap(), this.settings(), this.itemsCached(),
      this.manager.query(`select x.pid, x.t::float8 as t, public.gst_sale_rate(x.pid, x.t)::float8 as s from unnest($1::int[], $2::double precision[]) as x(pid, t)`, [pairs.map((l) => l.productid), pairs.map((l) => l.taxbatch)]),
    ]);
    return {
      price: new Map<number, any>(prices.map((p: any) => [+p.product_id, p])),
      policies, st,
      abcOf: new Map<number, Abc>(all.map((i) => [i.productid, i.abc])),
      saleTax: new Map<string, number>(gst.map((g: any) => [`${g.pid}|${Number(g.t)}`, Number(g.s)])),
    };
  }

  private subjectOf(l: LineIn, c: { price: Map<number, any>; policies: Map<string, ClassPolicy>; st: PolicySettings; abcOf: Map<number, Abc>; saleTax: Map<string, number> }) {
    const paid = l.qty + l.free;
    const cost = paid > 0 ? (l.ptrvalue * (1 - l.disc / 100) * l.qty) / paid : l.ptrvalue;
    const incl = l.ptrcost && l.ptrcost > 0 ? l.ptrcost : l.ptrvalue * (1 + l.taxbatch / 100);
    const abc = c.abcOf.get(l.productid) ?? 'C';
    const classkey = classKey(tradeBand(l.mrp > 0 ? 1 - incl / l.mrp : null), abc);
    const policy = c.policies.get(classkey) ?? { floorMarkupPct: 8, maxDiscountPct: 20, usualDiscountPct: 5 };
    const p = c.price.get(l.productid);
    const saletax = c.saleTax.get(`${l.productid}|${l.taxbatch}`) ?? l.taxbatch;
    const subject: Subject = { price: p ? p.price : null, cost, mrp: l.mrp, tax: saletax, abc, lastChange: p ? p.eff : null, today: today() };
    return { subject, policy, classkey, abc, saletax };
  }

  /**
   * One product as the price policy sees it, from its latest completed purchase: its class and limits, current price and when it took effect.
   * Null when the product has never been purchased (there is no cost or MRP to judge a price against).
   */
  async productContext(productid: number) {
    const rows = await this.manager.query(
      `select pii.id, pii.product_id, pii.mrp_cost::float8 as mrp, pii.ptr_value::float8 as ptrvalue, pii.ptr_cost::float8 as ptrcost, coalesce(pii.disc_pcnt, 0)::float8 as disc,
              pii.qty, coalesce(pii.free_qty, 0) as free, coalesce(pii.tax_pcnt, 0)::float8 as taxbatch, p.title, p.pack
         from purchase_invoice_item pii
         join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
         join product p on p.id = pii.product_id
        where pii.product_id = $1 and pii.active and not pii.archive and pii.mrp_cost > 0 and pii.ptr_value > 0
        order by pi.invoice_date desc, pii.id desc limit 1`, [productid]);
    if (!rows.length) return null;
    const r = rows[0];
    const line: LineIn = { itemid: +r.id, productid: +r.product_id, mrp: r.mrp, ptrvalue: r.ptrvalue, ptrcost: r.ptrcost, disc: r.disc, qty: +r.qty, free: +r.free, taxbatch: r.taxbatch };
    const c = await this.contextFor([line]);
    return { ...this.subjectOf(line, c), st: c.st, title: r.title as string, pack: +r.pack };
  }

  /** How many prices are out of policy, for the alert (no actor): above the legal ceiling, below floor or over cap, held, and to check. */
  async counts() {
    const all = await this.items(null);
    const open = all.filter((i) => (i.action === 'CUT' || i.action === 'RAISE') && !i.exception);
    return {
      cuts: open.filter((i) => i.action === 'CUT').length,
      raises: open.filter((i) => i.action === 'RAISE').length,
      held: open.filter((i) => i.waituntil).length,
      check: all.filter((i) => (i.action === 'CHECK_COST' || i.packsuspect) && !i.exception).length,
      unpriced: (await this.unpriced()).filter((u) => u.suggestion).length,
    };
  }

}
