-- ============================================================================
-- ROLLBACK: Add Sales Intent Permissions
-- Migration: 022
-- Date: 2026-01-11
-- Description: Remove sales intent permissions from roles
-- ============================================================================

BEGIN;

-- ============================================================================
-- Remove Sales Intent Permissions from Roles
-- ============================================================================

-- Remove sales intent permissions from all roles that have them
UPDATE app_role
SET permissions = (
    SELECT jsonb_agg(perm)
    FROM jsonb_array_elements(permissions::jsonb) AS perm
    WHERE perm->>'resource' NOT IN ('sales_intent', 'intent', 'sales-intent')
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(permissions::jsonb) AS perm
    WHERE perm->>'resource' IN ('sales_intent', 'intent', 'sales-intent')
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
        WHERE perm->>'resource' IN ('sales_intent', 'intent', 'sales-intent')
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: Sales intent permissions removed from all roles';
    ELSE
        RAISE WARNING 'WARNING: Found % roles still with intent permissions', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
