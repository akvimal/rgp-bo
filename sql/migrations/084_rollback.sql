UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(elem), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) elem WHERE elem->>'resource' <> 'alerts')::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "alerts")');
DROP TABLE IF EXISTS public.notification_pref;
DROP TABLE IF EXISTS public.notification_state;
DROP TABLE IF EXISTS public.notification;
DROP TABLE IF EXISTS public.alert_rule;
