ALTER TABLE public.app_user
  ADD COLUMN IF NOT EXISTS business_id integer NULL REFERENCES public.business(id);

CREATE INDEX IF NOT EXISTS idx_app_user_business_id ON public.app_user(business_id);

-- Backfill: existing Business Head users (role_id = 1) default to the first business
-- so pre-existing accounts aren't left unlinked after this migration.
UPDATE public.app_user
SET business_id = (SELECT id FROM public.business ORDER BY id ASC LIMIT 1)
WHERE role_id = 1 AND business_id IS NULL;
