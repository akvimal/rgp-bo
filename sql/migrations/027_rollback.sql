-- ============================================================================
-- ROLLBACK: Payroll Processing Tables
-- Migration: 027
-- Date: 2026-01-11
-- Description: Rollback payroll run, detail, and payment tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- Drop Sequences (if they exist)
-- ============================================================================

DROP SEQUENCE IF EXISTS public.payment_request_number_seq CASCADE;
DROP SEQUENCE IF EXISTS public.payment_transaction_number_seq CASCADE;

-- ============================================================================
-- Drop Tables (in reverse dependency order)
-- ============================================================================

-- Drop payment transaction (depends on payment_request)
DROP TABLE IF EXISTS public.payment_transaction CASCADE;

-- Drop payment request item (depends on payment_request)
DROP TABLE IF EXISTS public.payment_request_item CASCADE;

-- Drop payment request (depends on payroll_run)
DROP TABLE IF EXISTS public.payment_request CASCADE;

-- Drop payroll detail (depends on payroll_run)
DROP TABLE IF EXISTS public.payroll_detail CASCADE;

-- Drop payroll run
DROP TABLE IF EXISTS public.payroll_run CASCADE;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'payroll_run', 'payroll_detail', 'payment_request',
        'payment_request_item', 'payment_transaction'
    );

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All payroll processing tables removed';
    ELSE
        RAISE WARNING 'WARNING: Found % payroll tables that should have been removed', v_count;
    END IF;

    -- Check sequences
    SELECT COUNT(*) INTO v_count
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    AND sequence_name IN ('payment_request_number_seq', 'payment_transaction_number_seq');

    IF v_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All payroll sequences removed';
    ELSE
        RAISE WARNING 'WARNING: Found % payroll sequences remaining', v_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
