-- 116: Job roles drive KPI (HR > Setup).
--  * hr_kpi_metric.applies_positions: the job roles a measure is for (empty = every job role). It adds to the login-role and designation limits, it does not replace them.
--  * hr_kpi_band.position_id: a job role's own incentive band set. A person gets their job role's set, else their login role's set, else the default set.
--    A band row belongs to a job role or to a login role, never both.
--  * hr_position.login_role: the login role this job role usually has, a hint when a login or a staff record is created (permissions are never changed by it).
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS applies_positions int4[];
ALTER TABLE public.hr_kpi_band ADD COLUMN IF NOT EXISTS position_id int4 REFERENCES public.hr_position(id) ON DELETE CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_kpi_band_owner_chk') THEN
    ALTER TABLE public.hr_kpi_band ADD CONSTRAINT hr_kpi_band_owner_chk CHECK (role_name IS NULL OR position_id IS NULL);
  END IF;
END $$;
DROP INDEX IF EXISTS public.hr_kpi_band_role_min_uq;
CREATE UNIQUE INDEX IF NOT EXISTS hr_kpi_band_owner_min_uq ON public.hr_kpi_band ((coalesce(role_name, '')), (coalesce(position_id, 0)), min_percent);
ALTER TABLE public.hr_position ADD COLUMN IF NOT EXISTS login_role varchar(60);
