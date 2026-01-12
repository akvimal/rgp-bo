-- ============================================================================
-- ROLLBACK: Employee Salary Structure Table
-- Migration: 026
-- Date: 2026-01-11
-- Description: Rollback employee salary structure table
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Tables
-- ============================================================================

DROP TABLE IF EXISTS public.employee_salary_structure CASCADE;

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
    AND table_name = 'employee_salary_structure';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Employee salary structure table removed';
    ELSE
        RAISE WARNING 'WARNING: Employee salary structure table still exists';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
