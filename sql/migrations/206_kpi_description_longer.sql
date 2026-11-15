-- 206: a KPI measure's description may run to 500 characters (it was 200, which cut the longer descriptions of the starter sets). Re-runnable.
ALTER TABLE public.hr_kpi_metric ALTER COLUMN description TYPE varchar(500);
