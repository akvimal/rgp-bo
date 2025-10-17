-- Rollback Migration: Fix Bill Number Race Condition
-- Date: 2025-10-17
-- Phase: 2
-- Description: Rollback to original generate_bill_number() function (without locking)

-- WARNING: Rolling back this change will reintroduce the race condition!
-- Only use this if the new version causes issues in production.

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_bill_number()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_fiscal_year_start DATE;
    new_fiscal_year_start DATE := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day';
    current_bill_no INT;
BEGIN
    -- Check if we are in a new fiscal year
    SELECT fiscal_year_start, last_bill_no INTO current_fiscal_year_start, current_bill_no
    FROM sales_meta
    ORDER BY fiscal_year_start DESC
    LIMIT 1;

    IF current_fiscal_year_start < new_fiscal_year_start THEN
        -- Reset bill number for the new fiscal year
        INSERT INTO sales_meta (fiscal_year_start, last_bill_no) VALUES (new_fiscal_year_start, 1);
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
$function$;

COMMIT;
