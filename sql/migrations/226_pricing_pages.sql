-- 226: the price pages moved out of Products into their own Pricing area (/secure/pricing/prices, /changes, /policy, /rules), and the price changes sheet
-- (/secure/price-changes) became one of its pages. The pages a role may open are stored on the role, so the new addresses are added here:
--   * a role with Products "price" gets /secure/pricing/prices, /policy and /rules on its Products entry;
--   * a role with the Price changes sheet gets /secure/pricing/changes on that entry.
-- The old addresses stay on the role and redirect to the new ones in the app. No action is added or removed. Safe to run twice. Rollback: 226_rollback.sql.
CREATE OR REPLACE FUNCTION pg_temp.add_paths(e jsonb, extra jsonb) RETURNS jsonb AS $$
DECLARE
  cur jsonb := CASE WHEN jsonb_typeof(e->'path') = 'array' THEN e->'path' WHEN e->'path' IS NULL OR jsonb_typeof(e->'path') = 'null' THEN '[]'::jsonb ELSE jsonb_build_array(e->'path') END;
  p text;
BEGIN
  FOR p IN SELECT jsonb_array_elements_text(extra) LOOP
    IF NOT (cur @> to_jsonb(p)) THEN cur := cur || to_jsonb(p); END IF;
  END LOOP;
  RETURN jsonb_set(e, '{path}', cur);
END $$ LANGUAGE plpgsql;

UPDATE public.app_role r SET permissions = (
  SELECT jsonb_agg(
           CASE
             WHEN e->>'resource' = 'products' AND jsonb_path_exists(e, '$.policies[*] ? (@.action == "price")')
               THEN pg_temp.add_paths(e, '["/secure/pricing/prices", "/secure/pricing/policy", "/secure/pricing/rules"]'::jsonb)
             WHEN e->>'resource' = 'pricechanges'
               THEN pg_temp.add_paths(e, '["/secure/pricing/changes"]'::jsonb)
             ELSE e
           END)
    FROM jsonb_array_elements(r.permissions::jsonb) e)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "products" || @.resource == "pricechanges")');
