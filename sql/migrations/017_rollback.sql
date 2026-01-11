-- ============================================================================
-- ROLLBACK: Create Pricing Rules Engine
-- Migration: 017
-- Date: 2026-01-11
-- Description: Rollback pricing rules engine tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Tables (in reverse dependency order)
-- ============================================================================

-- Drop pricing rule application (has FK to pricing_rule)
DROP TABLE IF EXISTS public.pricing_rule_application CASCADE;

-- Drop pricing rule
DROP TABLE IF EXISTS public.pricing_rule CASCADE;

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
    AND table_name IN ('pricing_rule', 'pricing_rule_application');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Pricing rules engine tables removed';
    ELSE
        RAISE WARNING 'WARNING: Found % pricing tables remaining', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
