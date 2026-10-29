-- rollback of 108_gst_filing_months.sql
ALTER TABLE public.gst_registration DROP CONSTRAINT IF EXISTS gst_registration_hsn_digits_chk;
ALTER TABLE public.gst_registration DROP COLUMN IF EXISTS hsn_digits;
DROP TABLE IF EXISTS public.gst_filing_month;
