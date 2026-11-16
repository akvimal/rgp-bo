-- 215 rollback: take the customer actions that 215 added off every role again (the checks go back to the role names). `delete` is left: 051 gave it.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'customers' AND jsonb_typeof(e->'policies') = 'array' THEN
      jsonb_set(e, '{policies}', coalesce((
        SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p
        WHERE p->>'action' NOT IN ('merge', 'creditlimit.set', 'credit.correct', 'households.manage', 'followup.wording', 'relationships.setup')
      ), '[]'::jsonb))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "customers")');
