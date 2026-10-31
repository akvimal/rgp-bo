DELETE FROM public.app_setting WHERE setting_key IN ('review_invite_min_amount', 'review_invite_guard_days');
DROP TABLE IF EXISTS public.review_invite;
ALTER TABLE public.customer DROP COLUMN IF EXISTS review_optout;
ALTER TABLE public.stores DROP COLUMN IF EXISTS google_review_url;
