ALTER TABLE public.hr_employee DROP CONSTRAINT IF EXISTS hr_employee_relationship_chk;
ALTER TABLE public.hr_employee DROP COLUMN IF EXISTS on_payroll;
ALTER TABLE public.hr_employee DROP COLUMN IF EXISTS relationship;
