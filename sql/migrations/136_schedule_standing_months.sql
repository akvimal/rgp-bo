-- 136: how long a prescription on file, or the last supply's prescriber, can be used again for a repeat supply of a chronic medicine (pharmacy pack).
-- Past it, or for a medicine not marked chronic, the bill's panel asks for a fresh prescription; using the old one anyway is recorded on the register line.
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'pharmacy', 'schedule_standing_months', '6', 'Months a prescription on file can be used again for a repeat supply of a chronic medicine. Past this the counter is asked for a fresh prescription.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'schedule_standing_months');
