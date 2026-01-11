-- ============================================================================
-- ROLLBACK: Update Payroll Permissions
-- Migration: 029
-- Date: 2026-01-11
-- Description: Remove payroll permissions from roles
-- ============================================================================

BEGIN;

-- ============================================================================
-- Remove Payroll Permissions from Roles
-- ============================================================================

-- Remove payroll permissions from Admin role (id: 1) at index 11
UPDATE app_role
SET permissions = (permissions::jsonb - 11)::json,
    updated_on = CURRENT_TIMESTAMP
WHERE id = 1
AND permissions::jsonb ? '11'
AND permissions::jsonb->'11'->>'resource' = 'payroll';

-- Remove payroll permissions from Store Head role (id: 3) at index 12
UPDATE app_role
SET permissions = (permissions::jsonb - 12)::json,
    updated_on = CURRENT_TIMESTAMP
WHERE id = 3
AND permissions::jsonb ? '12'
AND permissions::jsonb->'12'->>'resource' = 'payroll';

-- Remove payroll permissions from Sales Staff role (id: 2) at index 6
UPDATE app_role
SET permissions = (permissions::jsonb - 6)::json,
    updated_on = CURRENT_TIMESTAMP
WHERE id = 2
AND permissions::jsonb ? '6'
AND permissions::jsonb->'6'->>'resource' = 'payroll';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    -- Count roles that still have payroll permissions
    SELECT COUNT(*) INTO v_count
    FROM app_role
    WHERE id IN (1, 2, 3)
    AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(permissions::jsonb) AS perm
        WHERE perm->>'resource' = 'payroll'
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Payroll permissions removed from all roles';
    ELSE
        RAISE WARNING 'WARNING: Found % roles still with payroll permissions', v_count;
    END IF;
END $$;

-- Display current permissions
SELECT id, name,
       CASE
           WHEN EXISTS (
               SELECT 1
               FROM jsonb_array_elements(permissions::jsonb) AS perm
               WHERE perm->>'resource' = 'payroll'
           ) THEN 'HAS PAYROLL'
           ELSE 'NO PAYROLL'
       END as payroll_status
FROM app_role
WHERE id IN (1, 2, 3)
ORDER BY id;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
