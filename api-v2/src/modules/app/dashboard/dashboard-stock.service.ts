import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { MANAGER_ROLES } from 'src/core/roles';
import { cacheKey, heavy } from 'src/core/heavy-query';
import { StoredCache, wantsRefresh } from 'src/core/stored-cache';
import { DashboardService } from './dashboard.service';
import { StockGroup, bucketOf, stockValue } from './stock-value';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Stock value, expiry ladder and dead stock per store, and the GST position estimate. Stock is worked out the way the Store screen does it (what the
 * store received, less what it sold, plus its adjustments and transfers), not from `stock_view`, which has no store and on some installations does not
 * deduct sales. Scoped like the rest of the dashboard.
 */
@Injectable()
export class DashboardStockService {
  /** kept between opens: the stock figure hourly (stock moves with every bill, but a dashboard does not need it to the second and it is the heaviest read of the page), the GST estimate daily */
  private readonly stored: StoredCache;

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly dash: DashboardService) {
    this.stored = new StoredCache(manager);
  }

  private num(v: any): number | null {
    const n = Number(v);
    return v === undefined || v === null || v === '' || !Number.isFinite(n) ? null : n;
  }

  private async guard(user: any, storeid: any) {
    const requested = this.num(storeid);
    const sc = await this.dash.scope(user, requested);
    if (!MANAGER_ROLES.includes(String(sc.role))) throw new ForbiddenException('These figures are for the people who run the business or a store.');
    return { ...sc, requested };
  }

  /** What is on the shelf now, at cost and at MRP, by expiry, category and store. ?storeid narrows it to one store. */
  async value(user: any, storeid?: any, refresh = false) {
    const sc = await this.guard(user, storeid);
    return this.stored.get(cacheKey('stock', sc.businessId, sc.owner, sc.stores, sc.requested), 'hourly', () => this.valueNow(sc), refresh);
  }

  private async valueNow(sc: { stores: number[] | null; owner: boolean; requested: number | null }) {
    const rows = await heavy(this.manager, 30_000, (tx) => tx.query(
      `with items as (
         select pii.id as item_id, pii.product_id, pii.exp_date, pii.ptr_value, pii.mrp_cost, pii.qty, pii.free_qty, pi.store_id as home,
                coalesce(nullif(p.pack, 0), 1) as pack, coalesce(nullif(btrim(p.category), ''), 'Uncategorised') as cat
           from purchase_invoice_item pii
           join purchase_invoice pi on pi.id = pii.invoice_id
           join product p on p.id = pii.product_id
          where pii.active and not pii.archive and pii.status = 'VERIFIED' and pi.active and not pi.archive),
       locs as (
         select item_id, home as store_id from items
         union
         select pq.item_id, pq.store_id from product_qtychange pq where pq.store_id is not null and pq.active and not pq.archive),
       sold as (
         select si.purchase_item_id as item_id, s.store_id, sum(si.qty) as q
           from sale_item si join sale s on s.id = si.sale_id
          where si.purchase_item_id is not null and si.active and not si.archive group by 1, 2),
       adj as (
         select pq.item_id, pq.store_id, sum(pq.qty) as q
           from product_qtychange pq where pq.active and not pq.archive and coalesce(pq.status, 'APPROVED') = 'APPROVED' group by 1, 2),
       recent as (
         select distinct s.store_id, si.product_id
           from sale_item si join sale s on s.id = si.sale_id
          where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive and s.bill_date >= current_date - interval '90 days'),
       bal as (
         select l.store_id, i.*,
                (case when i.home = l.store_id then (i.qty + coalesce(i.free_qty, 0)) * i.pack else 0 end) - coalesce(so.q, 0) + coalesce(a.q, 0) as units
           from locs l
           join items i on i.item_id = l.item_id
           left join sold so on so.item_id = l.item_id and so.store_id = l.store_id
           left join adj a on a.item_id = l.item_id and a.store_id = l.store_id
          where ($1::int[] is null or l.store_id = any($1::int[])))
       select b.store_id, b.cat as category,
              case when b.exp_date is null then null else (public.expiry_end(b.exp_date) - current_date) end as days_left,
              (r.product_id is null) as dead,
              sum(b.units::float8 / b.pack * coalesce(b.ptr_value, 0))::float8 as cost,
              sum(b.units::float8 / b.pack * coalesce(b.mrp_cost, 0))::float8 as mrp,
              count(*)::int as batches
         from bal b left join recent r on r.store_id = b.store_id and r.product_id = b.product_id
        where b.units > 0
        group by 1, 2, 3, 4`, [sc.stores]));
    // the same bucket and flag in one group: rows with the same days_left collapse here
    const merged = new Map<string, StockGroup>();
    for (const r of rows) {
      const bucket = bucketOf(r.days_left === null ? null : Number(r.days_left));
      const k = `${r.store_id}|${r.category}|${bucket}|${r.dead}`;
      const m = merged.get(k) || { store_id: r.store_id, category: r.category, bucket, dead: !!r.dead, cost: 0, mrp: 0, batches: 0 };
      m.cost += Number(r.cost) || 0; m.mrp += Number(r.mrp) || 0; m.batches += Number(r.batches) || 0;
      merged.set(k, m);
    }
    const [cos] = await this.manager.query(
      `select coalesce(sum(si.qty::float8 / coalesce(nullif(p.pack, 0), 1) * coalesce(pii.ptr_value, 0)), 0)::float8 as cost
         from sale_item si join sale s on s.id = si.sale_id
         join purchase_invoice_item pii on pii.id = si.purchase_item_id join product p on p.id = si.product_id
        where s.status = 'COMPLETE' and s.active and not s.archive and si.active and not si.archive and s.bill_date >= current_date - interval '90 days'
          and ($1::int[] is null or s.store_id = any($1::int[]))`, [sc.stores]);
    const names = new Map<number, string>((await this.manager.query(`select id, trim(location) as name from stores`)).map((s: any) => [+s.id, String(s.name)]));
    const out = stockValue(Array.from(merged.values()), names, Number(cos?.cost) || 0, { showStores: sc.owner && sc.requested === null && (sc.stores || []).length > 1 });
    return { ...out, asOf: new Date().toISOString(), basis: 'Purchase rate before GST, for stock on the shelf now' };
  }

  /**
   * The GST position of a month, estimated from the money stream: tax collected on sales less returns, and tax paid on purchases and expenses.
   * It is not a return: ITC eligibility, reverse charge and the 2B match are not applied. Owner only.
   */
  async gst(user: any, q: { storeid?: any; month?: string; refresh?: any }) {
    const sc = await this.guard(user, q.storeid);
    if (!sc.owner) throw new ForbiddenException('The GST position is shown to the owner only.');
    const month = q.month && MONTH.test(q.month) ? q.month : new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);
    return this.stored.get(cacheKey('gst', sc.businessId, sc.stores, sc.requested, month), 'daily', async () => {
    const rows = await this.manager.query(
      `select flow_class as cls, coalesce(sum(gst), 0)::float8 as gst, coalesce(sum(amount), 0)::float8 as amount
         from money_flow
        where flow_date >= ($2 || '-01')::date and flow_date < (($2 || '-01')::date + interval '1 month')
          and ($1::int[] is null or store_id = any($1::int[]) or (store_id is null and $3::boolean))
        group by 1`, [sc.stores, month, sc.requested === null]);
    const g = (c: string) => Number(rows.find((r: any) => r.cls === c)?.gst) || 0;
    const output = r2(g('INCOME') - g('INCOME_REDUCTION'));
    const input = r2(['COST_OF_GOODS', 'OPERATING_COST', 'PEOPLE', 'FINANCE_COST', 'CAPITAL_OWNER', 'UNCLASSIFIED'].reduce((t, c) => t + g(c), 0));
    return {
      month, output, input, net: r2(output - input),
      notes: ['An estimate from your bills, purchase invoices and expenses. It is not the return: eligibility of input credit, reverse charge and the match with GSTR-2B are not applied.'],
    };
    }, wantsRefresh(q));
  }
}
