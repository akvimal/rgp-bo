-- 188 rollback: no name suffix, no footer templates.
ALTER TABLE public.business DROP CONSTRAINT IF EXISTS business_name_suffix_chk;
ALTER TABLE public.stores DROP COLUMN IF EXISTS bill_footer;
ALTER TABLE public.business DROP COLUMN IF EXISTS bill_footer;
ALTER TABLE public.business DROP COLUMN IF EXISTS name_suffix;
