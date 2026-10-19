-- 037_notifications_permission.sql
-- Settings > Notifications (Telegram digest admin screen). The backend gate is role-name based
-- (Site Admin / Business Head), but the front-end nav and route guard read the role's stored
-- permissions JSON, so append a `notifications` resource to those two roles.

UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"notifications","path":"/secure/settings/notifications","policies":[{"action":"manage"}]}]'::jsonb
)::json
WHERE name IN ('Site Admin', 'Business Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "notifications")');
