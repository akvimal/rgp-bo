-- ============================================================================
-- ROLLBACK: Populate Pharmacy HSN Codes (Additional)
-- Migration: 012
-- Date: 2026-01-11
-- Description: Remove additional pharmacy HSN codes
-- ============================================================================

BEGIN;

-- ============================================================================
-- Delete Additional HSN Data
-- ============================================================================

-- This migration adds additional pharmacy HSN codes
-- Rollback removes those additions

-- Uncomment to delete additional pharmacy HSN codes
-- DELETE FROM public.hsn_tax_master
-- WHERE tax_category IN ('MEDICINE', 'PHARMACEUTICAL', 'HEALTHCARE')
-- AND created_on >= '2025-12-05'::date
-- AND hsn_code IN (...);  -- Add specific HSN codes from migration 012

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.hsn_tax_master;

    RAISE NOTICE 'INFO: % total HSN codes in hsn_tax_master', v_count;
    RAISE NOTICE 'INFO: This rollback does not delete data by default';
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
