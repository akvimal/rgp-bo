-- rollback of 137: the January-only function of migration 002 comes back (the counter rows stay as they are)
DROP FUNCTION IF EXISTS public.generate_bill_number(date);
CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    current_fiscal_year_start DATE;
    new_fiscal_year_start DATE := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day';
    current_bill_no INT;
BEGIN
    SELECT fiscal_year_start, last_bill_no INTO current_fiscal_year_start, current_bill_no
      FROM sales_meta WHERE fiscal_year_start = new_fiscal_year_start FOR UPDATE;
    IF current_fiscal_year_start IS NULL THEN
        INSERT INTO sales_meta (fiscal_year_start, last_bill_no) VALUES (new_fiscal_year_start, 1) RETURNING last_bill_no INTO current_bill_no;
    ELSE
        UPDATE sales_meta SET last_bill_no = last_bill_no + 1 WHERE fiscal_year_start = current_fiscal_year_start RETURNING last_bill_no INTO current_bill_no;
    END IF;
    RETURN current_bill_no;
END;
$$;
ALTER TABLE public.sales_meta DROP COLUMN IF EXISTS touched_on;
DELETE FROM public.app_setting WHERE setting_key = 'bill_no_cycle';
