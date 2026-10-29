/**
 * Products that have stock but no current sale price: a completed purchase, units still in stock (batches bought less sold and adjusted,
 * every store), an active product and no price in force. Same units and class inputs as PRICING_SUBJECTS_SQL. $1 limits it to one product.
 */
export const PRICING_UNPRICED_SQL = `
with latest as (
  select distinct on (pii.product_id) pii.product_id, pii.mrp_cost, coalesce(pii.tax_pcnt, 0) as tax,
         (pii.ptr_value * (1 - coalesce(pii.disc_pcnt, 0) / 100.0) * pii.qty / nullif(pii.qty + coalesce(pii.free_qty, 0), 0)) as cost,
         pii.ptr_cost
    from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
   where pi.status = 'COMPLETE' and pi.active and not pi.archive and pii.active and not pii.archive
     and pii.mrp_cost > 0 and pii.ptr_value > 0 and ($1::int is null or pii.product_id = $1)
   order by pii.product_id, pi.invoice_date desc, pii.id desc
), cur as (
  select distinct product_id from product_price2
   where end_date > current_date and sale_price > 0 and ($1::int is null or product_id = $1)
), sold as (
  select purchase_item_id, sum(qty) as q from sale_item where status = 'Complete' and active and not archive group by 1
), adj as (
  select item_id, sum(qty) as q from product_qtychange where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1
), stock as (
  select pii.product_id, sum(greatest(((pii.qty + coalesce(pii.free_qty, 0)) * p.pack) - coalesce(s.q, 0) + coalesce(a.q, 0), 0))::float8 as units
    from purchase_invoice_item pii
    join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
    join product p on p.id = pii.product_id and p.pack > 0
    left join sold s on s.purchase_item_id = pii.id left join adj a on a.item_id = pii.id
   where pii.active and not pii.archive and ($1::int is null or pii.product_id = $1)
   group by pii.product_id
), gp as (
  select si.product_id, sum(si.price::numeric * si.qty - (pii.ptr_value::numeric * (1 - coalesce(pii.disc_pcnt, 0)::numeric / 100) * pii.qty
                                   / nullif(pii.qty + coalesce(pii.free_qty, 0), 0) / nullif(p.pack, 0)) * si.qty) as gp
    from sale_item si join sale s on s.id = si.sale_id and s.status = 'COMPLETE'
    join purchase_invoice_item pii on pii.id = si.purchase_item_id and pii.ptr_value > 0
    join product p on p.id = si.product_id
   where si.status = 'Complete' and si.qty > 0 and si.price > 0 and p.pack > 0 and s.bill_date >= current_date - 365
   group by si.product_id
), ranked as (
  select product_id, sum(gp) over (order by gp desc, product_id) / nullif(sum(gp) over (), 0) as cum from gp where gp > 0
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
select p.id as product_id, p.title, p.pack, public.gst_sale_rate(p.id, l.tax::double precision)::float8 as tax, l.mrp_cost::float8 as mrp, l.cost::float8 as cost,
       (1 - coalesce(l.ptr_cost, l.cost * (1 + l.tax / 100.0)) / l.mrp_cost)::float8 as trade_margin,
       case when r.cum is null then 'C' when r.cum <= 0.70 then 'A' when r.cum <= 0.90 then 'B' else 'C' end as abc,
       (sp.product_id is not null) as pack_suspect, st.units
  from product p
  join latest l on l.product_id = p.id
  join stock st on st.product_id = p.id and st.units > 0
  left join cur c on c.product_id = p.id
  left join ranked r on r.product_id = p.id
  left join suspect sp on sp.product_id = p.id
 where p.active and c.product_id is null and l.cost > 0
 order by st.units desc, p.title`;
