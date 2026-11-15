-- rolls back 207: every manual measure is rated by whoever holds the KPI rating permission again
ALTER TABLE public.hr_kpi_metric DROP COLUMN IF EXISTS rater_positions;
