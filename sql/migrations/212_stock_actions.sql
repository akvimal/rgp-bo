-- 212: the old all-in-one stock gate (`auditStock`) is split into actions on the `store` permission (MENU_AND_PERMISSIONS step D, Stock):
--   qty.adjust, audit.approve, count.perform, transfer.request, transfer.receive
-- The gate let in the Business Head, Owner-operator and Store Head by name, and any role with store adjust, stock adjust or stock audit.
-- Nobody loses what they can do: all five go to those same roles. A role that held stock adjust or audit but has no `store` block gets one with
-- an empty path (it carries the actions and opens no page). After this a role built with only store adjust no longer changes stock.
-- Rollback: 212_rollback.sql.

-- roles that already have a store block
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'store' THEN
      jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
        FROM unnest(ARRAY['qty.adjust', 'audit.approve', 'count.perform', 'transfer.request', 'transfer.receive']) AS a
        WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
      ))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "store")')
  AND (
    r.name IN ('Business Head', 'Owner-operator', 'Store Head')
    OR jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "store").policies[*] ? (@.action == "adjust")')
    OR jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "stock").policies[*] ? (@.action == "adjust" || @.action == "audit")')
  );

-- roles that held stock adjust or audit but have no store block
UPDATE public.app_role r
SET permissions = (
  r.permissions::jsonb ||
  '[{"resource":"store","path":[],"policies":[{"action":"qty.adjust"},{"action":"audit.approve"},{"action":"count.perform"},{"action":"transfer.request"},{"action":"transfer.receive"}]}]'::jsonb
)::json
WHERE NOT jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "store")')
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "stock").policies[*] ? (@.action == "adjust" || @.action == "audit")');
