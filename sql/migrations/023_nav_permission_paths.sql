-- 023: add missing nav route paths to role permission blocks.
--
-- The Shifts screen (/secure/store/shifts) and Settings > Delivery Partners
-- (/secure/settings/delivery-partners) shipped without their route paths in any
-- role's stored permissions, so AuthGuard.isUrlAuthorized rejected them and the
-- screens bounced to /login for every user (same class as the AUTH-11/12 fixes).
--
-- This patches every role whose `store` / `purchases` resource has an ARRAY path
-- (Business Head, Store Head) to include the missing sibling routes. Roles with a
-- string path (Sales Staff) are left unchanged.

UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'store'
           AND jsonb_typeof(elem->'path') = 'array'
           AND NOT (elem->'path' @> '["/secure/store/shifts"]'::jsonb)
        THEN jsonb_set(elem, '{path}', (elem->'path') || '["/secure/store/shifts"]'::jsonb)
      WHEN elem->>'resource' = 'purchases'
           AND jsonb_typeof(elem->'path') = 'array'
           AND NOT (elem->'path' @> '["/secure/settings/delivery-partners"]'::jsonb)
        THEN jsonb_set(elem, '{path}', (elem->'path') || '["/secure/settings/delivery-partners"]'::jsonb)
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE jsonb_path_exists(
  permissions::jsonb,
  '$[*] ? (@.resource == "store" || @.resource == "purchases") ? (@.path.type() == "array")'
);
