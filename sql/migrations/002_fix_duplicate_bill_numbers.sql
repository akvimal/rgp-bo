-- ============================================================================
-- Migration: 002_fix_duplicate_bill_numbers.sql
-- Description: Fix race condition in bill number generation and add unique constraint
-- Date: 2025-10-20
-- Impact: Prevents duplicate bill numbers in concurrent transactions
-- Estimated Time: < 1 minute
-- ============================================================================

-- IMPORTANT: This migration must be run during a maintenance window or low-traffic period
-- to avoid conflicts with active transactions

BEGIN;

-- ============================================================================
-- STEP 1: Create sequence for temporary bill number assignment
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'temp_bill_seq') THEN
        CREATE SEQUENCE temp_bill_seq START 1;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Initialize sales_meta table with current maximum bill number
-- ============================================================================
-- This ensures the function starts from the correct number
INSERT INTO sales_meta (fiscal_year_start, last_bill_no)
SELECT
    DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day' AS fiscal_year_start,
    COALESCE(MAX(bill_no), 0) AS last_bill_no
FROM sale
WHERE bill_no IS NOT NULL
ON CONFLICT DO NOTHING;

-- If no sales exist yet, ensure we have a row
INSERT INTO sales_meta (fiscal_year_start, last_bill_no)
SELECT
    DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day',
    0
WHERE NOT EXISTS (SELECT 1 FROM sales_meta);

-- ============================================================================
-- STEP 3: Update NULL bill numbers with unique temporary values
-- ============================================================================
-- This is necessary before we can add the unique constraint
UPDATE sale
SET bill_no = nextval('temp_bill_seq')
WHERE bill_no IS NULL;

-- ============================================================================
-- STEP 4: Add unique constraint on bill_no
-- ============================================================================
-- This prevents duplicate bill numbers at the database level
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sale_bill_no_unique'
        AND conrelid = 'sale'::regclass
    ) THEN
        ALTER TABLE sale
        ADD CONSTRAINT sale_bill_no_unique
        UNIQUE (bill_no);

        RAISE NOTICE 'Added unique constraint: sale_bill_no_unique';
    ELSE
        RAISE NOTICE 'Unique constraint already exists: sale_bill_no_unique';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Add unique constraint on sales_meta.fiscal_year_start
-- ============================================================================
-- This prevents duplicate fiscal year entries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sales_meta_fiscal_year_unique'
        AND conrelid = 'sales_meta'::regclass
    ) THEN
        ALTER TABLE sales_meta
        ADD CONSTRAINT sales_meta_fiscal_year_unique
        UNIQUE (fiscal_year_start);

        RAISE NOTICE 'Added unique constraint: sales_meta_fiscal_year_unique';
    ELSE
        RAISE NOTICE 'Unique constraint already exists: sales_meta_fiscal_year_unique';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Fix generate_bill_number() function with row-level locking
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    current_fiscal_year_start DATE;
    new_fiscal_year_start DATE := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day';
    current_bill_no INT;
BEGIN
    -- Use SELECT FOR UPDATE to lock the row and prevent race conditions
    -- This ensures only one transaction can generate a bill number at a time
    SELECT fiscal_year_start, last_bill_no
    INTO current_fiscal_year_start, current_bill_no
    FROM sales_meta
    WHERE fiscal_year_start = new_fiscal_year_start
    FOR UPDATE;  -- 🔒 ROW-LEVEL LOCK - CRITICAL FOR PREVENTING DUPLICATES!

    IF current_fiscal_year_start IS NULL THEN
        -- First sale of new fiscal year
        INSERT INTO sales_meta (fiscal_year_start, last_bill_no)
        VALUES (new_fiscal_year_start, 1)
        RETURNING last_bill_no INTO current_bill_no;

        RETURN current_bill_no;
    ELSIF current_fiscal_year_start < new_fiscal_year_start THEN
        -- New fiscal year has started
        INSERT INTO sales_meta (fiscal_year_start, last_bill_no)
        VALUES (new_fiscal_year_start, 1)
        RETURNING last_bill_no INTO current_bill_no;

        RETURN current_bill_no;
    ELSE
        -- Increment bill number for current fiscal year
        UPDATE sales_meta
        SET last_bill_no = last_bill_no + 1
        WHERE fiscal_year_start = current_fiscal_year_start
        RETURNING last_bill_no INTO current_bill_no;

        RETURN current_bill_no;
    END IF;
END;
$$;

-- ============================================================================
-- STEP 7: Add comment to document the function behavior
-- ============================================================================
COMMENT ON FUNCTION generate_bill_number() IS
'Generates sequential bill numbers per fiscal year with row-level locking to prevent race conditions.
Uses FOR UPDATE to ensure thread-safety in concurrent transactions.';

-- ============================================================================
-- STEP 8: Verification queries
-- ============================================================================
-- Check that all sales have bill numbers
DO $$
DECLARE
    null_count INT;
BEGIN
    SELECT COUNT(*) INTO null_count FROM sale WHERE bill_no IS NULL;

    IF null_count > 0 THEN
        RAISE WARNING 'Found % sales with NULL bill numbers', null_count;
    ELSE
        RAISE NOTICE 'All sales have bill numbers assigned ✓';
    END IF;
END $$;

-- Check for duplicate bill numbers (should be 0)
DO $$
DECLARE
    dup_count INT;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT bill_no, COUNT(*)
        FROM sale
        WHERE bill_no IS NOT NULL
        GROUP BY bill_no
        HAVING COUNT(*) > 1
    ) duplicates;

    IF dup_count > 0 THEN
        RAISE WARNING 'Found % duplicate bill numbers - manual intervention required', dup_count;
    ELSE
        RAISE NOTICE 'No duplicate bill numbers found ✓';
    END IF;
END $$;

-- Check sales_meta initialization
DO $$
DECLARE
    meta_count INT;
BEGIN
    SELECT COUNT(*) INTO meta_count FROM sales_meta;

    IF meta_count = 0 THEN
        RAISE WARNING 'sales_meta table is empty - this should not happen';
    ELSE
        RAISE NOTICE 'sales_meta initialized with % row(s) ✓', meta_count;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================
-- Run these queries after deployment to verify success:

-- 1. Check unique constraints exist
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'sale'::regclass;

-- 2. Check sales_meta has data
-- SELECT * FROM sales_meta ORDER BY fiscal_year_start DESC;

-- 3. Test bill number generation (should return sequential numbers)
-- SELECT generate_bill_number() FROM generate_series(1,5);

-- 4. Check for NULL or duplicate bill numbers
-- SELECT bill_no, COUNT(*) FROM sale GROUP BY bill_no ORDER BY COUNT(*) DESC LIMIT 10;

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================
-- If you need to rollback this migration, use: 002_rollback.sql
