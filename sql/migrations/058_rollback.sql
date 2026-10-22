DELETE FROM public.hr_employee WHERE user_id IS NULL;
ALTER TABLE public.hr_employee DROP CONSTRAINT IF EXISTS hr_employee_name_chk;
UPDATE public.hr_employee SET weekly_off = 'SUNDAY' WHERE weekly_off NOT IN ('SUNDAY', 'ROTATION');
ALTER TABLE public.hr_employee DROP CONSTRAINT IF EXISTS hr_employee_off_chk;
ALTER TABLE public.hr_employee ADD CONSTRAINT hr_employee_off_chk CHECK (weekly_off IN ('SUNDAY', 'ROTATION'));
ALTER TABLE public.hr_employee DROP COLUMN IF EXISTS full_name, DROP COLUMN IF EXISTS phone;
