DROP TABLE IF EXISTS public.hr_employee_account;
DELETE FROM public.app_role WHERE name IN ('Owner-operator', 'Counter', 'Personal') AND NOT EXISTS (SELECT 1 FROM public.app_user u WHERE u.role_id = app_role.id);
