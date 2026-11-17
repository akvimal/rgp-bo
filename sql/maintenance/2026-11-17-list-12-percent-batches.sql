-- Read-only: the products bought (purchase invoice lines) at 12% GST whose batch has not expired as of November 2026.
-- It changes nothing in your data: it only reads (it keeps its working list in a temporary table that goes away), and ends in ROLLBACK.
--
--   psql -U <user> -d <database> -f 2026-11-17-list-12-percent-batches.sql
--   psql -U <user> -d <database> -f 2026-11-17-list-12-percent-batches.sql -o twelve-percent.txt        (to keep the output)
--
-- "Not expired as of November 2026": the batch's expiry date is on or after the date below, or there is no expiry date on the line. Expiry is read as the
-- end of its month, so a batch that expires in November 2026 still counts. Change the date to look as of another day.
-- A line counts when its invoice is not a draft (status NEW) and it was not rejected. Each batch shows how many units were bought and how many are still
-- on hand (the same figures as the app's stock list), so you can tell what is still to be sold from what was bought and sold already.
-- Set in_stock_only to 'yes' to list only the batches that still have stock.
\set as_of '2026-11-01'
\set in_stock_only 'no'

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE twelve ON COMMIT DROP AS
SELECT pii.id AS item_id, pii.product_id, p.title, p.pack, p.category, nullif(btrim(coalesce(pii.hsn, p.hsn_code)), '') AS hsn, p.tax_pcnt AS master_gst,
       pi.id AS invoice_id, pi.invoice_no, pi.invoice_date::date AS invoice_date, pi.status AS invoice_status, coalesce(v.business_name, v.legal_name) AS vendor,
       pii.batch, pii.exp_date, pii.tax_pcnt AS line_gst, pii.qty AS packs_bought, coalesce(pii.free_qty, 0) AS free_packs, pii.mrp_cost AS mrp,
       coalesce(iv.purchased, pii.qty * greatest(coalesce(p.pack, 1), 1)) AS units_bought, coalesce(iv.available, 0) AS units_on_hand
  FROM purchase_invoice_item pii
  JOIN purchase_invoice pi ON pi.id = pii.invoice_id
  JOIN product p ON p.id = pii.product_id
  LEFT JOIN vendor v ON v.id = pi.vendor_id
  LEFT JOIN inventory_view iv ON iv.purchase_itemid = pii.id
 WHERE pii.active AND NOT pii.archive AND pi.active AND NOT pi.archive
   AND pii.tax_pcnt = 12
   AND pi.status <> 'NEW' AND coalesce(pii.status, '') <> 'REJECTED'
   AND (pii.exp_date IS NULL OR pii.exp_date >= :'as_of'::date)
   AND (:'in_stock_only' <> 'yes' OR coalesce(iv.available, 0) > 0);

\echo '--- how many'
SELECT count(*) AS batches_at_12, count(DISTINCT product_id) AS products, count(*) FILTER (WHERE units_on_hand > 0) AS batches_with_stock,
       coalesce(sum(units_on_hand) FILTER (WHERE units_on_hand > 0), 0) AS units_on_hand, count(*) FILTER (WHERE exp_date IS NULL) AS batches_with_no_expiry
  FROM twelve;

\echo '--- by product (master_gst is the rate on the product itself; a different one means the product was changed after these batches were bought)'
SELECT title, pack, category, hsn, master_gst, count(*) AS batches, sum(units_bought) AS units_bought, sum(units_on_hand) AS units_on_hand,
       min(exp_date) AS earliest_expiry, max(exp_date) AS latest_expiry
  FROM twelve GROUP BY product_id, title, pack, category, hsn, master_gst ORDER BY units_on_hand DESC, title;

\echo '--- every batch, by product then expiry'
SELECT title, pack, batch, exp_date, line_gst, master_gst, units_bought, units_on_hand, mrp, invoice_no, invoice_date, invoice_status, vendor
  FROM twelve ORDER BY title, exp_date NULLS LAST, invoice_date;

\echo '--- products whose own GST is not 12 now, but which still have 12% batches (their new bills will use the product rate or the rate change in force)'
SELECT title, master_gst, sum(units_on_hand) AS units_on_hand FROM twelve WHERE master_gst IS DISTINCT FROM 12 GROUP BY product_id, title, master_gst ORDER BY units_on_hand DESC, title;

ROLLBACK;
