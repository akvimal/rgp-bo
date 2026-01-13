-- ============================================================================
-- Migration 035: Multi-Role Support (Backward Compatible)
-- Date: 2026-01-11
-- Description: Allow users to have multiple roles while keeping backward
--              compatibility with app_user.role_id
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create user_role_assignment table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_role_assignment (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES app_user(id),
  assigned_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true,

  -- Metadata
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT user_role_assignment_unique UNIQUE(user_id, role_id)
);

-- Add comments
COMMENT ON TABLE public.user_role_assignment IS 'Tracks multiple role assignments per user';
COMMENT ON COLUMN public.user_role_assignment.user_id IS 'User who has the role';
COMMENT ON COLUMN public.user_role_assignment.role_id IS 'Role assigned to user';
COMMENT ON COLUMN public.user_role_assignment.assigned_by IS 'User who assigned this role';
COMMENT ON COLUMN public.user_role_assignment.active IS 'Whether this assignment is currently active';

-- ============================================================================
-- Step 2: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_role_user
ON public.user_role_assignment(user_id)
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_role_role
ON public.user_role_assignment(role_id)
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_user_role_lookup
ON public.user_role_assignment(user_id, role_id)
WHERE active = true;

-- ============================================================================
-- Step 3: Migrate existing single-role assignments
-- ============================================================================

-- Populate user_role_assignment from existing app_user.role_id
INSERT INTO public.user_role_assignment (user_id, role_id, assigned_by, active)
SELECT
  id,
  role_id,
  NULL,  -- System migration, no specific assigner
  true
FROM public.app_user
WHERE role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_role_assignment ura
    WHERE ura.user_id = app_user.id
    AND ura.role_id = app_user.role_id
  );

-- ============================================================================
-- Step 4: Verification and Statistics
-- ============================================================================

DO $$
DECLARE
  v_total_users INTEGER;
  v_migrated_roles INTEGER;
  v_multi_role_users INTEGER;
BEGIN
  -- Count total users
  SELECT COUNT(*) INTO v_total_users FROM public.app_user WHERE role_id IS NOT NULL;

  -- Count migrated role assignments
  SELECT COUNT(*) INTO v_migrated_roles FROM public.user_role_assignment WHERE active = true;

  -- Count users with multiple roles (should be 0 after initial migration)
  SELECT COUNT(*) INTO v_multi_role_users
  FROM (
    SELECT user_id
    FROM public.user_role_assignment
    WHERE active = true
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) multi;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 035: Multi-Role Support';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total users with roles: %', v_total_users;
  RAISE NOTICE 'Role assignments created: %', v_migrated_roles;
  RAISE NOTICE 'Users with multiple roles: %', v_multi_role_users;
  RAISE NOTICE '========================================';

  IF v_total_users = v_migrated_roles THEN
    RAISE NOTICE 'SUCCESS: All user roles migrated successfully';
  ELSE
    RAISE WARNING 'WARNING: Mismatch between users (%) and assignments (%)', v_total_users, v_migrated_roles;
  END IF;
END $$;

-- ============================================================================
-- Step 5: Show sample data
-- ============================================================================

SELECT
  u.id AS user_id,
  u.full_name,
  u.email,
  u.role_id AS primary_role_id,
  r.name AS primary_role_name,
  COUNT(ura.id) AS total_roles
FROM public.app_user u
LEFT JOIN public.app_role r ON u.role_id = r.id
LEFT JOIN public.user_role_assignment ura ON u.id = ura.user_id AND ura.active = true
WHERE u.active = true
GROUP BY u.id, u.full_name, u.email, u.role_id, r.name
ORDER BY u.id
LIMIT 10;

COMMIT;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Backward Compatibility: app_user.role_id is kept as the "primary" role
-- 2. New code should use user_role_assignment for full role list
-- 3. Users can now have multiple roles assigned
-- 4. Permissions will be merged from all active roles (implemented in backend)
-- 5. To add a second role: INSERT INTO user_role_assignment (user_id, role_id, assigned_by)
-- ============================================================================
