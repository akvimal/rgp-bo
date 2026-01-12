-- ============================================================================
-- ROLLBACK: Multi-Tenant & Multi-Store Architecture
-- Migration: 023
-- Date: 2026-01-11
-- Description: Rollback multi-store architecture tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Tables (in reverse dependency order)
-- ============================================================================

-- Drop store table (has FK to tenant)
DROP TABLE IF EXISTS public.store CASCADE;

-- Drop tenant table
DROP TABLE IF EXISTS public.tenant CASCADE;

-- Drop any additional multi-store related tables
DROP TABLE IF EXISTS public.store_inventory CASCADE;
DROP TABLE IF EXISTS public.store_reorder_limit CASCADE;

-- ============================================================================
-- Drop Indexes
-- ============================================================================

-- Indexes are automatically dropped with CASCADE, but listing for clarity
DROP INDEX IF EXISTS public.idx_tenant_code;
DROP INDEX IF EXISTS public.idx_tenant_status;
DROP INDEX IF EXISTS public.idx_store_tenant;
DROP INDEX IF EXISTS public.idx_store_code;
DROP INDEX IF EXISTS public.idx_store_type;

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
    AND table_name IN ('tenant', 'store', 'store_inventory', 'store_reorder_limit');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Multi-store architecture tables removed';
    ELSE
        RAISE WARNING 'WARNING: Found % multi-store tables remaining', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
