-- the new Pricing addresses leave the roles (the old ones were never removed)
UPDATE public.app_role r SET permissions = (
  SELECT jsonb_agg(
           CASE
             WHEN e->>'resource' IN ('products', 'pricechanges') AND jsonb_typeof(e->'path') = 'array'
               THEN jsonb_set(e, '{path}', coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(e->'path') x WHERE (x #>> '{}') NOT LIKE '/secure/pricing/%'), '[]'::jsonb))
             ELSE e
           END)
    FROM jsonb_array_elements(r.permissions::jsonb) e)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "products" || @.resource == "pricechanges")');
