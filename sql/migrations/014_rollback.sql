-- ============================================================================
-- ROLLBACK: Add HSN Permissions
-- Migration: 014
-- Date: 2026-01-11
-- Description: Remove HSN management permissions from roles
-- ============================================================================

BEGIN;

-- ============================================================================
-- Remove HSN Permissions from Roles
-- ============================================================================

-- Remove HSN permissions from all roles that have them
-- This assumes HSN permissions are stored as a resource named 'hsn' or 'hsn_master'

UPDATE app_role
SET permissions = (
    SELECT jsonb_agg(perm)
    FROM jsonb_array_elements(permissions::jsonb) AS perm
    WHERE perm->>'resource' NOT IN ('hsn', 'hsn_master', 'hsn_tax')
)::json,
updated_on = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(permissions::jsonb) AS perm
    WHERE perm->>'resource' IN ('hsn', 'hsn_master', 'hsn_tax')
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
        WHERE perm->>'resource' IN ('hsn', 'hsn_master', 'hsn_tax')
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: HSN permissions removed from all roles';
    ELSE
        RAISE WARNING 'WARNING: Found % roles still with HSN permissions', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
