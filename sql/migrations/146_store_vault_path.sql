-- 146: the Vault screen (/secure/store/vault) is added to every role whose store resource has a list of paths (same fix as 023 for Shifts and 073 for Transfers).
-- The screen itself only works for a Store Head or Business Head: the API refuses everyone else, and the Vault tab shows only in a store that keeps a vault.

UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'store'
           AND jsonb_typeof(elem->'path') = 'array'
           AND jsonb_array_length(elem->'path') > 0
           AND NOT (elem->'path' @> '["/secure/store/vault"]'::jsonb)
        THEN jsonb_set(elem, '{path}', (elem->'path') || '["/secure/store/vault"]'::jsonb)
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "store") ? (@.path.type() == "array")');
