-- 049_sales_staff_purchase_request.sql
-- Sales Staff raise purchase requests but do not work in purchasing. The purchasing API now checks the `purchases`
-- permission, so give the Sales Staff role a `request` action (create a request only) alongside the read access it
-- already has. Business Head and Store Head are unchanged (they hold add / edit / delete).

UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'purchases' AND NOT (e->'policies' @> '[{"action":"request"}]'::jsonb)
         THEN jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || '[{"action":"request"}]'::jsonb)
         ELSE e END)
  FROM jsonb_array_elements(permissions::jsonb) e
)::json
WHERE name = 'Sales Staff'
  AND jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "purchases")');
