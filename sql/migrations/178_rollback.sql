DROP TABLE IF EXISTS public.ai_cache_event;
DROP TABLE IF EXISTS public.ai_result_cache;
DELETE FROM public.app_setting WHERE setting_key = 'ai.cache_mode';
