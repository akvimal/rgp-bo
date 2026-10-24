UPDATE public.app_role SET permissions = (SELECT coalesce(json_agg(e), '[]'::json) FROM json_array_elements(permissions) e WHERE e->>'resource' <> 'outage')
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "outage")');
DROP TABLE IF EXISTS public.outage_event;
DROP TABLE IF EXISTS public.outage_readiness_log;
