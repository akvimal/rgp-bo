-- 188: the till bills the purchase (batch) GST unless a dated rate change says otherwise (GST > Rate changes: product, HSN, category or all products, from
-- its effective date). Migrations 096/106 had seeded one "all products" cap of 5% (GST 2.0) that lowered every line below the purchase GST. That seeded
-- default is cancelled; rate changes entered by hand are left as they are. Safe to run twice.
UPDATE public.gst_rate_change
   SET cancelled_on = now()
 WHERE scope_type = 'all' AND mode = 'cap' AND cancelled_on IS NULL
   AND note = 'GST 2.0: no line is billed above this rate (from the old setting pricing/sale_gst_cap_pct)';
