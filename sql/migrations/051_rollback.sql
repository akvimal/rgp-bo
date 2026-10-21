UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'customers'
         THEN jsonb_set(e, '{policies}', coalesce((SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p WHERE p->>'action' <> 'delete'), '[]'::jsonb))
         ELSE e END)
  FROM jsonb_array_elements(permissions::jsonb) e
)::json
WHERE name IN ('Business Head', 'Store Head');
