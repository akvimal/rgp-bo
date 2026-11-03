-- One-off: release purchase requests left stuck by deleting a draft order (fixed in PR #165, which only helps from now on).
--
-- Before the fix, deleting a draft purchase order only switched the order off. Its requests stayed `Ordered` and pointed at the
-- dead order, so they vanished from Reorder and from the order's "Add items" list for good.
--
-- What this does, for requests whose order is switched off:
--   * lines the Reorder screen made up for that order (source System, source_ref purchase-suggestions) are switched off with it
--     (they would otherwise be counted twice against the real need);
--   * every other request loses the dead order and its ordered quantity; one that was Ordered goes back to Reviewed, one that
--     was still Open or Reviewed keeps its status, so it can be ordered again.
-- A request that already has an invoice line against it is left alone and listed (goods came in, so it is not stuck).
--
-- Run it in psql. It ends in ROLLBACK, so the first run only shows what it would do. Check the numbers, then change the last
-- line to COMMIT and run it again.

BEGIN;

\echo '--- requests on a switched-off order (before)'
SELECT pr.status, pr.source, (pr.source = 'System' AND pr.source_ref = 'purchase-suggestions') AS made_by_reorder, count(*) AS requests
  FROM purchase_request pr JOIN purchase_order po ON po.id = pr.order_id
 WHERE pr.active AND NOT pr.archive AND NOT po.active
 GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;

\echo '--- left alone: an invoice line is already recorded against them'
SELECT pr.id, pr.order_id, pr.status, pr.qty
  FROM purchase_request pr JOIN purchase_order po ON po.id = pr.order_id
 WHERE pr.active AND NOT pr.archive AND NOT po.active
   AND EXISTS (SELECT 1 FROM purchase_invoice_item pii WHERE pii.request_id = pr.id);

\echo '--- switching off the lines Reorder made up for those orders'
WITH x AS (
  UPDATE purchase_request pr
     SET active = false, updated_on = now()
    FROM purchase_order po
   WHERE po.id = pr.order_id AND pr.active AND NOT pr.archive AND NOT po.active
     AND pr.source = 'System' AND pr.source_ref = 'purchase-suggestions'
     AND NOT EXISTS (SELECT 1 FROM purchase_invoice_item pii WHERE pii.request_id = pr.id)
  RETURNING pr.id)
SELECT count(*) AS switched_off FROM x;

\echo '--- freeing the rest'
WITH x AS (
  UPDATE purchase_request pr
     SET status = CASE WHEN pr.status = 'Ordered' THEN 'Reviewed' ELSE pr.status END, order_id = NULL, ordered_qty = NULL, updated_on = now()
    FROM purchase_order po
   WHERE po.id = pr.order_id AND pr.active AND NOT pr.archive AND NOT po.active
     AND pr.status IN ('Ordered', 'Open', 'Reviewed')
     AND NOT EXISTS (SELECT 1 FROM purchase_invoice_item pii WHERE pii.request_id = pr.id)
  RETURNING pr.id)
SELECT count(*) AS freed FROM x;

\echo '--- still on a switched-off order after this (should be only the ones listed above)'
SELECT count(*) AS remaining
  FROM purchase_request pr JOIN purchase_order po ON po.id = pr.order_id
 WHERE pr.active AND NOT pr.archive AND NOT po.active;

\echo '--- for a look, not changed: Reviewed requests still shown on a live order (an item taken off before the fix)'
SELECT pr.id, pr.order_id, po.status AS order_status, pr.qty
  FROM purchase_request pr JOIN purchase_order po ON po.id = pr.order_id
 WHERE pr.active AND NOT pr.archive AND po.active AND pr.status = 'Reviewed';

ROLLBACK;   -- change to COMMIT once the numbers look right
