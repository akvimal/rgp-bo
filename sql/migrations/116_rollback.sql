-- Rollback 116: job roles no longer drive KPI.
DELETE FROM public.hr_kpi_band WHERE position_id IS NOT NULL;
DROP INDEX IF EXISTS public.hr_kpi_band_owner_min_uq;
CREATE UNIQUE INDEX IF NOT EXISTS hr_kpi_band_role_min_uq ON public.hr_kpi_band ((coalesce(role_name, '')), min_percent);
ALTER TABLE public.hr_kpi_band DROP CONSTRAINT IF EXISTS hr_kpi_band_owner_chk;
ALTER TABLE public.hr_kpi_band DROP COLUMN IF EXISTS position_id;
ALTER TABLE public.hr_kpi_metric DROP COLUMN IF EXISTS applies_positions;
ALTER TABLE public.hr_position DROP COLUMN IF EXISTS login_role;
