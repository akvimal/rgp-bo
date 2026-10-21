-- 041_discrepancies_permission.sql
-- Staff & Quality > Cash & shifts. API gate is role-name based (Business Head); the nav / route guard
-- read the stored permissions JSON.
UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"discrepancies","path":"/secure/quality/discrepancies","policies":[{"action":"view"}]}]'::jsonb
)::json
WHERE name = 'Business Head'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "discrepancies")');
