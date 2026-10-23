ALTER TABLE public.business DROP CONSTRAINT IF EXISTS business_staffing_preset_chk;
ALTER TABLE public.business DROP COLUMN IF EXISTS staffing_preset;
