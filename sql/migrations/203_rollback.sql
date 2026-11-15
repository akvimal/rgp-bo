-- gates must be removed first: a metric with no points cannot go back under "above zero"
DELETE FROM public.hr_kpi_rating WHERE metric_id IN (SELECT id FROM public.hr_kpi_metric WHERE is_gate);
DELETE FROM public.hr_kpi_metric WHERE is_gate;
ALTER TABLE public.hr_kpi_metric DROP CONSTRAINT IF EXISTS hr_kpi_metric_max_points_chk;
ALTER TABLE public.hr_kpi_metric ADD CONSTRAINT hr_kpi_metric_max_points_check CHECK (max_points > 0);
ALTER TABLE public.hr_kpi_metric DROP COLUMN IF EXISTS is_gate;
