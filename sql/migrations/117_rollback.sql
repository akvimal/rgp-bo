-- Rollback 117: leave types are no longer limited by job role.
ALTER TABLE public.hr_leave_type DROP COLUMN IF EXISTS applies_positions;
