-- rollback of 158
UPDATE public.app_role
SET permissions = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'pricechanges'), '[]'::jsonb)::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "pricechanges")');
