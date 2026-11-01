-- 144: two-step sign-in with an authenticator app (TOTP). When MFA is required, every login links an authenticator at its next sign-in.
--   mfa_enabled        : the person has an authenticator linked and confirmed
--   mfa_secret         : the shared secret, encrypted by the app (never plain text)
--   mfa_pending_secret : a secret shown during set-up, not yet confirmed with a code
--   mfa_last_step      : the 30-second step of the last accepted code, so one code cannot be used twice
--   mfa_failed_count / mfa_locked_until : wrong codes in a row, and the time sign-in is paused until
--   mfa_recovery       : hashes of the single-use recovery codes still unused (json array)
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_secret text;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_pending_secret text;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_last_step bigint;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_failed_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_locked_until timestamp;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamp;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS mfa_recovery jsonb NOT NULL DEFAULT '[]'::jsonb;
