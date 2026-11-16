-- 210: the HR permission gets one action per area (MENU_AND_PERMISSIONS step D, HR).
-- The HR API let in only the role named Business Head and ignored the `hr` view and manage boxes of the role editor. Now each route needs an action:
--   staff.view, staff.manage, pay.view, pay.manage, payroll.view, payroll.run, payroll.approve, attendance.manage, leave.manage, kpi.setup, bonus.manage
-- Only the owner roles (Business Head, Owner-operator) get them, wherever they already hold the HR page. A custom role whose `hr` boxes were ticked
-- gets nothing new: those boxes never opened the API, so granting actions for them would newly expose salaries. The owner grants actions in the role editor.
-- Rollback: 210_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'hr' THEN
      jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
        FROM unnest(ARRAY['staff.view', 'staff.manage', 'pay.view', 'pay.manage', 'payroll.view', 'payroll.run', 'payroll.approve',
                          'attendance.manage', 'leave.manage', 'kpi.setup', 'bonus.manage']) AS a
        WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
      ))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE r.name IN ('Business Head', 'Owner-operator')
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "hr")');
