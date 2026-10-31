DELETE FROM public.app_setting WHERE setting_key = 'customer_lookup_limit_hour';
DROP TABLE IF EXISTS public.customer_access;
