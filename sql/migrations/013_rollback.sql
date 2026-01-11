-- ============================================================================
-- ROLLBACK: Update Medicine GST Rates 2025
-- Migration: 013
-- Date: 2026-01-11
-- Description: Rollback 2025 GST rate updates for medicines
-- ============================================================================

BEGIN;

-- ============================================================================
-- Rollback GST Rate Updates
-- ============================================================================

-- This migration updates GST rates for 2025
-- Rollback would need to restore previous rates

RAISE NOTICE 'WARNING: Migration 013 updates existing GST rates';
RAISE NOTICE 'WARNING: Full rollback requires database backup restoration';
RAISE NOTICE 'INFO: If you need to revert GST rates, restore from backup';

-- Alternative: Manually set rates back to previous values
-- Example (uncomment and adjust as needed):
-- UPDATE hsn_tax_master
-- SET cgst_rate = <old_rate>,
--     sgst_rate = <old_rate>,
--     igst_rate = <old_rate>,
--     effective_to = CURRENT_DATE,
--     updated_on = CURRENT_TIMESTAMP
-- WHERE hsn_code IN (...);

-- ============================================================================
-- Verification
-- ============================================================================

SELECT
    'Migration 013 rollback - No automatic changes' as status,
    COUNT(*) as medicine_hsn_codes
FROM public.hsn_tax_master
WHERE tax_category = 'MEDICINE';

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
