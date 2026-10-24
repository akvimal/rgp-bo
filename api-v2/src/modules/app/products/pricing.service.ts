import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isOwnerRole } from 'src/core/roles';
import { LineIn, PricingItem, PricingReader, today } from './pricing-reader';
import { cleanRuleValue, ruleOf, RULES } from './pricing-rules';
import {
  Abc, checkChange, classKey, ClassPolicy, DEFAULT_SETTINGS, evaluate, Evaluation, Level, PolicySettings, rank, Subject, tradeBand, Violation, VIOLATION_TEXT,
} from './price-policy';

export { PricingItem };

@Injectable()
export class PricingService extends PricingReader {
  constructor(@InjectEntityManager() manager: EntityManager, private readonly audit: AuditService) { super(manager); }

  /** What an actor may approve: Business Head / Owner-operator everything, Store Head the lower level, anyone else nothing. */
  async actorLevel(userid: number): Promise<Level | null> {
    const [r] = await this.manager.query(`select r.name as role from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [userid]);
    if (isOwnerRole(r?.role)) return 'BUSINESS';
    if (r?.role === 'Store Head') return 'STORE';
    return null;
  }

  /**
   * Profit and stock turn by class. GMROI = gross profit of the last 12 months / stock at cost now (stock = batches bought less what was sold
   * and adjusted, at the net cost of each batch; a negative balance counts as none). It says how many rupees of profit each rupee of stock earned.
   */
  async performance() {
    const [items, stock] = await Promise.all([
      this.items(null),
      this.manager.query(
        `with sold as (select purchase_item_id, sum(qty) as q from sale_item where status = 'Complete' and active and not archive group by 1),
              adj as (select item_id, sum(qty) as q from product_qtychange where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1)
         select pii.product_id,
                sum(greatest(((pii.qty + coalesce(pii.free_qty, 0)) * p.pack) - coalesce(s.q, 0) + coalesce(a.q, 0), 0)
                    * (pii.ptr_value::numeric * (1 - coalesce(pii.disc_pcnt, 0)::numeric / 100) * pii.qty / nullif(pii.qty + coalesce(pii.free_qty, 0), 0) / nullif(p.pack, 0)))::float8 as value
           from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
           join product p on p.id = pii.product_id and p.pack > 0
           left join sold s on s.purchase_item_id = pii.id left join adj a on a.item_id = pii.id
          where pii.active and not pii.archive and pii.ptr_value > 0 group by pii.product_id`),
    ]);
    const value = new Map<number, number>(stock.map((r: any) => [+r.product_id, Number(r.value || 0)]));
    const by = new Map<string, { key: string; products: number; revenue: number; gp: number; stock: number }>();
    const total = { key: 'ALL', products: 0, revenue: 0, gp: 0, stock: 0 };
    for (const i of items) {
      const row = by.get(i.classkey) ?? { key: i.classkey, products: 0, revenue: 0, gp: 0, stock: 0 };
      for (const t of [row, total]) { t.products += 1; t.revenue += i.rev12; t.gp += i.gp12; t.stock += value.get(i.productid) ?? 0; }
      by.set(i.classkey, row);
    }
    const out = (r: any) => ({
      ...r, revenue: Math.round(r.revenue), gp: Math.round(r.gp), stock: Math.round(r.stock),
      gmpct: r.revenue > 0 ? Math.round((r.gp / r.revenue) * 1000) / 10 : null,
      gmroi: r.stock > 0 ? Math.round((r.gp / r.stock) * 100) / 100 : null,
    });
    return { classes: [...by.values()].sort((a, b) => a.key.localeCompare(b.key)).map(out), total: out(total) };
  }

  /**
   * What recent price changes did to volume: for each change of half a percent or more that is at least 28 days old, the units sold in the
   * 28 days before against the 28 days after. Seasons, stock-outs and promotions also move volume, so read the medians, not one product.
   */
  async impact() {
    const rows = await this.manager.query(
      `with c as (select id, product_id, eff_date, sale_price::numeric as price, reason,
                         lag(sale_price::numeric) over (partition by product_id order by eff_date, id) as prev
                    from product_price2 where sale_price > 0),
            e as (select c.*, price / prev - 1 as chg from c
                   where prev > 0 and abs(price / prev - 1) >= 0.005 and eff_date between current_date - 150 and current_date - 28)
       select e.product_id, p.title, to_char(e.eff_date, 'YYYY-MM-DD') as eff_date, e.reason, round(e.prev, 2)::float8 as from_price, round(e.price, 2)::float8 as to_price,
              round(e.chg * 100, 1)::float8 as chg_pct,
              (select coalesce(sum(si.qty), 0) from sale_item si join sale s on s.id = si.sale_id where si.product_id = e.product_id and si.status = 'Complete'
                  and s.bill_date::date >= e.eff_date - 28 and s.bill_date::date < e.eff_date)::float8 as units_before,
              (select coalesce(sum(si.qty), 0) from sale_item si join sale s on s.id = si.sale_id where si.product_id = e.product_id and si.status = 'Complete'
                  and s.bill_date::date >= e.eff_date and s.bill_date::date < e.eff_date + 28)::float8 as units_after
         from e join product p on p.id = e.product_id order by e.eff_date desc limit 400`);
    const median = (xs: number[]) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return Math.round((a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) * 100) / 100; };
    const withVolume = rows.filter((r: any) => r.units_before >= 20);
    const group = (pred: (r: any) => boolean) => {
      const g = withVolume.filter(pred);
      return { events: g.length, medianratio: median(g.map((r: any) => r.units_after / r.units_before)) };
    };
    return {
      summary: {
        changes: rows.length, withvolume: withVolume.length,
        raises: group((r: any) => r.chg_pct > 0), cuts: group((r: any) => r.chg_pct < 0),
        bigraises: group((r: any) => r.chg_pct >= 10), bigcuts: group((r: any) => r.chg_pct <= -10),
        policysteps: group((r: any) => r.reason === 'Policy'),
      },
      events: rows.slice(0, 60).map((r: any) => ({ ...r, ratio: r.units_before >= 20 ? Math.round((r.units_after / r.units_before) * 100) / 100 : null })),
    };
  }

  /** Products out of policy now, with this step's price and whether the actor may apply it. */
  async queue(userid: number) {
    const [all, level, st, unpriced] = await Promise.all([this.items(null), this.actorLevel(userid), this.settings(), this.unpriced()]);
    const open = all.filter((i) => (i.action === 'CUT' || i.action === 'RAISE') && !i.exception);
    const check = all.filter((i) => (i.action === 'CHECK_COST' || i.packsuspect) && !i.exception);
    const decorate = (i: PricingItem) => ({ ...i, canapply: !i.waituntil && rank(level) >= rank(i.level) });
    const summary = {
      cuts: open.filter((i) => i.action === 'CUT').length,
      raises: open.filter((i) => i.action === 'RAISE').length,
      waiting: open.filter((i) => i.waituntil).length,
      check: check.length,
      excepted: all.filter((i) => i.exception).length,
      products: all.length,
      unpriced: unpriced.filter((u) => u.suggestion).length,
      unpricedcheck: unpriced.filter((u) => !u.suggestion).length,
    };
    const by = new Map<string, number>();
    for (const i of all) by.set(i.classkey, (by.get(i.classkey) ?? 0) + 1);
    const classes = [...by.entries()].map(([key, n]) => ({ key, products: n })).sort((a, b) => a.key.localeCompare(b.key));
    return { level, settings: st, summary, classes, items: open.map(decorate), check, unpriced: unpriced.map((u) => ({ ...u, canapply: !!u.suggestion && rank(level) >= rank('STORE') })) };
  }

  /**
   * Every price change goes through this. A change that breaks the policy needs an approver: the right role and a reason. Without
   * cost information (the product was never purchased) there is nothing to check against.
   */
  async assertChange(productid: number, newPrice: number, userid: number, overrideReason?: string): Promise<{ overridden: Violation[] }> {
    const [it] = await this.items(productid);
    if (!it || it.packsuspect || it.action === 'CHECK_COST') return { overridden: [] };
    const [policies, st] = await Promise.all([this.policyMap(), this.settings()]);
    const policy = policies.get(it.classkey);
    if (!policy) return { overridden: [] };
    const subject: Subject = { price: it.price, cost: it.cost, mrp: it.mrp, tax: it.tax, abc: it.abc, lastChange: it.lastchange, today: today() };
    const verdict = checkChange(subject, policy, st, newPrice);
    if (!verdict.violations.length) return { overridden: [] };

    const why = verdict.violations.map((v) => VIOLATION_TEXT[v]).join('; ');
    const level = await this.actorLevel(userid);
    if (rank(level) < rank(verdict.level)) {
      throw new ForbiddenException(`This price breaks the pricing policy (${why}). It needs a ${verdict.level === 'BUSINESS' ? 'Business Head' : 'Store Head or Business Head'} to set it.`);
    }
    if (!overrideReason || overrideReason.trim().length < 5) {
      throw new BadRequestException(`This price breaks the pricing policy (${why}). To set it anyway, give a reason (overridereason).`);
    }
    await this.audit.record({
      userId: userid, action: 'price.policy_override', entityType: 'product', entityId: productid,
      summary: `${it.title}: price ${it.price ?? '-'} -> ${newPrice} breaks policy (${why})`,
      details: { violations: verdict.violations, reason: overrideReason.trim(), class: it.classkey, changePct: verdict.changePct },
    });
    return { overridden: verdict.violations };
  }

  /** The system's own next step for one product, if the actor may apply it now. */
  async prepareStep(productid: number, userid: number) {
    const [it] = await this.items(productid);
    if (!it) throw new NotFoundException('That product has no current price or purchase to check.');
    if (it.exception) throw new BadRequestException(`An exception is recorded for this product until ${it.exception.until}.`);
    if (it.action !== 'CUT' && it.action !== 'RAISE') throw new BadRequestException('This price is within policy: nothing to apply.');
    if (it.waituntil) throw new BadRequestException(`The price was changed recently: the next raise is held until ${it.waituntil}.`);
    const level = await this.actorLevel(userid);
    if (rank(level) < rank(it.level)) {
      throw new ForbiddenException(`A ${it.level === 'BUSINESS' ? 'Business Head' : 'Store Head or Business Head'} must apply this step.`);
    }
    return it;
  }

  async audited(userid: number, action: string, productid: number, summary: string, details: any) {
    await this.audit.record({ userId: userid, action, entityType: 'product', entityId: productid, summary, details });
  }

  /**
   * A product with stock and no price gets the policy's suggested first price. Anyone who may set prices and is a Store Head or above may
   * apply it; the price is inside the class limits by construction, so it needs no further approval.
   */
  async prepareNew(productid: number, userid: number) {
    const level = await this.actorLevel(userid);
    if (rank(level) < rank('STORE')) throw new ForbiddenException('A Store Head or Business Head must set the first price.');
    const [u] = await this.unpriced(productid);
    if (!u) throw new BadRequestException('This product already has a price, or has no stock.');
    if (u.packsuspect) throw new BadRequestException('The pack size of this product looks wrong: check it under Pack check before pricing it.');
    if (!u.suggestion) throw new BadRequestException('The cost of this product is above what its MRP allows: check the cost and the pack size first.');
    return u;
  }

  /** What each line of a purchase invoice means for the product's current price (the receiving screen's "Sale price" column). */
  async invoiceImpact(invoiceid: number) {
    const rows = await this.manager.query(
      `select id, product_id, mrp_cost::float8 as mrp, ptr_value::float8 as ptrvalue, ptr_cost::float8 as ptrcost, coalesce(disc_pcnt, 0)::float8 as disc,
              qty, coalesce(free_qty, 0) as free, coalesce(tax_pcnt, 0)::float8 as taxbatch
         from purchase_invoice_item where invoice_id = $1 and active and not archive and mrp_cost > 0 and ptr_value > 0 order by id`, [invoiceid]);
    const lines: LineIn[] = rows.map((r: any) => ({ itemid: +r.id, productid: +r.product_id, mrp: r.mrp, ptrvalue: r.ptrvalue, ptrcost: r.ptrcost, disc: r.disc, qty: +r.qty, free: +r.free, taxbatch: r.taxbatch }));
    const lineImpacts = await this.lineImpacts(lines);
    return { lines: lineImpacts, needsprice: lineImpacts.filter((l) => l.status === 'NO_PRICE').length, attention: lineImpacts.filter((l) => !['OK', 'NO_PRICE'].includes(l.status)).length };
  }

  /** The pricing rules with their current values, for the Pricing rules page. */
  async rules() {
    const rows = await this.manager.query(
      `select setting_key, setting_value from app_setting where setting_key = any($1::text[]) and active and not archive`, [RULES.map((r) => r.key)]);
    const val = new Map<string, string>(rows.map((r: any) => [r.setting_key, r.setting_value]));
    return RULES.map((r) => ({ ...r, value: String(val.get(r.key) ?? r.default) }));
  }

  /** Saves the changed rules together or none: every value is checked first. */
  async updateRules(values: Record<string, any>, userid: number) {
    const entries = Object.entries(values || {});
    if (!entries.length) throw new BadRequestException('Nothing to save.');
    const clean: Record<string, string> = {};
    for (const [key, raw] of entries) {
      const def = ruleOf(key);
      if (!def) throw new BadRequestException(`Unknown rule: ${key}.`);
      const r = cleanRuleValue(def, raw);
      if (r.error) throw new BadRequestException(r.error);
      clean[key] = r.value!;
    }
    const before: Record<string, string> = Object.fromEntries((await this.rules()).map((r) => [r.key, r.value]));
    const after = { ...before, ...clean };
    if (Number(after.price_tolerance_pct) >= Number(after.price_approval_pct)) {
      throw new BadRequestException('The vendor rate rise that needs no reason must be smaller than the one that needs approval.');
    }
    const changed = Object.keys(clean).filter((k) => clean[k] !== before[k]);
    for (const key of changed) {
      const def = ruleOf(key)!;
      await this.manager.query(
        `insert into app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
         values ($1, $2, $3, $4, true, false, $5, $5)
         on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_by = $5, updated_on = now(), active = true, archive = false`,
        [def.category, key, clean[key], def.label, userid]);
    }
    if (changed.length) {
      await this.audited(userid, 'price.rules_changed', 0, `Pricing rules changed: ${changed.map((k) => `${k} ${before[k]} -> ${clean[k]}`).join(', ')}`,
        { before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, clean[k]])) });
    }
    return { changed, rules: await this.rules() };
  }

  async updatePolicy(classkey: string, floor: number, cap: number, userid: number, usual?: number) {
    if (!/^(LOW|MID|HIGH)_[ABC]$/.test(classkey)) throw new BadRequestException('Unknown class.');
    if (!(floor >= 0 && floor <= 1000)) throw new BadRequestException('The floor markup must be between 0 and 1000%.');
    if (!(cap >= 0 && cap <= 95)) throw new BadRequestException('The discount cap must be between 0 and 95%.');
    if (usual !== undefined && !(usual >= 0 && usual <= 95)) throw new BadRequestException('The usual discount must be between 0 and 95%.');
    if (usual !== undefined && usual > cap) throw new BadRequestException('The usual discount cannot be deeper than the discount cap.');
    const [before] = await this.manager.query(`select floor_markup_pct::float8 as f, max_discount_pct::float8 as c, usual_discount_pct::float8 as u from price_policy where class_key = $1`, [classkey]);
    if (!before) throw new NotFoundException('Unknown class.');
    await this.manager.query(
      `update price_policy set floor_markup_pct = $2, max_discount_pct = $3, usual_discount_pct = coalesce($5::numeric, usual_discount_pct), updated_by = $4, updated_on = now() where class_key = $1`, [classkey, floor, cap, userid, usual ?? null]);
    await this.audited(userid, 'price.policy_changed', 0, `Pricing policy ${classkey}: floor ${before.f}% -> ${floor}%, cap ${before.c}% -> ${cap}%${usual !== undefined ? `, usual discount ${before.u}% -> ${usual}%` : ''}`, { classkey, before, after: { floor, cap, usual } });
    return { classkey, floor, cap };
  }

  async addException(productid: number, reason: string, until: string, userid: number) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until || '') || until < today()) throw new BadRequestException('Give a date that is not in the past.');
    if (!reason || reason.trim().length < 5) throw new BadRequestException('Give a reason.');
    const [p] = await this.manager.query(`select title from product where id = $1`, [productid]);
    if (!p) throw new NotFoundException('That product does not exist.');
    // charging more than the MRP is an offence: no exception can keep such a price
    const [it] = await this.items(productid);
    if (it && it.violations.includes('OVER_MRP')) {
      throw new BadRequestException('This price would charge more than the MRP, which the law does not allow, so it cannot be accepted as an exception. Bring it down to the legal ceiling.');
    }
    const [row] = await this.manager.query(
      `insert into price_exception (product_id, reason, until_date, created_by) values ($1, $2, $3, $4) returning id`, [productid, reason.trim(), until, userid]);
    await this.audited(userid, 'price.exception', productid, `${p.title}: out-of-policy price accepted until ${until}`, { reason: reason.trim(), until });
    return { id: row.id };
  }

  async removeException(productid: number, userid: number) {
    await this.manager.query(`update price_exception set active = false where product_id = $1 and active`, [productid]);
    await this.audited(userid, 'price.exception_removed', productid, `Exception removed for product ${productid}`, {});
    return { ok: true };
  }
}
