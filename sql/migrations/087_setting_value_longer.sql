-- 087: a setting can hold a few lines of text (the purchase order terms), so its value is allowed to be longer.
ALTER TABLE public.app_setting ALTER COLUMN setting_value TYPE varchar(2000);
