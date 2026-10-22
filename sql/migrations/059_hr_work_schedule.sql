-- 059_hr_work_schedule.sql
-- Part-time staff: the days they work and their usual hours. Days outside work_days are off days (not leave, not
-- absence); the hours are shown in the attendance grid and are what late arrival will be judged against once the staff
-- app records check-in times. Full-time staff keep using weekly_off.

ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS work_days varchar(10)[];
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS work_start time;
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS work_end time;

ALTER TABLE public.hr_employee DROP CONSTRAINT IF EXISTS hr_employee_hours_chk;
ALTER TABLE public.hr_employee ADD CONSTRAINT hr_employee_hours_chk
  CHECK ((work_start IS NULL AND work_end IS NULL) OR (work_start IS NOT NULL AND work_end IS NOT NULL AND work_end > work_start));
