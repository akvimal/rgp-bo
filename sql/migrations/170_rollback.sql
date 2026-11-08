UPDATE public.app_role
SET permissions = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' NOT IN ('attendpunch', 'attendreview')), '[]'::jsonb)::json;
DELETE FROM public.app_setting WHERE setting_key IN ('attendance_photo_days', 'attendance_grace_minutes');
ALTER TABLE public.hr_attendance DROP COLUMN IF EXISTS reviewed_by, DROP COLUMN IF EXISTS reviewed_on, DROP COLUMN IF EXISTS flags;
DROP TABLE IF EXISTS public.hr_punch;
ALTER TABLE public.hr_employee DROP COLUMN IF EXISTS punch_enabled, DROP COLUMN IF EXISTS punch_pin_hash, DROP COLUMN IF EXISTS punch_fails, DROP COLUMN IF EXISTS punch_locked_until;
