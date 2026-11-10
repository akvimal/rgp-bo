-- 181: the WhatsApp number, token and switches are setup, so they get their own permission, "whatsappsettings" (manage), and their own page under
-- Settings (/secure/settings/whatsapp), like Notifications and Alerts. The "whatsapp" permission keeps to sending a bill and reading the log.
-- Roles that had whatsapp "settings" (Business Head, from migration 180) get the new permission, lose the old action, and have the page added to the
-- Settings hub so the Settings menu opens it. Safe to run twice.
DO $$
DECLARE
  r record;
  perms jsonb;
BEGIN
  FOR r IN
    SELECT id, permissions::jsonb AS p FROM public.app_role
     WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "whatsapp").policies[*] ? (@.action == "settings")')
  LOOP
    perms := r.p;

    -- the old action leaves the whatsapp permission
    SELECT jsonb_agg(
             CASE WHEN e->>'resource' = 'whatsapp'
                  THEN jsonb_set(e, '{policies}', coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(e->'policies') x WHERE x->>'action' <> 'settings'), '[]'::jsonb))
                  ELSE e END)
      INTO perms FROM jsonb_array_elements(perms) e;

    IF NOT jsonb_path_exists(perms, '$[*] ? (@.resource == "whatsappsettings")') THEN
      perms := perms || '[{"resource":"whatsappsettings","path":"/secure/settings/whatsapp","policies":[{"action":"manage"}]}]'::jsonb;
    END IF;

    -- the Settings hub lists the settings pages the role may open
    IF jsonb_path_exists(perms, '$[*] ? (@.resource == "settings")') THEN
      SELECT jsonb_agg(
               CASE WHEN e->>'resource' = 'settings' AND NOT (CASE WHEN jsonb_typeof(e->'path') = 'array' THEN e->'path' ELSE jsonb_build_array(e->'path') END) @> '"/secure/settings/whatsapp"'::jsonb
                    THEN jsonb_set(e, '{path}', (CASE WHEN jsonb_typeof(e->'path') = 'array' THEN e->'path' ELSE jsonb_build_array(e->'path') END) || '"/secure/settings/whatsapp"'::jsonb)
                    ELSE e END)
        INTO perms FROM jsonb_array_elements(perms) e;
    ELSE
      perms := perms || '[{"resource":"settings","path":["/secure/settings/whatsapp"],"data":"all","policies":[{"action":"read","properties":[]},{"action":"view","properties":[]},{"action":"add","path":"/new","properties":[]}]}]'::jsonb;
    END IF;

    UPDATE public.app_role SET permissions = perms::json WHERE id = r.id;
  END LOOP;
END $$;
