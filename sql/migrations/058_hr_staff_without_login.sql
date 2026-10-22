-- 058_hr_staff_without_login.sql
-- Staff who have no login: the staff record carries its own name and phone (a login, when there is one, still wins for
-- the sign-in details). The weekly off can now be any day of the week, or a rotation marked in attendance.

ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS full_name varchar(80);
ALTER TABLE public.hr_employee ADD COLUMN IF NOT EXISTS phone varchar(20);

ALTER TABLE public.hr_employee DROP CONSTRAINT IF EXISTS hr_employee_off_chk;
ALTER TABLE public.hr_employee ALTER COLUMN weekly_off TYPE varchar(10);
ALTER TABLE public.hr_employee ADD CONSTRAINT hr_employee_off_chk
  CHECK (weekly_off IN ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'ROTATION'));

-- every record needs a name from one place or the other
ALTER TABLE public.hr_employee DROP CONSTRAINT IF EXISTS hr_employee_name_chk;
ALTER TABLE public.hr_employee ADD CONSTRAINT hr_employee_name_chk CHECK (user_id IS NOT NULL OR full_name IS NOT NULL);
