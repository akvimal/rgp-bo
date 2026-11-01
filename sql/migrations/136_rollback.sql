-- rollback of 136
DELETE FROM public.app_setting WHERE setting_key = 'schedule_standing_months';
