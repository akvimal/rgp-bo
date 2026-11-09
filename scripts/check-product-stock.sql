-- Why a product shows in Stock > Adjustments but not in the Stock screens.
-- Read-only. Run:   psql -U <user> -d <db> -v name=CUDO -f scripts/check-product-stock.sql
--   (docker:  docker exec -i <db container> psql -U <user> -d <db> -v name=CUDO < scripts/check-product-stock.sql)
-- Part 1 lists every batch of the products whose title starts with :name, with a verdict per batch.
-- Part 2 lists the quantity adjustments of those batches (what the Adjustments screen shows).
-- The Stock screens only return a batch when: product, batch and invoice are active and not archived; the batch status is what the screen filters on
-- (usually VERIFIED); the batch was received at the selected store; and (with "available") the approved balance is above 0.

\echo '== 1. Batches and why Stock would or would not show them =='
with b as (
  select p.id as product_id, p.title, p.active as p_active, p.archive as p_arch,
         pii.id as item_id, pii.batch, pii.exp_date, pii.status,
         pii.active as i_active, pii.archive as i_arch,
         inv.id as invoice_id, inv.invoice_no, inv.store_id as received_store, inv.active as inv_active, inv.archive as inv_arch,
         (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) as purchased,
         (select coalesce(sum(si.qty), 0) from sale_item si where si.purchase_item_id = pii.id and si.active and not si.archive) as sold,
         (select coalesce(sum(pq.qty), 0) from product_qtychange pq
           where pq.item_id = pii.id and pq.active and not pq.archive and coalesce(pq.status, 'APPROVED') = 'APPROVED') as approved_adj,
         (select coalesce(sum(pq.qty), 0) from product_qtychange pq
           where pq.item_id = pii.id and pq.active and not pq.archive and coalesce(pq.status, 'APPROVED') <> 'APPROVED') as waiting_adj
    from product p
    join purchase_invoice_item pii on pii.product_id = p.id
    join purchase_invoice inv on inv.id = pii.invoice_id
   where p.title ilike :'name' || '%'
)
select title, item_id, batch, exp_date, status, invoice_no, received_store as store,
       purchased, sold, approved_adj as adj, waiting_adj as adj_waiting,
       (purchased - sold + approved_adj) as balance,
       concat_ws('; ',
         case when not p_active then 'product is inactive' end,
         case when p_arch then 'product is archived' end,
         case when not i_active then 'batch is inactive' end,
         case when i_arch then 'batch is archived' end,
         case when not inv_active then 'invoice is inactive' end,
         case when inv_arch then 'invoice is archived' end,
         case when status is distinct from 'VERIFIED' then 'batch status is ' || coalesce(status, 'empty') || ' (Stock lists VERIFIED)' end,
         case when (purchased - sold + approved_adj) <= 0 then 'balance is ' || (purchased - sold + approved_adj) || ' (nothing available)' end,
         case when waiting_adj <> 0 then 'an adjustment of ' || waiting_adj || ' is waiting for approval (not counted)' end,
         case when exp_date is not null and public.expiry_end(exp_date) < current_date + 30 then 'expired or expiring within 30 days' end
       ) as why_stock_may_hide_it
  from b
 order by title, exp_date;

\echo ''
\echo '== 2. Quantity adjustments of these batches (the Adjustments screen) =='
select pq.id, p.title, pii.batch, pq.qty, pq.status, pq.store_id as adjusted_at_store, inv.store_id as received_store,
       pq.active, pq.archive, pq.created_on
  from product_qtychange pq
  join purchase_invoice_item pii on pii.id = pq.item_id
  join product p on p.id = pii.product_id
  join purchase_invoice inv on inv.id = pii.invoice_id
 where p.title ilike :'name' || '%'
 order by pq.created_on desc
 limit 50;

\echo ''
\echo '== 3. Products with this name that have no batch at all (nothing for Stock to list) =='
select p.id, p.title, p.active, p.archive
  from product p
 where p.title ilike :'name' || '%'
   and not exists (select 1 from purchase_invoice_item x where x.product_id = p.id);
