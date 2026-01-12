-- ============================================================================
-- ROLLBACK: Create HSN Tax Master Table
-- Migration: 008
-- Date: 2026-01-11
-- Description: Rollback HSN tax master table and related functions
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_hsn_tax_rate(VARCHAR, DATE) CASCADE;

-- ============================================================================
-- Drop Indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_hsn_tax_active;
DROP INDEX IF EXISTS public.idx_hsn_tax_dates;

-- ============================================================================
-- Drop Tables
-- ============================================================================

DROP TABLE IF EXISTS public.hsn_tax_master CASCADE;

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
    AND table_name = 'hsn_tax_master';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: HSN tax master table removed';
    ELSE
        RAISE WARNING 'WARNING: HSN tax master table still exists';
    END IF;

    -- Check function
    SELECT COUNT(*) INTO v_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'get_hsn_tax_rate';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: HSN tax functions removed';
    ELSE
        RAISE WARNING 'WARNING: HSN tax functions still exist';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
