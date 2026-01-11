-- ============================================================================
-- ROLLBACK: KPI Enhancements
-- Migration: 028
-- Date: 2026-01-11
-- Description: Rollback KPI category master and monthly KPI score tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Tables (in reverse dependency order)
-- ============================================================================

-- Drop monthly KPI score (has FK to kpi_category_master)
DROP TABLE IF EXISTS public.monthly_kpi_score CASCADE;

-- Drop KPI category master
DROP TABLE IF EXISTS public.kpi_category_master CASCADE;

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
    AND table_name IN ('kpi_category_master', 'monthly_kpi_score');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: KPI enhancement tables removed';
    ELSE
        RAISE WARNING 'WARNING: Found % KPI tables that should have been removed', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
