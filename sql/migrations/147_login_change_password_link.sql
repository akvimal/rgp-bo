-- 147: the "Change password" link on the sign-in page can be hidden per business, in Settings > Business details.
--   login_show_change_password : show the link (on, as it has been)
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS login_show_change_password boolean NOT NULL DEFAULT true;
