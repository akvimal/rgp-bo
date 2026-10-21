-- Count these first, during the cutover freeze. Same columns as opening_stock_sheet.sql, so it loads the same way.
-- Products sold in the last 90 days that have NO sellable stock on the books (nothing with a positive balance and a
-- future expiry): the new POS will refuse to bill them until stock is counted in. Busiest first.
with sold as (
  select si.purchase_item_id, sum(si.qty) as q
    from sale_item si join sale s on s.id = si.sale_id
   where s.status = 'COMPLETE' and si.active and not si.archive group by 1),
adj as (
  select item_id, sum(qty) as q from product_qtychange
   where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1),
batch as (
  select pii.product_id,
         (pii.qty + coalesce(pii.free_qty, 0)) * p.pack - coalesce(sold.q, 0) + coalesce(adj.q, 0) as avail, pii.exp_date
    from purchase_invoice_item pii join product p on p.id = pii.product_id
    left join sold on sold.purchase_item_id = pii.id left join adj on adj.item_id = pii.id
   where pii.status = 'VERIFIED' and pii.active and not pii.archive),
book as (
  select product_id, sum(avail) as units,
         coalesce(sum(avail) filter (where avail > 0 and (exp_date is null or exp_date >= current_date)), 0) as sellable
    from batch group by product_id),
recent as (
  select si.product_id, sum(si.qty) as units_90d, sum(si.total) as revenue_90d
    from sale_item si join sale s on s.id = si.sale_id
   where s.status = 'COMPLETE' and s.bill_date >= current_date - 90 group by 1)
select p.id as product_id, p.title, p.pack, coalesce(p.category, '') as category,
       coalesce(book.units, 0) as system_units, recent.units_90d as units_sold_90d,
       '' as strips, '' as loose_units, '' as batch, '' as expiry, '' as mrp, '' as ptr
  from product p
  join recent on recent.product_id = p.id
  left join book on book.product_id = p.id
 where p.active and not p.archive and coalesce(book.sellable, 0) <= 0
 order by recent.revenue_90d desc, p.title
