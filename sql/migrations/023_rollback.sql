-- Rollback 023: remove the nav route paths added to role permission blocks.

UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'store' AND jsonb_typeof(elem->'path') = 'array'
        THEN jsonb_set(elem, '{path}', (elem->'path') - '/secure/store/shifts')
      WHEN elem->>'resource' = 'purchases' AND jsonb_typeof(elem->'path') = 'array'
        THEN jsonb_set(elem, '{path}', (elem->'path') - '/secure/settings/delivery-partners')
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE jsonb_path_exists(
  permissions::jsonb,
  '$[*] ? (@.resource == "store" || @.resource == "purchases") ? (@.path.type() == "array")'
);
