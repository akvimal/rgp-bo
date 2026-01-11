-- ============================================================================
-- ROLLBACK: Fix Intent Number Generation
-- Migration: 021
-- Date: 2026-01-11
-- Description: Rollback intent number generation function fix
-- ============================================================================

BEGIN;

-- ============================================================================
-- Restore Original Function (if needed)
-- ============================================================================

-- This migration likely fixes bugs in the generate_intent_number() function
-- Rollback would restore the buggy version

-- Option 1: Drop the fixed function (will break intent number generation)
-- DROP FUNCTION IF EXISTS public.generate_intent_number() CASCADE;

-- Option 2: Restore the original buggy version
-- CREATE OR REPLACE FUNCTION generate_intent_number()
-- RETURNS VARCHAR AS $$
-- ... original buggy implementation ...
-- $$ LANGUAGE plpgsql;

RAISE NOTICE 'INFO: Migration 021 fixes generate_intent_number() function';
RAISE NOTICE 'WARNING: Rollback would restore buggy version';
RAISE NOTICE 'INFO: Consider keeping the fixed version unless testing';

-- ============================================================================
-- Verification
-- ============================================================================

SELECT
    'Migration 021 rollback - No changes made' as status,
    'Function generate_intent_number() remains fixed' as note;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
-- Note: This migration fixes a bug in intent number generation
-- Rollback is not recommended unless absolutely necessary
-- If you must rollback, restore from backup or manually recreate buggy version
-- ============================================================================
