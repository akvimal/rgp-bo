-- 215: customer actions that were decided by role name become actions on the `customers` permission (MENU_AND_PERMISSIONS step E, Customers).
--   manager level (the Business Head, Owner-operator and Store Head could):   creditlimit.set, households.manage, followup.wording
--   owner level (the Business Head and Owner-operator could):                 merge, credit.correct, relationships.setup
--   delete already existed as a box (given to the Business Head and Store Head by 051) and the API now honours it
-- Nobody loses what they can do: each role gets the actions of the level it had, wherever it already holds the Customers page. The Store Head holds
-- the manager-level ones by this grant, not by name, so a Store Head role can be narrowed in the role editor. A custom role that already had the
-- delete box ticked now really can delete (the API used to refuse everyone but the managers).
-- Rollback: 215_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'customers' THEN
      jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
        FROM unnest(CASE WHEN r.name IN ('Business Head', 'Owner-operator')
                         THEN ARRAY['delete', 'merge', 'creditlimit.set', 'credit.correct', 'households.manage', 'followup.wording', 'relationships.setup']
                         ELSE ARRAY['creditlimit.set', 'households.manage', 'followup.wording'] END) AS a
        WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
      ))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE r.name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "customers")');
