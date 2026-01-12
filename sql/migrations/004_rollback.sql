-- ============================================================================
-- ROLLBACK: Setup Test Database
-- Migration: 004
-- Date: 2026-01-11
-- Description: Rollback test database setup
-- ============================================================================

BEGIN;

-- ============================================================================
-- Remove Test Data
-- ============================================================================

-- This migration typically sets up test database configurations
-- Rollback would remove those configurations

-- Note: Migration 004 likely creates test users, roles, or sample data
-- Review migration 004 to determine what needs to be removed

RAISE NOTICE 'INFO: Migration 004 sets up test database';
RAISE NOTICE 'INFO: Review migration to determine specific rollback actions';
RAISE NOTICE 'WARNING: This rollback does not modify data by default';

-- Example rollback actions (uncomment and adjust as needed):
-- DELETE FROM app_user WHERE email LIKE '%test%';
-- DELETE FROM business WHERE name LIKE '%test%';
-- etc.

-- ============================================================================
-- Verification
-- ============================================================================

SELECT
    'Migration 004 rollback - No automatic changes' as status,
    'Review migration 004 for specific test data to remove' as note;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
-- Note: This migration sets up test data/configurations
-- Modify this rollback based on what migration 004 actually creates
-- ============================================================================
