-- 060_hr_kpi_sources.sql
-- KPI measures can be measured by the system (voided bills, cash variance, grievances, absence, sales) or rated by hand by
-- a manager. A system measure turns a raw figure into points with a rule (steps or a linear target/floor). A manual
-- measure is rated 1..rating_scale per person per month. A measure can be limited to some staff types / designations; one
-- that does not apply, or has too little activity to judge, drops out of that person's maximum. Scores can be overridden
-- with a reason. A review row (hr_kpi_review) is the finalised, frozen result that payroll reads.
-- Permissions: `kpirate` (Store Head, Business Head) to rate the manual measures; `mykpi` (everyone with a staff record)
-- to see one's own finalised scores.

ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS source varchar(6) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS system_key varchar(30);
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS rule jsonb;
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS min_activity int4 NOT NULL DEFAULT 0;
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS rating_scale int2 NOT NULL DEFAULT 5;
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS applies_types varchar(10)[];
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS applies_designations text[];
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS applies_roles text[];            -- app_role names (Sales Staff, Store Head ...); empty = every role
ALTER TABLE public.hr_kpi_metric DROP CONSTRAINT IF EXISTS hr_kpi_metric_source_chk;
ALTER TABLE public.hr_kpi_metric ADD CONSTRAINT hr_kpi_metric_source_chk CHECK (source IN ('MANUAL', 'SYSTEM'));
ALTER TABLE public.hr_kpi_metric DROP CONSTRAINT IF EXISTS hr_kpi_metric_scale_chk;
ALTER TABLE public.hr_kpi_metric ADD CONSTRAINT hr_kpi_metric_scale_chk CHECK (rating_scale BETWEEN 2 AND 10);

-- Role-specific setup: pay components, leave types, KPI measures and KPI bands can be limited to some roles (holidays are
-- shared by everyone). An empty list means every role. Bands are a set per role; a role with no set of its own uses the
-- default set (role_name null).
ALTER TABLE public.hr_pay_component ADD COLUMN IF NOT EXISTS applies_roles text[];
ALTER TABLE public.hr_leave_type ADD COLUMN IF NOT EXISTS applies_roles text[];
ALTER TABLE public.hr_kpi_band ADD COLUMN IF NOT EXISTS role_name varchar(60);
ALTER TABLE public.hr_kpi_band DROP CONSTRAINT IF EXISTS hr_kpi_band_min_percent_key;
CREATE UNIQUE INDEX IF NOT EXISTS hr_kpi_band_role_min_uq ON public.hr_kpi_band ((coalesce(role_name, '')), min_percent);

CREATE TABLE IF NOT EXISTS public.hr_kpi_rating (
  id              serial PRIMARY KEY,
  employee_id     int4 NOT NULL REFERENCES public.hr_employee(id),
  period          char(7) NOT NULL,
  metric_id       int4 NOT NULL REFERENCES public.hr_kpi_metric(id),
  rating          numeric(3,1),                       -- manual measure: 1..rating_scale
  override_points numeric(5,1),                       -- any measure: replaces the computed points
  override_reason varchar(200),
  note            varchar(200),
  rated_by        int4,
  rated_on        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period, metric_id)
);

UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"kpirate","path":"/secure/kpi/rate","policies":[{"action":"rate"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Store Head') AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "kpirate")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"mykpi","path":"/secure/kpi/mine","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff') AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "mykpi")');
