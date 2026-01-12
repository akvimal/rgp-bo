-- ============================================================================
-- ROLLBACK: Create Sales Intent Management System
-- Migration: 019
-- Date: 2026-01-11
-- Description: Rollback sales intent table and functions
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.generate_intent_number() CASCADE;

-- ============================================================================
-- Drop Indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_sales_intent_intentno;
DROP INDEX IF EXISTS public.idx_sales_intent_status;
DROP INDEX IF EXISTS public.idx_sales_intent_customerid;
DROP INDEX IF EXISTS public.idx_sales_intent_prodid;
DROP INDEX IF EXISTS public.idx_sales_intent_purchaseorderid;
DROP INDEX IF EXISTS public.idx_sales_intent_intenttype;
DROP INDEX IF EXISTS public.idx_sales_intent_priority;
DROP INDEX IF EXISTS public.idx_sales_intent_created_on;

-- ============================================================================
-- Drop Tables
-- ============================================================================

DROP TABLE IF EXISTS public.sales_intent CASCADE;

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
    AND table_name = 'sales_intent';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Sales intent table removed';
    ELSE
        RAISE WARNING 'WARNING: Sales intent table still exists';
    END IF;

    -- Check function
    SELECT COUNT(*) INTO v_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'generate_intent_number';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Intent number generation function removed';
    ELSE
        RAISE WARNING 'WARNING: Intent function still exists';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
