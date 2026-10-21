DROP INDEX IF EXISTS public.customer_alt_mobile_idx;
ALTER TABLE public.customer DROP CONSTRAINT IF EXISTS customer_alt_mobile_chk;
ALTER TABLE public.customer DROP COLUMN IF EXISTS alt_mobile;
