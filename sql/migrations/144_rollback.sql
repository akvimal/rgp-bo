-- rollback of 144
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_enabled;
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_secret;
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_pending_secret;
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_last_step;
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_failed_count;
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_locked_until;
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_enrolled_at;
ALTER TABLE public.app_user DROP COLUMN IF EXISTS mfa_recovery;
