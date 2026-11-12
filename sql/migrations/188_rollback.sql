-- 188 rollback: the seeded "all products" 5% cap is back in force.
UPDATE public.gst_rate_change SET cancelled_on = NULL
 WHERE scope_type = 'all' AND mode = 'cap' AND cancelled_on IS NOT NULL
   AND note = 'GST 2.0: no line is billed above this rate (from the old setting pricing/sale_gst_cap_pct)';
