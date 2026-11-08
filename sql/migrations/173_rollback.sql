DROP TABLE IF EXISTS public.hr_coaching_note;
DROP TABLE IF EXISTS public.weekly_summary;
DELETE FROM public.app_setting WHERE setting_key IN ('insights.weekly_telegram', 'followup.templates');
