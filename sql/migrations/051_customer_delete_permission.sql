-- 051_customer_delete_permission.sql
-- Deleting a customer (or archiving one that has history) is a manager action. The API checks the role; the list shows
-- the delete icon from the role's stored permissions, so give Business Head and Store Head a `delete` action on `customers`.

UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'customers' AND NOT (e->'policies' @> '[{"action":"delete"}]'::jsonb)
         THEN jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || '[{"action":"delete"}]'::jsonb)
         ELSE e END)
  FROM jsonb_array_elements(permissions::jsonb) e
)::json
WHERE name IN ('Business Head', 'Store Head')
  AND jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "customers")');
