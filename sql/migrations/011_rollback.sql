-- ============================================================================
-- ROLLBACK: Update HSN Codes Detailed
-- Migration: 011
-- Date: 2026-01-11
-- Description: Rollback detailed HSN code updates
-- ============================================================================

BEGIN;

-- ============================================================================
-- Rollback HSN Updates
-- ============================================================================

-- This migration updates existing HSN codes with detailed classification
-- Rollback would need to revert those updates

-- Since this modifies existing data, rollback is not straightforward
-- You would need to restore from backup or manually correct the data

RAISE NOTICE 'WARNING: Migration 011 modifies existing HSN code data';
RAISE NOTICE 'WARNING: Full rollback requires database backup restoration';
RAISE NOTICE 'INFO: This rollback does not modify data by default';

-- ============================================================================
-- Verification
-- ============================================================================

SELECT
    'Migration 011 rollback - No automatic changes' as status,
    COUNT(*) as total_hsn_codes
FROM public.hsn_tax_master;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
-- Note: This migration updates existing data
-- Full rollback requires restoring from pre-migration backup
-- ============================================================================
