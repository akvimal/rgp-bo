-- Rollback of 236: the counter guide cards go (the starter cards can be added again), and the permission group is taken off the roles.
DROP TABLE IF EXISTS public.guide_option;
DROP TABLE IF EXISTS public.guide_warning;
DROP TABLE IF EXISTS public.guide_card;
UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'counterguide')::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "counterguide")');
