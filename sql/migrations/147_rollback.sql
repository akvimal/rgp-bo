-- rollback of 147
ALTER TABLE public.business DROP COLUMN IF EXISTS login_show_change_password;
