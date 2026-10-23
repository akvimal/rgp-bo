-- values longer than 400 characters must be shortened first
ALTER TABLE public.app_setting ALTER COLUMN setting_value TYPE varchar(400);
