-- 216 rollback: take the till override actions off every role again (the checks go back to the role names).
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'sales' AND jsonb_typeof(e->'policies') = 'array' THEN
      jsonb_set(e, '{policies}', coalesce((
        SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p
        WHERE p->>'action' NOT IN ('batchstop.override', 'creditlimit.override', 'deliveries.manage', 'returns.settings')
      ), '[]'::jsonb))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales")');
