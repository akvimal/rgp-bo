DELETE FROM public.app_setting WHERE setting_key IN ('price_step_pct', 'price_step_mrp_pct', 'price_step_days', 'price_store_head_limit_pct');
DROP TABLE IF EXISTS public.price_exception;
DROP TABLE IF EXISTS public.price_policy;
