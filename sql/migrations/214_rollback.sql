-- 214 rollback: take the Setup actions off every role again (these go back to the owner roles by name; resetting an authenticator back to managing the person).
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' IN ('businessprofile', 'users') AND jsonb_typeof(e->'policies') = 'array' THEN
      jsonb_set(e, '{policies}', coalesce((
        SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p
        WHERE p->>'action' NOT IN ('modules.manage', 'transfer.export', 'transfer.import', 'mfareset')
      ), '[]'::jsonb))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "businessprofile" || @.resource == "users")');
