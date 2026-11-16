-- 210 rollback: take the HR actions off every role again (the HR pages go back to the Business Head by name).
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'hr' AND jsonb_typeof(e->'policies') = 'array' THEN
      jsonb_set(e, '{policies}', coalesce((
        SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p
        WHERE p->>'action' NOT IN ('staff.view', 'staff.manage', 'pay.view', 'pay.manage', 'payroll.view', 'payroll.run', 'payroll.approve',
                                   'attendance.manage', 'leave.manage', 'kpi.setup', 'bonus.manage')
      ), '[]'::jsonb))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "hr")');
