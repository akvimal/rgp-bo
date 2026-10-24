import { EntityManager } from 'typeorm';
import { PRICING_SUBJECTS_SQL } from './pricing-subjects.sql';
import { Abc, classKey, ClassPolicy, DEFAULT_SETTINGS, evaluate, Evaluation, Level, PolicySettings, tradeBand, Violation } from './price-policy';

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

/**
 * The read side of the price policy: settings, class limits and the evaluated price of every product. It needs only the database, so the
 * alert engine can use it without the HTTP-side service (its audit and permission dependencies). PricingService extends it.
 */
export class PricingReader {
  constructor(protected readonly manager: EntityManager) {}

  async settings(): Promise<PolicySettings> {
    const rows = await this.manager.query(
      `select setting_key, setting_value from app_setting where category = 'pricing' and active and not archive`);
    const get = (k: string, d: number) => {
      const n = Number(rows.find((r: any) => r.setting_key === k)?.setting_value);
      return Number.isFinite(n) && n > 0 ? n : d;
    };
    return {
      stepPricePct: get('price_step_pct', DEFAULT_SETTINGS.stepPricePct),
      stepMrpPct: get('price_step_mrp_pct', DEFAULT_SETTINGS.stepMrpPct),
      stepDays: get('price_step_days', DEFAULT_SETTINGS.stepDays),
      storeHeadLimitPct: get('price_store_head_limit_pct', DEFAULT_SETTINGS.storeHeadLimitPct),
    };
  }

  async policyTable() {
    return this.manager.query(
      `select class_key, floor_markup_pct::float8 as floor_markup_pct, max_discount_pct::float8 as max_discount_pct from price_policy order by class_key`);
  }

  protected async policyMap(): Promise<Map<string, ClassPolicy>> {
    const rows = await this.policyTable();
    return new Map(rows.map((r: any) => [r.class_key, { floorMarkupPct: Number(r.floor_markup_pct), maxDiscountPct: Number(r.max_discount_pct) }]));
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

  /** How many prices are out of policy, for the alert (no actor): above the legal ceiling, below floor or over cap, held, and to check. */
  async counts() {
    const all = await this.items(null);
    const open = all.filter((i) => (i.action === 'CUT' || i.action === 'RAISE') && !i.exception);
    return {
      cuts: open.filter((i) => i.action === 'CUT').length,
      raises: open.filter((i) => i.action === 'RAISE').length,
      held: open.filter((i) => i.waituntil).length,
      check: all.filter((i) => (i.action === 'CHECK_COST' || i.packsuspect) && !i.exception).length,
    };
  }

}
