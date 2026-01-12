-- ============================================================================
-- ROLLBACK: Add Sales Intent Items (Multi-Product Support)
-- Migration: 020
-- Date: 2026-01-11
-- Description: Rollback sales intent items table and summary columns
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_salesintentitem_intentid;
DROP INDEX IF EXISTS public.idx_salesintentitem_prodid;
DROP INDEX IF EXISTS public.idx_salesintentitem_active;

-- ============================================================================
-- Drop Tables
-- ============================================================================

DROP TABLE IF EXISTS public.sales_intent_item CASCADE;

-- ============================================================================
-- Remove Summary Columns from sales_intent
-- ============================================================================

ALTER TABLE IF EXISTS public.sales_intent
DROP COLUMN IF EXISTS total_items,
DROP COLUMN IF EXISTS total_estimated_cost;

-- Remove deprecated column comments
COMMENT ON COLUMN sales_intent.prodid IS NULL;
COMMENT ON COLUMN sales_intent.productname IS NULL;
COMMENT ON COLUMN sales_intent.requestedqty IS NULL;
COMMENT ON COLUMN sales_intent.estimatedcost IS NULL;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'sales_intent_item';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Sales intent item table removed';
    ELSE
        RAISE WARNING 'WARNING: Sales intent item table still exists';
    END IF;

    -- Check summary columns removed
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sales_intent'
    AND column_name IN ('total_items', 'total_estimated_cost');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Summary columns removed from sales_intent';
    ELSE
        RAISE WARNING 'WARNING: Found % summary columns remaining', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
