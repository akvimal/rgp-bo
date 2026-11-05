-- rollback of 154: bills already force-voided keep status VOID
UPDATE public.app_role r
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'sales'
         THEN jsonb_set(e, '{policies}', COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p WHERE p->>'action' <> 'forcevoid'), '[]'::jsonb))
         ELSE e END)
  FROM jsonb_array_elements(r.permissions::jsonb) e)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales").policies[*] ? (@.action == "forcevoid")');
