/**
 * The products to print: active, with a price, and with stock in a batch that has not expired. For each, the lowest MRP (per pack) among the batches
 * in stock and the highest GST billed on them, so the printed price stays within every batch's MRP. Stock is the batches bought less what was sold and
 * adjusted, at every store. A negative balance counts as none.
 */
export const PRICE_LIST_SQL = `
with sold as (
  select purchase_item_id, sum(qty) as q from sale_item where status = 'Complete' and active and not archive group by 1
), adj as (
  select item_id, sum(qty) as q from product_qtychange where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1
), batches as (
  select pii.product_id, pii.mrp_cost, coalesce(pii.tax_pcnt, 0) as tax,
         greatest(((pii.qty + coalesce(pii.free_qty, 0)) * p.pack) - coalesce(s.q, 0) + coalesce(a.q, 0), 0) as units
    from purchase_invoice_item pii
    join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
    join product p on p.id = pii.product_id and p.active and p.pack > 0
    left join sold s on s.purchase_item_id = pii.id
    left join adj a on a.item_id = pii.id
   where pii.active and not pii.archive and pii.mrp_cost > 0 and (pii.exp_date is null or pii.exp_date >= current_date)
), agg as (
  select product_id,
         min(mrp_cost) filter (where units > 0) as min_mrp,
         max(public.gst_sale_rate(product_id, tax::double precision)) filter (where units > 0) as tmax
    from batches group by product_id having sum(units) > 0
)
select p.id, p.title, p.pack, p.more_props->>'schedule' as sched,
       round(c.sale_price::numeric, 2)::float8 as price_ex, a.min_mrp::float8 as min_mrp, a.tmax::float8 as tmax
  from agg a
  join product p on p.id = a.product_id
  join lateral (select sale_price from product_price2 where product_id = p.id and end_date > current_date and sale_price > 0 order by eff_date desc, id desc limit 1) c on true
 order by upper(p.title)`;
