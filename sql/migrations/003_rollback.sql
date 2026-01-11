-- ============================================================================
-- ROLLBACK: HR Management Tables
-- Migration: 003
-- Date: 2026-01-11
-- Description: Rollback script for HR management tables migration
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Tables (in reverse dependency order)
-- ============================================================================

-- Drop HR audit log table (if exists)
DROP TABLE IF EXISTS public.hr_audit_log CASCADE;

-- Drop user score table
DROP TABLE IF EXISTS public.user_score CASCADE;

-- Drop leave balance table
DROP TABLE IF EXISTS public.leave_balance CASCADE;

-- Drop leave request table
DROP TABLE IF EXISTS public.leave_request CASCADE;

-- Drop leave type table
DROP TABLE IF EXISTS public.leave_type CASCADE;

-- Drop attendance table (partitioned - will drop all partitions)
DROP TABLE IF EXISTS public.attendance CASCADE;

-- Drop user shift assignment table
DROP TABLE IF EXISTS public.user_shift CASCADE;

-- Drop shift master table
DROP TABLE IF EXISTS public.shift CASCADE;

-- ============================================================================
-- Drop Extensions (only if not used by other features)
-- ============================================================================

-- Note: btree_gist extension might be used by other features
-- Uncomment only if you're certain it's not needed elsewhere
-- DROP EXTENSION IF EXISTS btree_gist;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    -- Check that HR tables are removed
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'shift', 'user_shift', 'attendance', 'leave_type',
        'leave_request', 'leave_balance', 'user_score', 'hr_audit_log'
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All HR management tables removed';
    ELSE
        RAISE WARNING 'WARNING: Found % HR tables that should have been removed', v_count;
    END IF;

    -- Check for attendance partitions
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'attendance_%';

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All attendance partitions removed';
    ELSE
        RAISE WARNING 'WARNING: Found % attendance partitions remaining', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================

-- Migration 003 rolled back successfully
-- HR management tables have been removed from the database
-- ============================================================================
