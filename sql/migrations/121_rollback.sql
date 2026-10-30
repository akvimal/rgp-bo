UPDATE public.app_role r
   SET permissions = (
     SELECT COALESCE(json_agg(
              CASE WHEN p->>'resource' = 'site'
                   THEN jsonb_set(p, '{path}', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(p->'path') x WHERE x <> '"/secure/settings/users"'::jsonb))
                   ELSE p END) FILTER (WHERE p->>'resource' <> 'users'), '[]'::json)
       FROM jsonb_array_elements(r.permissions::jsonb) p)
 WHERE r.name = 'Store Head' AND r.permissions IS NOT NULL;
