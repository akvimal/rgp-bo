-- ============================================================================
-- ROLLBACK: Multi-Role Support
-- Migration: 035
-- Date: 2026-01-11
-- Description: Rollback multi-role support (removes user_role_assignment table)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_user_role_lookup;
DROP INDEX IF EXISTS public.idx_user_role_role;
DROP INDEX IF EXISTS public.idx_user_role_user;

-- ============================================================================
-- Step 2: Drop user_role_assignment table
-- ============================================================================

DROP TABLE IF EXISTS public.user_role_assignment CASCADE;

-- ============================================================================
-- Step 3: Verification
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'user_role_assignment';

  IF v_count = 0 THEN
    RAISE NOTICE 'SUCCESS: user_role_assignment table removed';
  ELSE
    RAISE WARNING 'WARNING: user_role_assignment table still exists';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rollback 035: Multi-Role Support';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NOTE: app_user.role_id is preserved';
  RAISE NOTICE 'Users retain their primary role assignment';
  RAISE NOTICE 'Only multi-role capability has been removed';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
