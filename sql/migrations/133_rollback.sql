-- rollback of 133: a scheduled drug needs its patient and prescriber again (the setting is gone, and the bill check follows the old rule)
DELETE FROM public.app_setting WHERE setting_key = 'schedule_register_enforce';
