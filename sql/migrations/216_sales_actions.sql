-- 216: till overrides that were decided by role name become actions on the `sales` permission (MENU_AND_PERMISSIONS step E, Sales).
--   manager level (the Business Head, Owner-operator and Store Head could):  batchstop.override, creditlimit.override, deliveries.manage
--   owner level (the Business Head and Owner-operator could):                returns.settings
-- Nobody loses what they can do: each role gets the actions of the level it had, wherever it already holds the Sales page. The Store Head holds the
-- manager-level ones by this grant, not by name, so a Store Head role can be narrowed in the role editor.
-- Rollback: 216_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'sales' THEN
      jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
        FROM unnest(CASE WHEN r.name IN ('Business Head', 'Owner-operator')
                         THEN ARRAY['batchstop.override', 'creditlimit.override', 'deliveries.manage', 'returns.settings']
                         ELSE ARRAY['batchstop.override', 'creditlimit.override', 'deliveries.manage'] END) AS a
        WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
      ))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE r.name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales")');
