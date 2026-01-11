-- ============================================================================
-- ROLLBACK: Comprehensive HSN Tax Master 2025
-- Migration: 010
-- Date: 2026-01-11
-- Description: Remove comprehensive 2025 HSN tax master data
-- ============================================================================

BEGIN;

-- ============================================================================
-- Delete 2025 HSN Data
-- ============================================================================

-- This migration adds comprehensive 2025 data
-- Rollback removes data added after a specific date

-- Uncomment to delete 2025 HSN data
-- DELETE FROM public.hsn_tax_master
-- WHERE effective_from >= '2025-01-01'::date
-- AND created_on >= '2025-12-05'::date;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.hsn_tax_master
    WHERE effective_from >= '2025-01-01'::date;

    RAISE NOTICE 'INFO: % HSN codes with 2025 effective dates remain', v_count;
    RAISE NOTICE 'INFO: This rollback does not delete data by default';
    RAISE NOTICE 'INFO: Uncomment DELETE statement if you want to remove 2025 data';
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
