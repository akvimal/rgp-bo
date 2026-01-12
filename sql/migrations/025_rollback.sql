-- ============================================================================
-- ROLLBACK: Salary Component Master Table
-- Migration: 025
-- Date: 2026-01-11
-- Description: Rollback salary component master table
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Tables
-- ============================================================================

DROP TABLE IF EXISTS public.salary_component_master CASCADE;

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
    AND table_name = 'salary_component_master';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Salary component master table removed';
    ELSE
        RAISE WARNING 'WARNING: Salary component master table still exists';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
