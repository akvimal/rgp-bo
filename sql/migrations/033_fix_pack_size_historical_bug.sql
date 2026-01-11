-- Migration 016: Fix Pack Size Historical Quantity Bug
-- Date: 2026-01-09
-- Issue: #58 - Pack Size Change Retroactively Affects Historical Quantities
-- Description: Add pack_size column to purchase_invoice_item to prevent
--              retroactive quantity recalculation when product pack size changes
--
-- CRITICAL: This migration fixes a data integrity bug where changing a product's
--           pack size retroactively changes all historical purchase quantities

BEGIN;

-- ===========================================================================
-- Step 1: Add pack_size column to purchase_invoice_item
-- ===========================================================================
ALTER TABLE purchase_invoice_item
ADD COLUMN IF NOT EXISTS pack_size DOUBLE PRECISION;

-- ===========================================================================
-- Step 2: Backfill pack_size with current pack sizes from product table
-- ===========================================================================
UPDATE purchase_invoice_item pii
SET pack_size = p.pack
FROM product p
WHERE pii.product_id = p.id
AND pii.pack_size IS NULL;

-- ===========================================================================
-- Step 3: Set default for records where product no longer exists (if any)
-- ===========================================================================
UPDATE purchase_invoice_item
SET pack_size = 1
WHERE pack_size IS NULL;

-- ===========================================================================
-- Step 4: Make column NOT NULL with default value
-- ===========================================================================
ALTER TABLE purchase_invoice_item
ALTER COLUMN pack_size SET NOT NULL;

ALTER TABLE purchase_invoice_item
ALTER COLUMN pack_size SET DEFAULT 1;

-- ===========================================================================
-- Step 5: Update inventory_view to use stored pack_size
-- ===========================================================================
CREATE OR REPLACE VIEW public.inventory_view AS
SELECT
    pii.id,
    p.id AS product_id,
    pii.invoice_id AS purchase_invoiceid,
    pi.invoice_no,
    pi.invoice_date,
    pii.id AS purchase_itemid,
    p.title AS product_title,
    p.pack AS product_pack,  -- Current pack size for reference
    pii.pack_size AS purchase_pack_size,  -- Pack size at time of purchase (NEW)
    p.product_code,
    p.more_props,
    pii.batch AS product_batch,
    pii.exp_date AS product_expdate,
    pii.tax_pcnt AS product_taxpcnt,
    pii.mrp_cost AS mrp,
    pii.qty * pii.pack_size AS purchased,  -- FIXED: Use stored pack_size
    pii.status,
    pii.verify_start_date,
    pii.verify_end_date,
    pii.verified_by AS verified_userid,
    au.full_name AS verified_username,
    pii.active,
    COALESCE(si.bal, 0::bigint) AS sold,
    COALESCE(pq.bal, 0::bigint) AS adjusted,
    pii.qty * pii.pack_size - COALESCE(si.bal, 0::bigint) + COALESCE(pq.bal, 0::bigint) AS available  -- FIXED
FROM product p
JOIN purchase_invoice_item pii ON p.id = pii.product_id
JOIN purchase_invoice pi ON pi.id = pii.invoice_id
LEFT JOIN (
    SELECT si_1.purchase_item_id, sum(si_1.qty) AS bal
    FROM sale_item si_1
    WHERE si_1.status::text = 'Complete'::text
    GROUP BY si_1.purchase_item_id
) si ON si.purchase_item_id = pii.id
LEFT JOIN (
    SELECT product_qtychange.item_id, sum(product_qtychange.qty) AS bal
    FROM product_qtychange
    GROUP BY product_qtychange.item_id
) pq ON pq.item_id = pii.id
LEFT JOIN app_user au ON pii.verified_by = au.id
ORDER BY p.title, pii.exp_date DESC;

