-- rollback of 134: the setting goes back to the yes/no of migration 133
UPDATE public.app_setting SET setting_value = 'no' WHERE setting_key = 'schedule_register_enforce' AND setting_value = 'H1,X';
