-- 073: the Transfers screen (/secure/store/transfers) was never in any role's stored permissions, so AuthGuard bounced it to /login.
-- Adds the path to every role whose store resource has an array path (same fix as 023 for Shifts).

UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'store'
           AND jsonb_typeof(elem->'path') = 'array'
           AND jsonb_array_length(elem->'path') > 0
           AND NOT (elem->'path' @> '["/secure/store/transfers"]'::jsonb)
        THEN jsonb_set(elem, '{path}', (elem->'path') || '["/secure/store/transfers"]'::jsonb)
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "store") ? (@.path.type() == "array")');