-- ===========================================================================
-- Step 6: Update product_items_view to use stored pack_size
-- ===========================================================================
CREATE OR REPLACE VIEW public.product_items_view AS
SELECT
    p.id,
    p.title,
    p.pack,  -- Current pack size for reference
    p.active,
    pi.invoice_date,
    pi.invoice_no,
    pi.id AS item_id,
    pi.batch,
    pi.exp_date,
    pi.status,
    pi.tax_pcnt,
    pi.mrp_cost,
    pi.last_sale_date,
    CASE
        WHEN pi.exp_date < (CURRENT_DATE + 30) THEN true
        ELSE false
    END AS expired,
    pi.qty * COALESCE(pi.pack_size, 1) AS purchased,  -- FIXED: Use stored pack_size
    COALESCE(pi.sold, 0::bigint) AS sold,
    COALESCE(sum(pq.qty), 0::bigint) AS adjusted,
    pi.qty * COALESCE(pi.pack_size, 1) - COALESCE(pi.sold, 0::bigint) + COALESCE(sum(pq.qty), 0::bigint) AS balance  -- FIXED
FROM product p
LEFT JOIN (
    SELECT
        i.invoice_date,
        i.invoice_no,
        pii.id,
        pii.product_id,
        pii.batch,
        pii.exp_date,
        pii.qty + COALESCE(pii.free_qty::bigint, 0::bigint) AS qty,
        pii.pack_size,  -- NEW: Include pack_size from purchase_invoice_item
        pii.tax_pcnt,
        pii.mrp_cost,
        pii.status,
        COALESCE(sum(si.qty), 0::bigint) AS sold,
        max(s.bill_date) AS last_sale_date
    FROM purchase_invoice_item pii
    JOIN purchase_invoice i ON i.id = pii.invoice_id
    LEFT JOIN sale_item si ON si.purchase_item_id = pii.id
    LEFT JOIN sale s ON s.id = si.sale_id
    GROUP BY i.invoice_date, i.invoice_no, pii.id, pii.tax_pcnt, pii.mrp_cost,
             pii.product_id, pii.batch, pii.exp_date, pii.qty, pii.status, pii.pack_size
) pi ON pi.product_id = p.id
LEFT JOIN product_qtychange pq ON pq.item_id = pi.id
GROUP BY p.id, p.title, pi.invoice_date, pi.invoice_no, pi.tax_pcnt, pi.mrp_cost,
         pi.id, pi.batch, pi.exp_date, pi.last_sale_date, pi.qty, pi.status, pi.sold, pi.pack_size
ORDER BY p.title;

COMMIT;

-- ===========================================================================
-- Verification Queries
-- ===========================================================================

-- Show migration status
SELECT
    'Migration 016 completed successfully!' AS status,
    NOW() AS completed_at;

-- Show statistics
SELECT
    COUNT(*) AS total_items,
    COUNT(DISTINCT product_id) AS unique_products,
    MIN(pack_size) AS min_pack_size,
    MAX(pack_size) AS max_pack_size,
    AVG(pack_size) AS avg_pack_size
FROM purchase_invoice_item;

-- Show sample of updated data (first 10 records)
SELECT
    pii.id,
    p.title AS product_name,
    pii.qty AS quantity_in_packs,
    pii.pack_size AS stored_pack_size,
    p.pack AS current_pack_size,
    pii.qty * pii.pack_size AS total_units_purchased,
    CASE
        WHEN pii.pack_size = p.pack THEN '✓ Same'
        ELSE '⚠ Different'
    END AS pack_status
FROM purchase_invoice_item pii
JOIN product p ON p.id = pii.product_id
ORDER BY pii.id DESC
LIMIT 10;

-- Check for any NULL pack_size values (should be zero)
SELECT
    COUNT(*) AS null_pack_size_count,
    CASE
        WHEN COUNT(*) = 0 THEN '✓ All pack_size values populated'
        ELSE '✗ WARNING: NULL values found!'
    END AS validation_status
FROM purchase_invoice_item
WHERE pack_size IS NULL;
