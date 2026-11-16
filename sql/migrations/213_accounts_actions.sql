-- 213: Finance and GST filing carry actions (MENU_AND_PERMISSIONS step E, Accounts). Each was one presence check ("view") that opened everything.
--   finance    : bank.import, reconcile, records          (view stays: holding the resource opens the pages)
--   gstfiling  : prepare, export, lock, unlock            (view stays)
-- Nobody loses what they can do today: every role holding finance gets bank.import, reconcile and records; every role holding gstfiling gets
-- prepare, export and lock. `unlock` (reopening a closed GST month) goes to the owner roles only: it is the one action the plan keeps with the
-- Business Head unless delegated. GST reconciliation (the `gst` resource) and Digital payments already had actions and are not touched.
-- Rollback: 213_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE
      WHEN e->>'resource' = 'finance' THEN
        jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
          SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
          FROM unnest(ARRAY['bank.import', 'reconcile', 'records']) AS a
          WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
        ))
      WHEN e->>'resource' = 'gstfiling' THEN
        jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
          SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
          FROM unnest(CASE WHEN r.name IN ('Business Head', 'Owner-operator') THEN ARRAY['prepare', 'export', 'lock', 'unlock']
                           ELSE ARRAY['prepare', 'export', 'lock'] END) AS a
          WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
        ))
      ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "finance" || @.resource == "gstfiling")');
