-- Rollback 114: remove the dashboards and compliance setup permission.
UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) p WHERE p->>'resource' <> 'dashsetup')::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "dashsetup")');
