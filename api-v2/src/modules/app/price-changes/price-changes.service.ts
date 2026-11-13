import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { buildChanges, ChangeRow, cleanPeriod } from './price-change-rules';

/**
 * Only products staff can still sell and be asked about: the product has a batch that was bought in the last year, has not expired, and still has stock
 * (all stores together: what was bought, less what was sold, plus approved adjustments and transfers). `h` is the price history row, `p` the product.
 */
export const IN_STOCK_SQL = `exists (
  select 1 from purchase_invoice_item pii
    join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
   where pii.product_id = h.product_id and pii.status = 'VERIFIED' and pii.active and not pii.archive
     and pi.invoice_date >= current_date - interval '1 year'
     and (pii.exp_date is null or public.expiry_end(pii.exp_date) >= current_date)
     and ((pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1)
          - coalesce((select sum(si.qty) from sale_item si where si.purchase_item_id = pii.id and si.active = true and si.archive = false), 0)
          + coalesce((select sum(pq.qty) from product_qtychange pq where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active = true and pq.archive = false), 0)) > 0)`;

/**
 * The price changes staff sheet: what changed in the sale prices over a period, from the price history. It carries only sale prices (what the customer pays),
 * never cost, so everyone who serves at the counter may open it (the permission "pricechanges.view").
 */
@Injectable()
export class PriceChangesService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async can(roleId: number | string): Promise<boolean> {
    const [r] = await this.manager.query(
      `select exists (select 1 from app_role r, json_array_elements(r.permissions) e, json_array_elements(e->'policies') p
                       where r.id = $1 and e->>'resource' = 'pricechanges' and p->>'action' = 'view') as can`, [roleId]);
    return !!r?.can;
  }

  async changes(q: { from?: string; to?: string; min?: any }) {
    let period: { from: string; to: string };
    try { period = cleanPeriod(q?.from, q?.to); } catch (e: any) { throw new BadRequestException(e.message); }
    const min = Math.max(0, Number(q?.min) || 0);
    const rows: ChangeRow[] = (await this.manager.query(
      `with h as (
         select pp.product_id, pp.sale_price::numeric as price, pp.eff_date, pp.id, pp.reason,
                lag(pp.sale_price::numeric) over (partition by pp.product_id order by pp.eff_date, pp.id) as prev_price
           from product_price2 pp where pp.active and not pp.archive and pp.sale_price > 0
       )
       select h.product_id, p.title, p.pack, h.price::float8 as price, h.prev_price::float8 as prev_price, to_char(h.eff_date, 'YYYY-MM-DD') as eff, h.reason,
              b.mrp, public.sale_gst(coalesce(b.tax, p.tax_pcnt, 0)::double precision)::float8 as sale_tax, h.id
         from h join product p on p.id = h.product_id and p.active and not p.archive
         left join lateral (
           select pii.mrp_cost::float8 as mrp, coalesce(pii.tax_pcnt, 0)::float8 as tax
             from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
            where pii.product_id = h.product_id and pii.active and not pii.archive and pii.mrp_cost > 0 and pii.ptr_value > 0
            order by pi.invoice_date desc, pii.id desc limit 1) b on true
        where h.eff_date between $1::date and $2::date and h.prev_price is not null and round(h.prev_price, 2) <> round(h.price, 2)
          and ${IN_STOCK_SQL}
        order by h.product_id, h.eff_date, h.id limit 5000`, [period.from, period.to])).map((r: any) => ({ ...r, price: +r.price, prev_price: +r.prev_price, mrp: r.mrp === null ? null : +r.mrp, sale_tax: +r.sale_tax }));
    const { increased, decreased } = buildChanges(rows, min);
    return { from: period.from, to: period.to, min, generatedon: new Date().toISOString(), counts: { increased: increased.length, decreased: decreased.length }, increased, decreased };
  }
}
