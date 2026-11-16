-- 209: the Reports permission gets actions (MENU_AND_PERMISSIONS step D, Reports).
-- It was a bare presence (the page opens), while Ask the shop and the weekly summary were decided by role name. Now:
--   sales      the sales report, and Ask the shop's sales, payment, expense and top-product reports
--   purchases  Ask the shop's purchases by vendor
--   stock      Ask the shop's expiring, expiry-risk and dead-stock reports
--   margin     profit and thin-margin reports, customer dues and the weekly summary
--   ask        the Ask the shop tab
--   export     the sales report as a file
-- Every role holding Reports keeps what it had: sales, purchases, stock and export. `ask` goes to the Store Head (who could use Ask the shop by
-- role name) and `ask` and `margin` to the owner roles. Nobody else gets either; the owner grants them in the role editor.
-- Rollback: 209_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'reports' THEN
      jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
        FROM unnest(
          CASE WHEN r.name IN ('Business Head', 'Owner-operator') THEN ARRAY['sales', 'purchases', 'stock', 'export', 'ask', 'margin']
               WHEN r.name = 'Store Head' THEN ARRAY['sales', 'purchases', 'stock', 'export', 'ask']
               ELSE ARRAY['sales', 'purchases', 'stock', 'export'] END
        ) AS a
        WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
      ))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "reports")');
