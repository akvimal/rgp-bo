-- Prices that need a person: above the MRP (illegal to sell), below the purchase cost, a margin over 300% (over 1,000%
-- is almost certainly a typing mistake in the price or in the purchase cost), or no price at all for a product that is
-- bought. Worst first. Uses the same latest-purchase PTR and MRP as the price page.
with latest as (
  select pii.product_id, min(pii.mrp_cost) as mrp, max(pii.ptr_cost) as ptr
    from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
   where pii.mrp_cost > 0 and pii.ptr_cost > 0
     and pi.invoice_date = (select max(pi2.invoice_date) from purchase_invoice_item pii2
                              join purchase_invoice pi2 on pi2.id = pii2.invoice_id where pii2.product_id = pii.product_id)
   group by pii.product_id),
cur as (
  select product_id, sale_price from product_price2 where end_date > current_date and active)
select p.id as product_id, p.title, p.active, l.ptr, l.mrp, c.sale_price as price,
       round(((coalesce(c.sale_price, l.mrp) - l.ptr) / l.ptr * 100)::numeric) as margin_pct,
       concat_ws('; ',
         case when round(c.sale_price::numeric, 2) > round(l.mrp::numeric, 2) then 'above MRP' end,
         case when round(c.sale_price::numeric, 2) < round(l.ptr::numeric, 2) then 'below cost' end,
         case when (coalesce(c.sale_price, l.mrp) - l.ptr) / l.ptr * 100 > 1000 then 'margin over 1000%'
              when (coalesce(c.sale_price, l.mrp) - l.ptr) / l.ptr * 100 > 300 then 'margin over 300%' end,
         case when coalesce(c.sale_price, 0) = 0 then 'no price' end) as problem
  from product p join latest l on l.product_id = p.id left join cur c on c.product_id = p.id
 where not p.archive
   and (round(c.sale_price::numeric, 2) > round(l.mrp::numeric, 2) or round(c.sale_price::numeric, 2) < round(l.ptr::numeric, 2) or coalesce(c.sale_price, 0) = 0
        or (coalesce(c.sale_price, l.mrp) - l.ptr) / l.ptr * 100 > 300)
 order by (round(c.sale_price::numeric, 2) > round(l.mrp::numeric, 2)) desc nulls last, (coalesce(c.sale_price, l.mrp) - l.ptr) / l.ptr desc, p.id;
