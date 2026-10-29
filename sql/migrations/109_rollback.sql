-- Rollback 109: remove the dashboard path from Sales Staff, Counter and Personal.
UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'site' AND jsonb_typeof(elem->'path') = 'array'
        THEN jsonb_set(elem, '{path}', (elem->'path') - '/secure/dashboard')
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE name IN ('Sales Staff', 'Counter', 'Personal');
