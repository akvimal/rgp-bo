-- 039_staff_sales_permission.sql
-- Staff & Quality > Staff sales. The API gate is role-name based (Business Head); the front-end nav and
-- route guard read the role's stored permissions JSON, so append a `staffsales` resource.

UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"staffsales","path":"/secure/quality/staff-sales","policies":[{"action":"view"}]}]'::jsonb
)::json
WHERE name = 'Business Head'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "staffsales")');
