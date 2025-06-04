-- DROP FUNCTION public.generate_bill_number();

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
$function$
;

-- DROP FUNCTION public.generate_grn(text);

CREATE OR REPLACE FUNCTION public.generate_grn(text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$select $1||to_char(current_date, 'YYMM')||lpad(nextval('grn_seq')::text,3,'0');$function$
;

-- DROP FUNCTION public.generate_order_number();

CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    order_num INT;
BEGIN
    -- Get the next value from the sequence
    order_num := NEXTVAL('order_number_seq');

    -- Format the order number if necessary (e.g., add prefix or padding)
    -- RETURN 'ORD-' || TO_CHAR(order_num, 'FM0000'); -- Result: ORD-0001, ORD-0002, etc.
	RETURN order_num;
END;
$function$
;

-- DROP FUNCTION public.get_days_diff_stats(int4);

CREATE OR REPLACE FUNCTION public.get_days_diff_stats(customer_id_input integer)
 RETURNS TABLE(days_diff_array integer[], mean_diff numeric, stddev_diff numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Compute the differences and statistics for the last 6 intervals
    RETURN QUERY
    SELECT 
        ARRAY(SELECT diff
              FROM (
                  SELECT EXTRACT(DAY FROM (bill_date - LAG(bill_date) OVER (ORDER BY bill_date desc)))::INTEGER*-1 AS diff
                  FROM sale
                  WHERE customer_id = customer_id_input
                    AND bill_date >= CURRENT_DATE - INTERVAL '1 year'
              ) subquery
              WHERE diff IS NOT NULL
              LIMIT 5) AS days_diff_array,
        AVG(diff) AS mean_diff,
        STDDEV(diff) AS stddev_diff
    FROM (
        SELECT diff
        FROM (
            SELECT EXTRACT(DAY FROM (bill_date - LAG(bill_date) OVER (ORDER BY bill_date desc)))::INTEGER*-1 AS diff
            FROM sale
            WHERE customer_id = customer_id_input
              AND bill_date >= CURRENT_DATE - INTERVAL '1 year'
        ) subquery
        WHERE diff IS NOT NULL
        LIMIT 5
    ) limited_intervals;
END;
$function$
;

-- DROP FUNCTION public.months(bpchar, bpchar);

CREATE OR REPLACE FUNCTION public.months(character, character)
 RETURNS TABLE(mon character)
 LANGUAGE sql
AS $function$ 
--select date(generate_series($2::date,$1::date,'1 month'))
(select date_part('year',a.dt)||'-'||lpad(date_part('month',a.dt)::text,2,'0') as d2 from 
(select date(generate_series($2::date,$1::date,'1 month')) as dt) a)
$function$
;

-- DROP FUNCTION public.months(varchar);

CREATE OR REPLACE FUNCTION public.months(dt character varying)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
    declare 
    	mon integer;
    begin 
  	select ((DATE_PART('year', dt::date) - DATE_PART('year', now())) * 12) +
                (DATE_PART('month', dt::date) - DATE_PART('month', now()) - 1) as mon;
      return mon;
    end;
  $function$
;

-- DROP FUNCTION public.get_returns_gst_report_for_month(int4, int4);

CREATE OR REPLACE FUNCTION public.get_returns_gst_report_for_month(input_year integer, input_month integer)
 RETURNS TABLE(bill_no integer, bill_date date, name character varying, sale_total numeric, cgst_pcnt numeric, cgst_amt numeric, sgst_pcnt numeric, sgst_amt numeric, gst_total numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate the start and end dates for the given month/year
    start_date := DATE(input_year || '-' || LPAD(input_month::TEXT, 2, '0') || '-01');
    end_date := (start_date + INTERVAL '1 month - 1 day')::DATE;
    
    RETURN QUERY
   SELECT * FROM vw_returns_gst_report vw WHERE vw.bill_date BETWEEN start_date and end_date;
END;
$function$
;

-- DROP FUNCTION public.get_returns_gst_summary_for_month(int4, int4);

CREATE OR REPLACE FUNCTION public.get_returns_gst_summary_for_month(input_year integer, input_month integer)
 RETURNS TABLE(cgst_pcnt numeric, cgst_amt numeric, sgst_pcnt numeric, sgst_amt numeric, total_gst_amt numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate the start and end dates for the given month/year
    start_date := DATE(input_year || '-' || LPAD(input_month::TEXT, 2, '0') || '-01');
    end_date := (start_date + INTERVAL '1 month - 1 day')::DATE;
    
    RETURN QUERY
    select x.cgst_pcnt,
	sum(x.cgst_amt) as cgst_amt,
	x.sgst_pcnt,
	sum(x.sgst_amt)as sgst_amt, 
	sum(x.gst_total) as total_gst_amt
	from
	( SELECT * FROM vw_returns_gst_report vw WHERE vw.bill_date BETWEEN start_date and end_date ) x
	group by x.cgst_pcnt, x.sgst_pcnt order by cgst_pcnt;
END;
$function$
;


-- DROP FUNCTION public.get_sales_gst_report_for_month(int4, int4);

CREATE OR REPLACE FUNCTION public.get_sales_gst_report_for_month(input_year integer, input_month integer)
 RETURNS TABLE(bill_no integer, bill_date date, name character varying, sale_total numeric, cgst_pcnt numeric, cgst_amt numeric, sgst_pcnt numeric, sgst_amt numeric, gst_total numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate the start and end dates for the given month/year
    start_date := DATE(input_year || '-' || LPAD(input_month::TEXT, 2, '0') || '-01');
    end_date := (start_date + INTERVAL '1 month - 1 day')::DATE;
    
    RETURN QUERY
   SELECT * FROM vw_sales_gst_report vw WHERE vw.bill_date BETWEEN start_date and end_date;
END;
$function$
;


-- DROP FUNCTION public.get_sales_gst_summary_for_month(int4, int4);

CREATE OR REPLACE FUNCTION public.get_sales_gst_summary_for_month(input_year integer, input_month integer)
 RETURNS TABLE(cgst_pcnt numeric, cgst_amt numeric, sgst_pcnt numeric, sgst_amt numeric, total_gst_amt numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate the start and end dates for the given month/year
    start_date := DATE(input_year || '-' || LPAD(input_month::TEXT, 2, '0') || '-01');
    end_date := (start_date + INTERVAL '1 month - 1 day')::DATE;
    
    RETURN QUERY
    select x.cgst_pcnt,
	sum(x.cgst_amt) as cgst_amt,
	x.sgst_pcnt,
	sum(x.sgst_amt)as sgst_amt, 
	sum(x.gst_total) as total_gst_amt
	from
	( SELECT * FROM vw_sales_gst_report vw WHERE vw.bill_date BETWEEN start_date and end_date ) x
	group by x.cgst_pcnt, x.sgst_pcnt order by cgst_pcnt;
END;
$function$
;