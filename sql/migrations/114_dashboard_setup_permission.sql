-- 114: Settings > Dashboards and compliance (implementation plan stage 7).
--  * the dashsetup permission group: the Business Head and Owner-operator change the settings; the Store Head may read them (read-only, the server
--    decides who may save), so what applies to the store is never a surprise.
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"dashsetup","path":"/secure/settings/dashboards","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "dashsetup")');
