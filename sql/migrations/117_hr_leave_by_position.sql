-- 117: Leave types can be for a job role.
--  * hr_leave_type.applies_positions: the job roles a leave type is for (empty = every job role). It adds to the login-role limit, it does not replace it.
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS applies_positions int4[];
