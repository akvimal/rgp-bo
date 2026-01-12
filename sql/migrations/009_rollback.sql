-- ============================================================================
-- ROLLBACK: Populate Pharmacy HSN Codes
-- Migration: 009
-- Date: 2026-01-11
-- Description: Remove pharmacy HSN code data (initial population)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Delete Pharmacy HSN Code Data
-- ============================================================================

-- Note: This migration only inserts data, so rollback just deletes the data
-- If you want to keep data from later migrations, be careful with this rollback

-- Delete all pharmacy-related HSN codes (this is a data migration)
-- Uncomment only if you want to remove ALL HSN codes added by this migration

-- DELETE FROM hsn_tax_master
-- WHERE tax_category IN ('MEDICINE', 'PHARMACEUTICAL', 'HEALTHCARE')
-- AND created_on >= '2025-12-05'::date;  -- Approximate migration date

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.hsn_tax_master
    WHERE tax_category IN ('MEDICINE', 'PHARMACEUTICAL', 'HEALTHCARE');

    RAISE NOTICE 'INFO: % pharmacy HSN codes remain in hsn_tax_master', v_count;
    RAISE NOTICE 'INFO: This rollback does not delete data by default';
    RAISE NOTICE 'INFO: Uncomment DELETE statement in rollback script if needed';
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
-- Note: This rollback is intentionally conservative with data deletion
-- Modify as needed based on your data retention requirements
-- ============================================================================
