-- Rollback 115: remove job roles and their pay structures.
ALTER TABLE public.hr_employee DROP COLUMN IF EXISTS position_id;
DROP TABLE IF EXISTS public.hr_position_line;
DROP TABLE IF EXISTS public.hr_position;
