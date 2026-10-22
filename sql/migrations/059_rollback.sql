ALTER TABLE public.hr_employee DROP CONSTRAINT IF EXISTS hr_employee_hours_chk;
ALTER TABLE public.hr_employee DROP COLUMN IF EXISTS work_days, DROP COLUMN IF EXISTS work_start, DROP COLUMN IF EXISTS work_end;
