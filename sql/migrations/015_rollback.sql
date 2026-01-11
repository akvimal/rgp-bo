-- ============================================================================
-- ROLLBACK: Add ITC Tracking Fields
-- Migration: 015
-- Date: 2026-01-11
-- Description: Remove ITC (Input Tax Credit) tracking fields
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop ITC Tracking Columns
-- ============================================================================

-- Remove ITC tracking fields from purchase_invoice table
ALTER TABLE IF EXISTS public.purchase_invoice
DROP COLUMN IF EXISTS itc_claimed,
DROP COLUMN IF EXISTS itc_claim_date,
DROP COLUMN IF EXISTS itc_claim_month,
DROP COLUMN IF EXISTS itc_reversal_amount,
DROP COLUMN IF EXISTS itc_reversal_reason,
DROP COLUMN IF EXISTS itc_status;

-- Drop any ITC-related indexes
DROP INDEX IF EXISTS public.idx_purchase_invoice_itc_status;
DROP INDEX IF EXISTS public.idx_purchase_invoice_itc_claim_month;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'purchase_invoice'
    AND column_name IN (
        'itc_claimed', 'itc_claim_date', 'itc_claim_month',
        'itc_reversal_amount', 'itc_reversal_reason', 'itc_status'
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All ITC tracking fields removed';
    ELSE
        RAISE WARNING 'WARNING: Found % ITC fields remaining', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
