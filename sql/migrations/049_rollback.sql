UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'purchases'
         THEN jsonb_set(e, '{policies}', coalesce((SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p WHERE p->>'action' <> 'request'), '[]'::jsonb))
         ELSE e END)
  FROM jsonb_array_elements(permissions::jsonb) e
)::json
WHERE name = 'Sales Staff';
