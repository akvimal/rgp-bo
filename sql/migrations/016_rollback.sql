-- ============================================================================
-- ROLLBACK: Enhance Product Price2 Table
-- Migration: 016
-- Date: 2026-01-11
-- Description: Rollback enhancements to product_price2 table
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop View Created by Migration
-- ============================================================================

DROP VIEW IF EXISTS public.product_current_price_view CASCADE;

-- ============================================================================
-- Remove Constraints
-- ============================================================================

ALTER TABLE IF EXISTS public.product_price2
DROP CONSTRAINT IF EXISTS product_price2_mrp_positive,
DROP CONSTRAINT IF EXISTS product_price2_sale_price_valid,
DROP CONSTRAINT IF EXISTS product_price2_margin_valid,
DROP CONSTRAINT IF EXISTS product_price2_discount_valid;

-- ============================================================================
-- Remove Enhanced Columns from product_price2
-- ============================================================================

ALTER TABLE IF EXISTS public.product_price2
DROP COLUMN IF EXISTS mrp,
DROP COLUMN IF EXISTS base_price,
DROP COLUMN IF EXISTS margin_pcnt,
DROP COLUMN IF EXISTS discount_pcnt,
DROP COLUMN IF EXISTS tax_pcnt,
DROP COLUMN IF EXISTS tax_inclusive,
DROP COLUMN IF EXISTS pricing_rule_id,
DROP COLUMN IF EXISTS calculation_method;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    -- Check columns removed
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_price2'
    AND column_name IN (
        'mrp', 'base_price', 'margin_pcnt', 'discount_pcnt',
        'tax_pcnt', 'tax_inclusive', 'pricing_rule_id', 'calculation_method'
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Enhanced product_price2 columns removed';
    ELSE
        RAISE WARNING 'WARNING: Found % enhanced columns remaining', v_count;
    END IF;

    -- Check view removed
    SELECT COUNT(*) INTO v_count
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'product_current_price_view';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: product_current_price_view removed';
    ELSE
        RAISE WARNING 'WARNING: product_current_price_view still exists';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
