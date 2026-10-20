-- 037_notifications_permission.sql
-- Settings > Notifications (Telegram digest admin screen). The backend gate is role-name based
-- (Business Head only; Site Admin is a platform role with no business data), but the front-end nav and
-- route guard read the role's stored permissions JSON, so append a `notifications` resource to that role.

UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"notifications","path":"/secure/settings/notifications","policies":[{"action":"manage"}]}]'::jsonb
)::json
WHERE name = 'Business Head'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "notifications")');

-- an earlier revision of this file also granted it to Site Admin; take it back
UPDATE public.app_role
SET permissions = (
  SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(permissions::jsonb) elem
  WHERE elem->>'resource' <> 'notifications'
)::json
WHERE name = 'Site Admin'
  AND jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "notifications")');
