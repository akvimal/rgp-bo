-- the setup permission goes, and the three roles get checklists "edit" back
UPDATE public.app_role SET permissions = (
  SELECT coalesce(jsonb_agg(
           CASE WHEN e->>'resource' = 'checklists' AND NOT jsonb_path_exists(e, '$.policies[*] ? (@.action == "edit")') AND name IN ('Business Head', 'Owner-operator', 'Store Head')
                THEN jsonb_set(e, '{policies}', (e->'policies') || '[{"action":"edit"}]'::jsonb)
                ELSE e END), '[]'::jsonb)
    FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'checklistsetup')::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "checklistsetup")');
