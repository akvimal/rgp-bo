DROP INDEX IF EXISTS public.idx_app_user_business_id;

ALTER TABLE public.app_user
  DROP COLUMN IF EXISTS business_id;
