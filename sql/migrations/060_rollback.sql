UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' NOT IN ('kpirate', 'mykpi'))::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff');
DROP TABLE IF EXISTS public.hr_kpi_rating;
DELETE FROM public.hr_kpi_band WHERE role_name IS NOT NULL;
DROP INDEX IF EXISTS public.hr_kpi_band_role_min_uq;
ALTER TABLE public.hr_kpi_band ADD CONSTRAINT hr_kpi_band_min_percent_key UNIQUE (min_percent);
ALTER TABLE public.hr_kpi_band DROP COLUMN IF EXISTS role_name;
ALTER TABLE public.hr_leave_type DROP COLUMN IF EXISTS applies_roles;
ALTER TABLE public.hr_pay_component DROP COLUMN IF EXISTS applies_roles;
ALTER TABLE public.hr_kpi_metric DROP CONSTRAINT IF EXISTS hr_kpi_metric_source_chk, DROP CONSTRAINT IF EXISTS hr_kpi_metric_scale_chk;
ALTER TABLE public.hr_kpi_metric DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS system_key, DROP COLUMN IF EXISTS rule,
  DROP COLUMN IF EXISTS min_activity, DROP COLUMN IF EXISTS rating_scale, DROP COLUMN IF EXISTS applies_types, DROP COLUMN IF EXISTS applies_designations, DROP COLUMN IF EXISTS applies_roles;
