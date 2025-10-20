-- ============================================================================
-- Rollback: 002_rollback.sql
-- Description: Rollback changes from 002_fix_duplicate_bill_numbers.sql
-- Date: 2025-10-20
-- WARNING: This will remove duplicate prevention mechanisms
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Remove unique constraint on bill_no
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sale_bill_no_unique'
        AND conrelid = 'sale'::regclass
    ) THEN
        ALTER TABLE sale
        DROP CONSTRAINT sale_bill_no_unique;

        RAISE NOTICE 'Removed unique constraint: sale_bill_no_unique';
    ELSE
        RAISE NOTICE 'Unique constraint does not exist: sale_bill_no_unique';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Remove unique constraint on sales_meta.fiscal_year_start
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sales_meta_fiscal_year_unique'
        AND conrelid = 'sales_meta'::regclass
    ) THEN
        ALTER TABLE sales_meta
        DROP CONSTRAINT sales_meta_fiscal_year_unique;

        RAISE NOTICE 'Removed unique constraint: sales_meta_fiscal_year_unique';
    ELSE
        RAISE NOTICE 'Unique constraint does not exist: sales_meta_fiscal_year_unique';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Restore original generate_bill_number() function (without locking)
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
    -- Original implementation without FOR UPDATE (has race condition)
    SELECT fiscal_year_start, last_bill_no
    INTO current_fiscal_year_start, current_bill_no
    FROM sales_meta
    ORDER BY fiscal_year_start DESC
    LIMIT 1;

    IF current_fiscal_year_start < new_fiscal_year_start THEN
        -- Reset bill number for the new fiscal year
        INSERT INTO sales_meta (fiscal_year_start, last_bill_no)
        VALUES (new_fiscal_year_start, 1);
        RETURN 1;
    ELSE
        -- Increment bill number for the current fiscal year
        UPDATE sales_meta
        SET last_bill_no = last_bill_no + 1
        WHERE fiscal_year_start = current_fiscal_year_start
        RETURNING last_bill_no INTO current_bill_no;

        RETURN current_bill_no;
    END IF;
END;
$$;

-- ============================================================================
-- STEP 4: Drop temporary sequence
-- ============================================================================
DROP SEQUENCE IF EXISTS temp_bill_seq;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK VERIFICATION
-- ============================================================================
RAISE WARNING 'Rollback complete. Note: The system is now vulnerable to duplicate bill numbers again.';

-- Verify constraints removed
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'sale'::regclass;
