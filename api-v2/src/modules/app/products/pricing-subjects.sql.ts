/**
 * One row per product that has a current price and a completed purchase: what the price policy needs to judge it.
 * Units: price per pack without GST; `tax` is the GST the till bills (sale_gst); MRP per pack with GST; cost per pack without GST, net of trade discount and free quantity.
 * Profit rank: gross profit of the last 12 months (sale lines against the cost of the batch they were sold from);
 * A = the products earning the first 70% of profit, B = the next 20%, C = the rest (including products with no sales).
 * Trade margin = how far the latest cost (with GST) is below the MRP. `pack_suspect` marks a product whose MRP jumped 2.5x or more
 * between two purchases in the last two years (a pack or unit change), whose cost basis cannot be trusted.
 * $1 limits it to one product (null = every product).
 */
export const PRICING_SUBJECTS_SQL = `
with latest as (
  select distinct on (pii.product_id) pii.product_id, pii.mrp_cost, coalesce(pii.tax_pcnt, 0) as tax,
         (pii.ptr_value * (1 - coalesce(pii.disc_pcnt, 0) / 100.0) * pii.qty / nullif(pii.qty + coalesce(pii.free_qty, 0), 0)) as cost,
         pii.ptr_cost
    from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
   where pi.status = 'COMPLETE' and pi.active and not pi.archive and pii.active and not pii.archive
     and pii.mrp_cost > 0 and pii.ptr_value > 0 and ($1::int is null or pii.product_id = $1)
   order by pii.product_id, pi.invoice_date desc, pii.id desc
), cur as (
  select distinct on (product_id) product_id, sale_price, eff_date from product_price2
   where end_date > current_date and sale_price > 0 and ($1::int is null or product_id = $1)
   order by product_id, eff_date desc, id desc
), gp as (
  select si.product_id, sum(si.price::numeric * si.qty) as rev, sum(si.price::numeric * si.qty - (pii.ptr_value::numeric * (1 - coalesce(pii.disc_pcnt, 0)::numeric / 100) * pii.qty
                                   / nullif(pii.qty + coalesce(pii.free_qty, 0), 0) / nullif(p.pack, 0)) * si.qty) as gp
    from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE'
    join purchase_invoice_item pii on pii.id = si.purchase_item_id and pii.ptr_value > 0
    join product p on p.id = si.product_id
   where si.status = 'Complete' and si.qty > 0 and si.price > 0 and p.pack > 0 and s.bill_date >= current_date - 365
   group by si.product_id
), ranked as (
  select product_id, gp, sum(gp) over (order by gp desc, product_id) / nullif(sum(gp) over (), 0) as cum from gp where gp > 0
), pur as (
  select pii.product_id, pii.mrp_cost, pi.invoice_date, pii.id,
         lag(pii.mrp_cost) over (partition by pii.product_id order by pi.invoice_date, pii.id) as prev_mrp
    from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
   where pii.active and not pii.archive and pi.active and not pi.archive and pii.mrp_cost > 0 and pii.ptr_value > 0
     and ($1::int is null or pii.product_id = $1)
), suspect as (
  select distinct product_id from pur
   where prev_mrp > 0 and (mrp_cost / prev_mrp >= 2.5 or mrp_cost / prev_mrp <= 0.4) and invoice_date >= current_date - 730
)
select p.id as product_id, p.title, p.pack, public.gst_sale_rate(p.id, l.tax::double precision)::float8 as tax, l.mrp_cost::float8 as mrp, l.cost::float8 as cost, round(c.sale_price::numeric, 2)::float8 as price,
       to_char(c.eff_date, 'YYYY-MM-DD') as last_change,
       (1 - coalesce(l.ptr_cost, l.cost * (1 + l.tax / 100.0)) / l.mrp_cost)::float8 as trade_margin,
       case when r.cum is null then 'C' when r.cum <= 0.70 then 'A' when r.cum <= 0.90 then 'B' else 'C' end as abc,
       (s.product_id is not null) as pack_suspect,
       coalesce(g.gp, 0)::float8 as gp12, coalesce(g.rev, 0)::float8 as rev12
  from product p
  join latest l on l.product_id = p.id
  join cur c on c.product_id = p.id
  left join ranked r on r.product_id = p.id
  left join gp g on g.product_id = p.id
  left join suspect s on s.product_id = p.id
 where p.active and l.cost > 0
 order by p.title`;
