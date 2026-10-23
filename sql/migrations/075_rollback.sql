ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_approval_mode_chk;
ALTER TABLE public.stores DROP COLUMN IF EXISTS approval_mode;
ALTER TABLE public.business DROP CONSTRAINT IF EXISTS business_approval_mode_chk;
ALTER TABLE public.business DROP COLUMN IF EXISTS approval_mode;
