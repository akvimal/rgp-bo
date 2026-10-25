-- rollback of 104_pharmacy_drug_register.sql
DROP TABLE IF EXISTS public.schedule_register;
DROP TABLE IF EXISTS public.prescriber;
ALTER TABLE public.business DROP COLUMN IF EXISTS business_type;
UPDATE public.app_role SET permissions = (SELECT coalesce(json_agg(e), '[]'::json) FROM json_array_elements(permissions) e WHERE e->>'resource' <> 'scheduleregister')
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "scheduleregister")');
DELETE FROM public.app_setting WHERE setting_key IN ('schedule_register_required', 'schedule_register_from');
