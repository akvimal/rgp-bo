-- approval: required
-- 03_expired_stock_writeoff.sql
--
-- Writes off stock that is still on the books long after its expiry date: one approved "Expired" stock
-- adjustment per batch, for the full remaining quantity, in the same form staff use on the Adjust screen
-- (reason Expired / EXPIRED, negative quantity). Only batches that expired more than :older_than_days days
-- before the run are touched (default 180); anything more recent should be counted physically first.
--
-- Quantity is what the POS and the Store stock screen show: purchased (incl. free) - sold + approved adjustments.
-- It does not use stock_view (see fix 01). Re-running finds nothing: written-off batches are at 0.
-- Run with --approve 03. Dry run lists the numbers without writing.
\set ON_ERROR_STOP on

\if :{?older_than_days}
\else
  \set older_than_days 180
\endif

select u.id as actor_id
  from app_user u join app_role r on r.id = u.role_id
 where r.name = 'Business Head' and u.active and not u.archive
 order by u.id limit 1 \gset

create temp table _expired_wo as
with sold as (
  select si.purchase_item_id, sum(si.qty) as q
    from sale_item si join sale s on s.id = si.sale_id
   where s.status = 'COMPLETE' and si.active and not si.archive
   group by 1),
adj as (
  select item_id, sum(qty) as q from product_qtychange
   where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1)
select pii.id as item_id, pi.store_id,
       ((pii.qty + coalesce(pii.free_qty, 0)) * p.pack - coalesce(sold.q, 0) + coalesce(adj.q, 0))::int as remaining,
       pii.exp_date, pii.ptr_cost, p.pack
  from purchase_invoice_item pii
  join purchase_invoice pi on pi.id = pii.invoice_id
  join product p on p.id = pii.product_id
  left join sold on sold.purchase_item_id = pii.id
  left join adj on adj.item_id = pii.id
 where pii.status = 'VERIFIED'
   and pii.exp_date < current_date - :older_than_days::int
   and ((pii.qty + coalesce(pii.free_qty, 0)) * p.pack - coalesce(sold.q, 0) + coalesce(adj.q, 0)) > 0;

select count(*) as n, coalesce(sum(remaining), 0) as units,
       coalesce(round(sum(remaining * ptr_cost / nullif(pack, 0))::numeric), 0) as at_cost
  from _expired_wo \gset
\echo FIX 03: batches expired more than :older_than_days days ago with stock: :n, :units units, Rs :at_cost at cost

\if :dry_run
\echo FIX 03: dry run, nothing written
\else
  \if :{?actor_id}
    insert into product_qtychange (item_id, qty, reason, reason_code, comments, status, store_id, created_by, updated_by)
    select item_id, -remaining, 'Expired', 'EXPIRED',
           'Opening clean-up at cutover: expired more than ' || :older_than_days || ' days before', 'APPROVED', store_id, :actor_id, :actor_id
      from _expired_wo;
    \echo FIX 03: wrote :n adjustments
  \else
    \echo FIX 03: no active Business Head user to attribute the adjustments to, skipped
  \endif
\endif
drop table _expired_wo;
