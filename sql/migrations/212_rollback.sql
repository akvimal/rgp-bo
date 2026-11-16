-- 212 rollback: take the stock actions off every role again (the gate goes back to store adjust, stock adjust or audit, and the three owner-level roles by name);
-- a store block that 212 added with an empty path is removed.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'store' AND jsonb_typeof(e->'policies') = 'array' THEN
      jsonb_set(e, '{policies}', coalesce((
        SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p
        WHERE p->>'action' NOT IN ('qty.adjust', 'audit.approve', 'count.perform', 'transfer.request', 'transfer.receive')
      ), '[]'::jsonb))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
  WHERE NOT (e->>'resource' = 'store' AND e->'path' = '[]'::jsonb AND jsonb_array_length(coalesce(e->'policies', '[]'::jsonb)) = 5
             AND e->'policies' @> '[{"action":"qty.adjust"}]'::jsonb)
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "store")');
