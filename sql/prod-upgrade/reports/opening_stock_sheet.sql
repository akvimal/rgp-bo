-- Stock-count sheet. One line per active product, in category / title order for walking the shelves.
-- Fill strips + loose_units (and batch + expiry for what is on the shelf) and load with
--   scripts/prod-upgrade.sh load-opening-stock <file.csv>
-- Blank strips AND loose_units = not counted, the product is left alone. Write 0 to say "none on the shelf".
-- Add another line with the same product_id for a second batch / expiry. expiry is YYYY-MM (e.g. 2027-05).
-- mrp / ptr are only needed when the product has never been purchased (no cost to copy).
with sold as (
  select si.purchase_item_id, sum(si.qty) as q
    from sale_item si join sale s on s.id = si.sale_id
   where s.status = 'COMPLETE' and si.active and not si.archive group by 1),
adj as (
  select item_id, sum(qty) as q from product_qtychange
   where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1),
book as (
  select pii.product_id,
         sum((pii.qty + coalesce(pii.free_qty, 0)) * p.pack - coalesce(sold.q, 0) + coalesce(adj.q, 0)) as units
    from purchase_invoice_item pii join product p on p.id = pii.product_id
    left join sold on sold.purchase_item_id = pii.id left join adj on adj.item_id = pii.id
   where pii.status = 'VERIFIED' and pii.active and not pii.archive group by 1),
recent as (
  select si.product_id, sum(si.qty) as units_90d
    from sale_item si join sale s on s.id = si.sale_id
   where s.status = 'COMPLETE' and s.bill_date >= current_date - 90 group by 1)
select p.id as product_id, p.title, p.pack, coalesce(p.category, '') as category,
       coalesce(book.units, 0) as system_units, coalesce(recent.units_90d, 0) as units_sold_90d,
       '' as strips, '' as loose_units, '' as batch, '' as expiry, '' as mrp, '' as ptr
  from product p
  left join book on book.product_id = p.id
  left join recent on recent.product_id = p.id
 where p.active and not p.archive
 order by coalesce(p.category, ''), p.title
