-- ============================================================================
-- ROLLBACK: Employment Type and Role Master Tables
-- Migration: 024
-- Date: 2026-01-11
-- Description: Rollback employment type and role master tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Tables (in reverse dependency order)
-- ============================================================================

-- Drop role master (has FK to employment_type_master)
DROP TABLE IF EXISTS public.role_master CASCADE;

-- Drop employment type master
DROP TABLE IF EXISTS public.employment_type_master CASCADE;

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
    AND table_name IN ('employment_type_master', 'role_master');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Employment type and role master tables removed';
    ELSE
        RAISE WARNING 'WARNING: Found % tables that should have been removed', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
