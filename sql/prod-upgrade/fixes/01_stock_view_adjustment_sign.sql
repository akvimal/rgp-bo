-- approval: required
-- 01_stock_view_adjustment_sign.sql
--
-- stock_view disagrees with the stock the POS and the Store screen use (inventory_view / stock2):
--   1. it only counts sale lines with status 'Sale Complete' or 'Return Accepted', but every sale line is saved as
--      'Complete', so sales were never deducted: available = purchased - adjustments, for every batch;
--   2. it subtracts adjustments, while everywhere else a negative adjustment (expired, damaged, missing, transfer out)
--      takes stock out and a positive one (customer return) puts it back.
-- stock_view feeds the "ready to sell" list, the stock-demand report and the single-batch lookup on the Adjust screen.
-- This recreates it with the same columns and the POS formula: purchased (incl. free) - sold ('Complete') + adjustments.
-- The POS itself is unaffected. Skipped unless run with --approve 01.
\set ON_ERROR_STOP on

select count(*) as batches_changing from stock_view \gset
\echo FIX 01: stock_view recalculated for :batches_changing batches

\if :dry_run
\echo FIX 01: dry run, view not changed
\else
create or replace view public.stock_view as
 SELECT pii.id,
    pi.invoice_no,
    pi.invoice_date,
    pii.invoice_id,
    p.id AS product_id,
    p.title,
    p.more_props,
    p.pack,
    pii.batch,
    pii.exp_date AS expdate,
    pii.mrp_cost,
    pii.ptr_value,
    round(pii.sale_price::numeric, 2) AS sale_price,
    pii.ptr_cost,
    pii.tax_pcnt,
    (pii.qty + (+ COALESCE(pii.free_qty, 0))) * p.pack AS sale_qty,
    pii.qty + COALESCE(pii.free_qty, 0) AS purchase_qty,
    (pii.qty + (+ COALESCE(pii.free_qty, 0))) * p.pack - COALESCE(x.total_qty, 0::bigint) + COALESCE(y.adj_qty, 0::bigint) AS available_qty,
    (date_part('year'::text, now()) - date_part('year'::text, pi.invoice_date)) * 12::double precision + (date_part('month'::text, now()) - date_part('month'::text, pi.invoice_date)) AS old_with_us,
    (date_part('year'::text, pii.exp_date) - date_part('year'::text, now())) * 12::double precision + (date_part('month'::text, pii.exp_date) - date_part('month'::text, now())) AS life_left
   FROM purchase_invoice_item pii
     JOIN purchase_invoice pi ON pi.id = pii.invoice_id
     JOIN product p ON p.id = pii.product_id
     LEFT JOIN ( SELECT si.purchase_item_id,
            sum(si.qty) AS total_qty
           FROM sale_item si
             JOIN sale s ON s.id = si.sale_id
          WHERE s.status::text = 'COMPLETE'::text AND si.status::text = 'Complete'::text
          GROUP BY si.purchase_item_id) x ON x.purchase_item_id = pii.id
     LEFT JOIN ( SELECT pc.item_id,
            sum(pc.qty) AS adj_qty
           FROM product_qtychange pc
          WHERE COALESCE(pc.status, 'APPROVED'::character varying)::text = 'APPROVED'::text
          GROUP BY pc.item_id) y ON y.item_id = pii.id
  WHERE pii.status::text = 'VERIFIED'::text
;
\endif
