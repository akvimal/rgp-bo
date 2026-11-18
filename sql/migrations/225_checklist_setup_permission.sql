-- 225: setting up checklists and the system's recurring tasks is admin work, so it gets its own permission, "checklistsetup" (manage), and its own
-- page under Settings (/secure/settings/checklists), like Alerts and WhatsApp. The Checklists page keeps to filling the lists in ("checklists" view).
-- Roles that held checklists "edit" (migration 223: Business Head, Owner-operator, Store Head) get the new permission and lose the old action; where the
-- role has the Settings hub the page is added to it. The owner roles set up for any store or for the whole business; a Store Head only for their own stores
-- (enforced by the API). Safe to run twice. Rollback: 225_rollback.sql.
DO $$
DECLARE
  r record;
  perms jsonb;
BEGIN
  FOR r IN
    SELECT id, permissions::jsonb AS p FROM public.app_role
     WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "checklists").policies[*] ? (@.action == "edit")')
        OR name IN ('Business Head', 'Owner-operator', 'Store Head')
  LOOP
    perms := r.p;

    -- the old action leaves the checklists permission
    SELECT coalesce(jsonb_agg(
             CASE WHEN e->>'resource' = 'checklists'
                  THEN jsonb_set(e, '{policies}', coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(e->'policies') x WHERE x->>'action' <> 'edit'), '[]'::jsonb))
                  ELSE e END), '[]'::jsonb)
      INTO perms FROM jsonb_array_elements(perms) e;

    IF NOT jsonb_path_exists(perms, '$[*] ? (@.resource == "checklistsetup")') THEN
      perms := perms || '[{"resource":"checklistsetup","path":"/secure/settings/checklists","policies":[{"action":"manage"}]}]'::jsonb;
    END IF;

    -- the Settings hub lists the settings pages the role may open
    IF jsonb_path_exists(perms, '$[*] ? (@.resource == "settings")') THEN
      SELECT jsonb_agg(
               CASE WHEN e->>'resource' = 'settings' AND NOT (CASE WHEN jsonb_typeof(e->'path') = 'array' THEN e->'path' ELSE jsonb_build_array(e->'path') END) @> '"/secure/settings/checklists"'::jsonb
                    THEN jsonb_set(e, '{path}', (CASE WHEN jsonb_typeof(e->'path') = 'array' THEN e->'path' ELSE jsonb_build_array(e->'path') END) || '"/secure/settings/checklists"'::jsonb)
                    ELSE e END)
        INTO perms FROM jsonb_array_elements(perms) e;
    END IF;

    UPDATE public.app_role SET permissions = perms::json WHERE id = r.id;
  END LOOP;
END $$;
