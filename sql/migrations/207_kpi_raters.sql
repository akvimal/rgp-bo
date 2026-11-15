-- 207: a manual KPI measure can name the job roles that may rate it (hr_position ids). NULL = as before: anyone whose login role holds the KPI rating permission.
-- The Business Head can always rate. Additive and re-runnable.
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS rater_positions integer[];
