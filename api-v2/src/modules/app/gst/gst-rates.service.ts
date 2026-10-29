import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { ProductFacts, RateChange, effectiveHsn, matches, parseChange, parseHsn, priceImpact, rateOn, winner } from './gst-rate';

const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const str = (v: any) => String(v ?? '').trim();

/**
 * GST rate changes and the HSN of products (GST_SIMPLE_PLAN phase 1). A change is dated; billing asks the database function gst_sale_rate().
 * Here: the list of changes, a preview of what a change does to stock and prices, the report after it, and the missing-HSN work.
 */
@Injectable()
export class GstRatesService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------ changes
  private async liveChanges(): Promise<RateChange[]> {
    const rows = await this.manager.query(
      `select id, scope_type, scope_value, mode, rate::float8 as rate, to_char(effective_from, 'YYYY-MM-DD') as effective_from, price_policy, note
         from gst_rate_change where cancelled_on is null`);
    return rows.map((r: any) => ({ ...r, id: +r.id, rate: Number(r.rate) }));
  }

  async list() {
    const rows = await this.manager.query(
      `select c.id, c.scope_type, c.scope_value, c.mode, c.rate::float8 as rate, to_char(c.effective_from, 'YYYY-MM-DD') as effective_from, c.price_policy, c.note,
              to_char(c.created_on, 'YYYY-MM-DD') as created_on, u.full_name as created_by_name, (c.cancelled_on is not null) as cancelled,
              to_char(c.cancelled_on, 'YYYY-MM-DD') as cancelled_on, c.effective_from > current_date as upcoming
         from gst_rate_change c left join app_user u on u.id = c.created_by order by c.effective_from desc, c.id desc`);
    const today = istDay();
    return {
      today,
      changes: rows.map((r: any) => ({
        ...r, id: +r.id, rate: Number(r.rate),
        label: this.label(r),
        state: r.cancelled ? 'cancelled' : r.effective_from > today ? 'upcoming' : 'in force',
      })),
    };
  }

  private label(c: any): string {
    const what = c.scope_type === 'all' ? 'All products' : c.scope_type === 'category' ? `Category ${c.scope_value}` : c.scope_type === 'hsn_prefix' ? `HSN ${c.scope_value}...` : `Product #${c.scope_value}`;
    return `${what}: ${c.mode === 'cap' ? 'at most' : 'GST'} ${Number(c.rate)}%`;
  }

  /** what the products look like for rate work: the latest batch's GST and MRP, stock, current list price, HSN */
  private async facts(): Promise<Array<ProductFacts & { title: string; pack: number; tax: number; mrp: number | null; stock: number; price: number | null }>> {
    const rows = await this.manager.query(
      `with latest as (
         select distinct on (pii.product_id) pii.product_id, coalesce(pii.tax_pcnt, 0)::float8 as tax, pii.mrp_cost::float8 as mrp
           from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
          where pii.active and not pii.archive and pi.active and not pi.archive and pii.mrp_cost > 0
          order by pii.product_id, pi.invoice_date desc, pii.id desc),
       stock as (select id as product_id, sum(balance)::float8 as bal from product_items_view where expired = false and balance > 0 group by id),
       price as (select distinct on (product_id) product_id, sale_price::float8 as price from product_price2
                  where end_date > current_date and sale_price > 0 order by product_id, eff_date desc, id desc)
       select p.id, p.title, p.category, nullif(btrim(p.hsn_code), '') as hsn, d.hsn as category_hsn, p.pack::float8 as pack,
              l.tax, l.mrp, coalesce(s.bal, 0) as stock, pr.price
         from product p join latest l on l.product_id = p.id
         left join stock s on s.product_id = p.id left join price pr on pr.product_id = p.id
         left join category_hsn_default d on lower(d.category) = lower(btrim(coalesce(p.category, '')))
        where p.active`);
    return rows.map((r: any) => ({
      id: +r.id, title: r.title, category: r.category, hsn: r.hsn, categoryHsn: r.category_hsn, pack: Number(r.pack) || 1,
      tax: Number(r.tax), mrp: r.mrp != null ? Number(r.mrp) : null, stock: Number(r.stock), price: r.price != null ? Number(r.price) : null,
    }));
  }

  /** What a change would do, before it is saved. Nothing is changed. */
  async preview(body: any) {
    const parsed = parseChange(body);
    if (parsed.error) throw new BadRequestException(parsed.error);
    const cand: RateChange = { ...parsed.value!, id: 1_000_000 };
    const existing = await this.liveChanges();
    const eff = cand.effective_from;
    const dayBefore = addDays(eff, -1);
    const products = await this.facts();
    const rows: any[] = [];
    const notCovered: any[] = [];
    let overridden = 0;
    for (const p of products) {
      const hsn = effectiveHsn(p);
      const covers = matches(cand, p);
      if (!covers) {
        if (cand.scope_type === 'hsn_prefix' && hsn.source === 'none') notCovered.push({ id: p.id, title: p.title, category: p.category, stock: p.stock });
        continue;
      }
      const w = winner([...existing, cand], p, eff);
      if (w && w.id !== cand.id) { overridden++; continue; }                 // a more specific change already decides this product
      const oldRate = rateOn(existing, p, p.tax, eff === istDay() ? eff : dayBefore);
      const newRate = rateOn([...existing, cand], p, p.tax, eff);
      if (Math.abs(oldRate - newRate) < 0.0001) continue;
      const impact = priceImpact(p.price, p.mrp, oldRate, newRate);
      rows.push({
        id: p.id, title: p.title, category: p.category, hsn: hsn.hsn, hsn_source: hsn.source, stock: p.stock, batch_tax: p.tax,
        old_rate: oldRate, new_rate: newRate, mrp: p.mrp, price: impact.price, customer_now: impact.now,
        pass_price: impact.pass?.price ?? null, pass_customer: impact.pass?.customer ?? null,
        keep_price: impact.keep?.price ?? null, keep_customer: impact.keep?.customer ?? null, keep_capped: impact.keep?.capped ?? false,
      });
    }
    rows.sort((a, b) => b.stock - a.stock || String(a.title).localeCompare(String(b.title)));
    notCovered.sort((a, b) => b.stock - a.stock);
    return {
      change: { ...parsed.value, label: this.label(parsed.value) },
      affected: rows.length, with_stock: rows.filter((r) => r.stock > 0).length, overridden,
      not_covered: notCovered.length, not_covered_sample: notCovered.slice(0, 25),
      rows: rows.slice(0, 300), truncated: rows.length > 300,
      policy_default: 'pass_saving',
    };
  }

  async create(user: any, body: any) {
    const parsed = parseChange(body);
    if (parsed.error) throw new BadRequestException(parsed.error);
    const c = parsed.value!;
    if (c.price_policy === 'keep_price' && body?.confirm_keep_price !== true) {
      throw new BadRequestException('Keeping the price means the shop keeps the saving of the tax cut. Confirm it to continue.');
    }
    if (c.scope_type === 'product') {
      const [p] = await this.manager.query(`select id from product where id = $1`, [+c.scope_value]);
      if (!p) throw new BadRequestException('That product was not found.');
    }
    const dup = await this.manager.query(
      `select 1 from gst_rate_change where cancelled_on is null and scope_type = $1 and scope_value = $2 and effective_from = $3`, [c.scope_type, c.scope_value, c.effective_from]);
    if (dup.length) throw new BadRequestException('A change for the same scope and date already exists. Cancel it first or choose another date.');
    const [row] = await this.manager.query(
      `insert into gst_rate_change (scope_type, scope_value, mode, rate, effective_from, price_policy, note, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [c.scope_type, c.scope_value, c.mode, c.rate, c.effective_from, c.price_policy, c.note, user.id]);
    await this.audit.record({
      userId: user.id, action: 'gst.rate_change_created', entityType: 'gst_rate_change', entityId: row.id,
      summary: `${this.label(c)} from ${c.effective_from}, ${c.price_policy === 'keep_price' ? 'keep the price' : 'pass the saving on'}`, details: { change: c },
    });
    return { id: +row.id };
  }

  /** a change that has not taken effect yet can be withdrawn; one in force is ended by a new change, never erased (bills were made under it) */
  async cancel(user: any, id: number) {
    const [c] = await this.manager.query(`select id, scope_type, scope_value, mode, rate, to_char(effective_from, 'YYYY-MM-DD') as effective_from, cancelled_on from gst_rate_change where id = $1`, [id]);
    if (!c) throw new NotFoundException('That change was not found.');
    if (c.cancelled_on) throw new BadRequestException('That change is already cancelled.');
    const eff = c.effective_from;
    if (eff <= istDay()) throw new BadRequestException('This change is already in force and bills were made under it. Add a new change to end it.');
    await this.manager.query(`update gst_rate_change set cancelled_on = now(), cancelled_by = $2 where id = $1`, [id, user.id]);
    await this.audit.record({ userId: user.id, action: 'gst.rate_change_cancelled', entityType: 'gst_rate_change', entityId: id, summary: `${this.label(c)} from ${eff} withdrawn`, details: { change: c } });
    return { ok: true };
  }

  /** After the date: the stock and the sales under a change, by the rate billed. */
  async report(id: number) {
    const [c] = await this.manager.query(
      `select id, scope_type, scope_value, mode, rate::float8 as rate, to_char(effective_from, 'YYYY-MM-DD') as effective_from, price_policy, note from gst_rate_change where id = $1`, [id]);
    if (!c) throw new NotFoundException('That change was not found.');
    const changes = await this.liveChanges();
    const products = await this.facts();
    const mine = products.filter((p) => winner(changes, p, c.effective_from < istDay() ? istDay() : c.effective_from)?.id === +c.id);
    const ids = mine.map((p) => p.id);
    const sold = ids.length ? await this.manager.query(
      `select si.product_id, coalesce(si.tax_pcnt, 0)::float8 as rate, sum(si.qty)::float8 as qty, sum(si.total)::float8 as value
         from sale_item si join sale s on s.id = si.sale_id
        where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive and si.sale_mode = 'SALE'
          and s.bill_date >= $1::date and si.product_id = any($2::int[])
        group by si.product_id, coalesce(si.tax_pcnt, 0)`, [c.effective_from, ids]) : [];
    const byProduct = new Map<number, any[]>();
    for (const r of sold) byProduct.set(+r.product_id, [...(byProduct.get(+r.product_id) || []), { rate: Number(r.rate), qty: Number(r.qty), value: Number(r.value) }]);
    const byRate = new Map<number, { qty: number; value: number }>();
    for (const r of sold) { const t = byRate.get(Number(r.rate)) || { qty: 0, value: 0 }; t.qty += Number(r.qty); t.value += Number(r.value); byRate.set(Number(r.rate), t); }
    return {
      change: { ...c, id: +c.id, label: this.label(c) },
      products: mine.length,
      rows: mine.map((p) => ({
        id: p.id, title: p.title, category: p.category, batch_tax: p.tax, billed_rate: rateOn(changes, p, p.tax, c.effective_from < istDay() ? istDay() : c.effective_from),
        stock: p.stock, sold: byProduct.get(p.id) || [],
      })).sort((a, b) => b.stock - a.stock).slice(0, 300),
      sales_by_rate: Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]).map(([rate, t]) => ({ rate, qty: t.qty, value: Math.round(t.value * 100) / 100 })),
    };
  }

  /** the changes starting within `days`, for the alert */
  async upcoming(days: number) {
    return this.manager.query(
      `select id, scope_type, scope_value, mode, rate::float8 as rate, to_char(effective_from, 'YYYY-MM-DD') as effective_from
         from gst_rate_change where cancelled_on is null and effective_from > current_date and effective_from <= current_date + $1::int order by effective_from`, [days]);
  }

  // ------------------------------------------------------------------ HSN
  /** products with no HSN of their own that are in stock or were sold lately, most sold first, with what we can offer */
  async missingHsn() {
    const rows = await this.manager.query(
      `with stock as (select id as product_id, sum(balance)::float8 as bal from product_items_view where balance > 0 group by id),
            sold as (select si.product_id, sum(si.total)::float8 as value from sale_item si join sale s on s.id = si.sale_id
                      where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive and si.sale_mode = 'SALE' and s.bill_date >= current_date - 90 group by si.product_id),
            proposal as (select distinct on (pii.product_id) pii.product_id, regexp_replace(pii.hsn, '\\s', '', 'g') as hsn
                           from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
                          where pii.active and not pii.archive and regexp_replace(coalesce(pii.hsn, ''), '\\s', '', 'g') ~ '^[0-9]{4}([0-9]{2}){0,2}$'
                          order by pii.product_id, pi.invoice_date desc, pii.id desc)
       select p.id, p.title, p.category, coalesce(s.bal, 0) as stock, coalesce(so.value, 0) as sold_90d, pr.hsn as proposed, d.hsn as category_hsn, d.confirmed_on is not null as category_confirmed
         from product p
         left join stock s on s.product_id = p.id left join sold so on so.product_id = p.id left join proposal pr on pr.product_id = p.id
         left join category_hsn_default d on lower(d.category) = lower(btrim(coalesce(p.category, '')))
        where p.active and btrim(coalesce(p.hsn_code, '')) = '' and (coalesce(s.bal, 0) > 0 or coalesce(so.value, 0) > 0)
        order by coalesce(so.value, 0) desc, p.title limit 500`);
    const [t] = await this.manager.query(`select count(*)::int as total, count(*) filter (where btrim(coalesce(hsn_code, '')) = '')::int as missing from product where active`);
    const cats = await this.manager.query(
      `select coalesce(nullif(btrim(p.category), ''), '(no category)') as category, count(*)::int as products,
              count(*) filter (where btrim(coalesce(p.hsn_code, '')) = '')::int as missing, max(d.hsn) as hsn, bool_or(d.confirmed_on is not null) as confirmed
         from product p left join category_hsn_default d on lower(d.category) = lower(btrim(coalesce(p.category, '')))
        where p.active group by 1 order by missing desc, category`);
    return {
      total: t.total, missing: t.missing,
      rows: rows.map((r: any) => ({ id: +r.id, title: r.title, category: r.category, stock: Number(r.stock), sold_90d: Math.round(Number(r.sold_90d) * 100) / 100, proposed: r.proposed, category_hsn: r.category_hsn, category_confirmed: !!r.category_confirmed })),
      categories: cats.map((c: any) => ({ category: c.category, products: c.products, missing: c.missing, hsn: c.hsn, confirmed: !!c.confirmed })),
    };
  }

  /** set the HSN of products, one by one (typed) or by accepting the proposal from purchases */
  async setHsn(user: any, body: any) {
    const items: Array<{ product_id: number; hsn?: string }> = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) throw new BadRequestException('Nothing to set.');
    if (items.length > 500) throw new BadRequestException('Set at most 500 products at a time.');
    let done = 0;
    await this.manager.transaction(async (tm) => {
      for (const it of items) {
        const id = Number(it.product_id);
        if (!Number.isInteger(id)) throw new BadRequestException('A product is missing.');
        let hsn: string;
        if (it.hsn) {
          const p = parseHsn(it.hsn);
          if (p.error) throw new BadRequestException(`${p.error} (product ${id})`);
          hsn = p.value!;
        } else {
          const [pr] = await tm.query(
            `select regexp_replace(pii.hsn, '\\s', '', 'g') as hsn from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
              where pii.product_id = $1 and pii.active and not pii.archive and regexp_replace(coalesce(pii.hsn, ''), '\\s', '', 'g') ~ '^[0-9]{4}([0-9]{2}){0,2}$'
              order by pi.invoice_date desc, pii.id desc limit 1`, [id]);
          if (!pr) throw new BadRequestException(`Product ${id} has no HSN on its purchases to take.`);
          hsn = pr.hsn;
        }
        const [before] = await tm.query(`select hsn_code from product where id = $1`, [id]);
        if (!before) throw new BadRequestException(`Product ${id} was not found.`);
        await tm.query(`update product set hsn_code = $2, updated_on = now(), updated_by = $3 where id = $1`, [id, hsn, user.id]);
        await this.audit.record({ userId: user.id, action: 'product.hsn_set', entityType: 'product', entityId: id, summary: `HSN ${str(before.hsn_code) || '(none)'} to ${hsn}`, details: { before: before.hsn_code, after: hsn, source: it.hsn ? 'typed' : 'purchase' } });
        done++;
      }
    });
    return { updated: done };
  }

  /** a default HSN for a category; provisional until confirmed, and the Business Head's decision */
  async setCategoryHsn(user: any, body: any) {
    const category = str(body?.category);
    if (!category || category === '(no category)') throw new BadRequestException('Choose the category.');
    const p = parseHsn(body?.hsn);
    if (p.error) throw new BadRequestException(p.error);
    const confirm = body?.confirm === true;
    await this.manager.query(
      `insert into category_hsn_default (category, hsn, created_by, confirmed_by, confirmed_on) values ($1, $2, $3, $4, $5)
       on conflict (lower(category)) do update set hsn = excluded.hsn, confirmed_by = excluded.confirmed_by, confirmed_on = excluded.confirmed_on`,
      [category, p.value, user.id, confirm ? user.id : null, confirm ? new Date() : null]);
    await this.audit.record({ userId: user.id, action: 'gst.category_hsn_set', entityType: 'category_hsn_default', entityId: null, summary: `${category}: default HSN ${p.value}${confirm ? ' (confirmed)' : ' (provisional)'}`, details: { category, hsn: p.value, confirmed: confirm } });
    return { ok: true };
  }

  /** copy a category's default HSN onto the products of the category that have none (they stop being provisional) */
  async applyCategoryHsn(user: any, body: any) {
    const category = str(body?.category);
    const [d] = await this.manager.query(`select hsn from category_hsn_default where lower(category) = lower($1)`, [category]);
    if (!d) throw new BadRequestException('That category has no default HSN yet.');
    const res = await this.manager.query(
      `update product set hsn_code = $2, updated_on = now(), updated_by = $3 where active and lower(btrim(coalesce(category, ''))) = lower($1) and btrim(coalesce(hsn_code, '')) = '' returning id`,
      [category, d.hsn, user.id]).then((r: any) => (Array.isArray(r[0]) ? r[0] : r));
    await this.audit.record({ userId: user.id, action: 'gst.category_hsn_applied', entityType: 'category_hsn_default', entityId: null, summary: `${category}: HSN ${d.hsn} set on ${res.length} product(s)`, details: { category, hsn: d.hsn, products: res.length } });
    return { updated: res.length };
  }
}
