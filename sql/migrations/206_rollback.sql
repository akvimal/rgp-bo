-- rolls back 206: descriptions back to 200 characters (longer ones are cut)
ALTER TABLE public.hr_kpi_metric ALTER COLUMN description TYPE varchar(200) USING left(description, 200);
