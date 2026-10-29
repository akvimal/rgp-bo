-- 109: let Sales Staff, Counter and Personal open the dashboard (/secure/dashboard). Each gets its own role view
-- (DASHBOARD_AND_MENU_DESIGN 3.1); the API already scopes data by business and store. Apply WITH the role views
-- (the Staff, Counter and Personal views, built in stage 3).
UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'site'
           AND jsonb_typeof(elem->'path') = 'array'
           AND NOT (elem->'path' @> '["/secure/dashboard"]'::jsonb)
        THEN jsonb_set(elem, '{path}', (elem->'path') || '["/secure/dashboard"]'::jsonb)
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE name IN ('Sales Staff', 'Counter', 'Personal');
