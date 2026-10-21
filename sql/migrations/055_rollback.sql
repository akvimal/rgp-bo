UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'hr')::json
WHERE name = 'Business Head';
DROP TABLE IF EXISTS public.hr_payroll_line, public.hr_payroll_run, public.hr_kpi_review, public.hr_kpi_band, public.hr_kpi_metric,
  public.hr_attendance, public.hr_leave_day, public.hr_leave_request, public.hr_holiday, public.hr_leave_type,
  public.hr_salary_revision_line, public.hr_salary_revision, public.hr_pay_component, public.hr_employee;
