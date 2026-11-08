DROP TABLE IF EXISTS public.ai_usage;
DELETE FROM public.app_setting WHERE setting_key = 'ai.monthly_limit';
