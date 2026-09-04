-- 025_rollback.sql

-- remove the shift.open / shift.close policies from every store block
UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'store' THEN jsonb_set(
        elem, '{policies}',
        coalesce((
          SELECT jsonb_agg(p)
          FROM jsonb_array_elements(coalesce(elem->'policies', '[]'::jsonb)) p
          WHERE p->>'action' NOT IN ('shift.open', 'shift.close')
        ), '[]'::jsonb)
      )
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "store")');

-- drop the store block that only carries the shift actions (Sales Staff)
UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(elem)::json
  FROM jsonb_array_elements(permissions::jsonb) elem
  WHERE NOT (
    elem->>'resource' = 'store'
    AND coalesce(elem->'policies', '[]'::jsonb) = '[]'::jsonb
  )
)
WHERE name = 'Sales Staff';
