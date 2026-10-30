DROP TABLE IF EXISTS public.hr_statutory;
ALTER TABLE public.business DROP CONSTRAINT IF EXISTS business_legal_form_chk;
ALTER TABLE public.business DROP COLUMN IF EXISTS legal_form;
