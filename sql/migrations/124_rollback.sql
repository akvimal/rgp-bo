DELETE FROM public.app_setting WHERE setting_key = 'customer_reveal_limit';
DROP TABLE IF EXISTS public.customer_reveal;
