-- ============================================================================
-- ROLLBACK: Update HR Permissions
-- Migration: 005
-- Date: 2026-01-11
-- Description: Remove HR permissions from roles
-- ============================================================================

BEGIN;

-- ============================================================================
-- Remove HR Permissions from Roles
-- ============================================================================

-- Remove HR permissions from all roles that have them
UPDATE app_role
SET permissions = (
    SELECT jsonb_agg(perm)
    FROM jsonb_array_elements(permissions::jsonb) AS perm
    WHERE perm->>'resource' NOT IN ('hr', 'attendance', 'leave', 'shift', 'performance')
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(permissions::jsonb) AS perm
    WHERE perm->>'resource' IN ('hr', 'attendance', 'leave', 'shift', 'performance')
);

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM app_role
    WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(permissions::jsonb) AS perm
        WHERE perm->>'resource' IN ('hr', 'attendance', 'leave', 'shift', 'performance')
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: HR permissions removed from all roles';
    ELSE
        RAISE WARNING 'WARNING: Found % roles still with HR permissions', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
