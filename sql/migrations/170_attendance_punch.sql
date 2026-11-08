-- Attendance by punching at a registered store PC: PIN + webcam photo, a manager reviews each day, payroll waits for the review.
--  * hr_employee: who punches (punch_enabled), the PIN (hashed), and a lock after wrong PINs
--  * hr_punch: every In/Out with its photo (the photo is deleted after the retention days; the time stays)
--  * hr_attendance gets who reviewed it and when; verification_status PENDING -> VERIFIED / CORRECTED
--  * two permissions: attendpunch.use (the punch screen) and attendreview.view/decide (the review and the PINs)
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS punch_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS punch_pin_hash varchar(80);
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS punch_fails int4 NOT NULL DEFAULT 0;
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS punch_locked_until timestamptz;

CREATE TABLE IF NOT EXISTS public.hr_punch (
  id          serial PRIMARY KEY,
  employee_id int4 NOT NULL REFERENCES public.hr_employee(id),
  store_id    int4,
  device_id   int4,
  kind        varchar(3) NOT NULL,
  punched_at  timestamptz NOT NULL DEFAULT now(),
  att_date    date NOT NULL,                       -- the local (India) day it counts for
  photo_path  varchar(300),
  flags       varchar(12)[] NOT NULL DEFAULT '{}', -- LATE, EARLY_OUT
  CONSTRAINT hr_punch_kind_chk CHECK (kind IN ('IN', 'OUT'))
);
CREATE INDEX IF NOT EXISTS hr_punch_emp_day_idx ON public.hr_punch (employee_id, att_date, punched_at);
CREATE INDEX IF NOT EXISTS hr_punch_photo_idx ON public.hr_punch (punched_at) WHERE photo_path IS NOT NULL;

ALTER TABLE public.hr_attendance ADD COLUMN IF NOT EXISTS reviewed_by int4;
ALTER TABLE public.hr_attendance ADD COLUMN IF NOT EXISTS reviewed_on timestamptz;
ALTER TABLE public.hr_attendance ADD COLUMN IF NOT EXISTS flags varchar(12)[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS hr_attendance_pending_idx ON public.hr_attendance (att_date) WHERE verification_status = 'PENDING';

-- how long a photo is kept (days); the nightly job removes older ones
INSERT INTO public.app_setting (category, setting_key, setting_value, created_by, updated_by)
SELECT 'hr', 'attendance_photo_days', '60', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'attendance_photo_days');
-- minutes after the shift start (or before its end) that still count as on time
INSERT INTO public.app_setting (category, setting_key, setting_value, created_by, updated_by)
SELECT 'hr', 'attendance_grace_minutes', '10', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'attendance_grace_minutes');

-- the punch screen: the store PC's Counter login and store heads
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"attendpunch","path":"/secure/attendance-punch","policies":[{"action":"use"}]}]'::jsonb)::json
WHERE name IN ('Counter', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "attendpunch")');
-- the review: Business Head, Owner-operator and Store Head (their own stores, never their own days)
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"attendreview","path":"/secure/attendance-review","policies":[{"action":"view"},{"action":"decide"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "attendreview")');
