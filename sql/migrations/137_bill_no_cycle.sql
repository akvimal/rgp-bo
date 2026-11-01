-- 137: the bill number restarts at 1 every January (JAN, as before) or every April (APR, the financial year), by the setting bill_no_cycle.
--
-- Until now the counter key was 31 March of the CURRENT CALENDAR year, so it changed only on 1 January whatever the name "fiscal year" suggested.
-- The key stays exactly that for JAN, so existing counters carry on. For APR the key is the 1 April that began the financial year.
--
-- Switching the cycle must never repeat a number already issued. When a counter row is created, or used again after another one was used, it first
-- catches up with the highest bill number already issued since the start of its period (the first bill after switching January -> April in November
-- carries on from the January counter instead of starting at 1; the next 1 April then restarts at 1).
-- A day can be passed (generate_bill_number('2027-04-01')) to see what a date would give; no argument means today.

INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'sales', 'bill_no_cycle', 'JAN', 'When the bill number restarts at 1: JAN = every 1 January, APR = every 1 April (the financial year). Switching never repeats a number already issued.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'bill_no_cycle');

-- which counter was used last (the one in use now); the others are stale until they are used again
ALTER TABLE public.sales_meta ADD COLUMN IF NOT EXISTS touched_on timestamptz NOT NULL DEFAULT now();
UPDATE public.sales_meta SET touched_on = '2000-01-01';
UPDATE public.sales_meta SET touched_on = now() WHERE id = (SELECT id FROM public.sales_meta ORDER BY fiscal_year_start DESC LIMIT 1);

DROP FUNCTION IF EXISTS public.generate_bill_number();

CREATE OR REPLACE FUNCTION public.generate_bill_number(p_day date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    cycle_value text;
    period_start date;
    counter_key date;
    counter public.sales_meta%ROWTYPE;
    latest_id integer;
    issued integer;
    next_no integer;
BEGIN
    SELECT upper(btrim(setting_value)) INTO cycle_value
      FROM public.app_setting WHERE setting_key = 'bill_no_cycle' AND active AND NOT archive LIMIT 1;

    IF cycle_value LIKE 'A%' THEN                      -- APR (or April): the financial year begins on 1 April
        period_start := make_date(extract(year FROM p_day)::int - CASE WHEN extract(month FROM p_day) < 4 THEN 1 ELSE 0 END, 4, 1);
        counter_key := period_start;
    ELSE                                               -- JAN: the key the counter has always used
        period_start := date_trunc('year', p_day)::date;
        counter_key := (period_start + INTERVAL '3 months' - INTERVAL '1 day')::date;
    END IF;

    -- one bill number is issued at a time (held until the bill's transaction ends, as the old row lock was)
    PERFORM pg_advisory_xact_lock(hashtext('bill_no_counter'));

    SELECT * INTO counter FROM public.sales_meta WHERE fiscal_year_start = counter_key;

    IF NOT FOUND THEN
        SELECT COALESCE(MAX(bill_no), 0) INTO issued FROM public.sale WHERE bill_date >= period_start;
        INSERT INTO public.sales_meta (fiscal_year_start, last_bill_no, touched_on) VALUES (counter_key, issued + 1, now())
        RETURNING last_bill_no INTO next_no;
        RETURN next_no;
    END IF;

    SELECT id INTO latest_id FROM public.sales_meta ORDER BY touched_on DESC, id DESC LIMIT 1;
    IF counter.id <> latest_id THEN                    -- the cycle was switched since this counter was last used: catch up with what was issued meanwhile
        SELECT COALESCE(MAX(bill_no), 0) INTO issued FROM public.sale WHERE bill_date >= period_start;
        UPDATE public.sales_meta SET last_bill_no = GREATEST(last_bill_no, issued) + 1, touched_on = now() WHERE id = counter.id RETURNING last_bill_no INTO next_no;
    ELSE
        UPDATE public.sales_meta SET last_bill_no = last_bill_no + 1, touched_on = now() WHERE id = counter.id RETURNING last_bill_no INTO next_no;
    END IF;
    RETURN next_no;
END;
$$;

COMMENT ON FUNCTION public.generate_bill_number(date) IS
'The next bill number. It restarts at 1 every January or April by the setting bill_no_cycle (JAN or APR); a counter catches up with the numbers already issued in its period when it is created or used again after another counter, so switching never repeats a number.';
