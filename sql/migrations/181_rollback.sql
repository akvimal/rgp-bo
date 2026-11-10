-- 181 rollback: the whatsapp permission gets its "settings" action back for roles that had the settings permission, and the settings permission and its page go.
DO $$
DECLARE
  r record;
  perms jsonb;
BEGIN
  FOR r IN
    SELECT id, permissions::jsonb AS p FROM public.app_role
     WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "whatsappsettings")')
  LOOP
    perms := r.p;
    -- whatsapp "settings" action back
    SELECT jsonb_agg(
             CASE WHEN e->>'resource' = 'whatsapp' AND NOT jsonb_path_exists(e, '$.policies[*] ? (@.action == "settings")')
                  THEN jsonb_set(e, '{policies}', (e->'policies') || '[{"action":"settings"}]'::jsonb)
                  ELSE e END)
      INTO perms FROM jsonb_array_elements(perms) e WHERE e->>'resource' <> 'whatsappsettings';
    -- the page leaves the Settings hub
    SELECT jsonb_agg(
             CASE WHEN e->>'resource' = 'settings' AND jsonb_typeof(e->'path') = 'array'
                  THEN jsonb_set(e, '{path}', coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(e->'path') x WHERE x #>> '{}' <> '/secure/settings/whatsapp'), '[]'::jsonb))
                  ELSE e END)
      INTO perms FROM jsonb_array_elements(perms) e;
    UPDATE public.app_role SET permissions = perms::json WHERE id = r.id;
  END LOOP;
END $$;
