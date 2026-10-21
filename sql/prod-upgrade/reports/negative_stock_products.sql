-- Products whose recorded purchases do not cover what was sold (net stock below zero on the books), busiest first.
-- This is the opening-stock gap: stock that is on the shelf but was never entered as a purchase.
with sold as (
  select si.purchase_item_id, sum(si.qty) as q
    from sale_item si join sale s on s.id = si.sale_id
   where s.status = 'COMPLETE' and si.active and not si.archive group by 1),
adj as (
  select item_id, sum(qty) as q from product_qtychange
   where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1),
per_product as (
  select p.id, p.title, p.pack,
         sum((pii.qty + coalesce(pii.free_qty, 0)) * p.pack - coalesce(sold.q, 0) + coalesce(adj.q, 0)) as net_units
    from purchase_invoice_item pii join product p on p.id = pii.product_id
    left join sold on sold.purchase_item_id = pii.id left join adj on adj.item_id = pii.id
   where pii.status = 'VERIFIED' and pii.active and not pii.archive group by p.id, p.title, p.pack),
recent as (
  select si.product_id, sum(si.qty) as units_90d, round(sum(si.total)::numeric) as revenue_90d
    from sale_item si join sale s on s.id = si.sale_id
   where s.status = 'COMPLETE' and s.bill_date >= current_date - 90 group by 1)
select pp.id as product_id, pp.title, pp.pack, pp.net_units, coalesce(r.units_90d, 0) as units_sold_90d,
       coalesce(r.revenue_90d, 0) as revenue_90d, 'counted on shelf: ' as physical_count
  from per_product pp left join recent r on r.product_id = pp.id
 where pp.net_units < 0
 order by revenue_90d desc, pp.net_units
