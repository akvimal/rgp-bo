-- rollback of 150: bills already voided keep status VOID (put them back to COMPLETE first if the column is to go)
UPDATE public.app_role r
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'sales'
         THEN jsonb_set(e, '{policies}', COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p WHERE p->>'action' <> 'void'), '[]'::jsonb))
         ELSE e END)
  FROM jsonb_array_elements(r.permissions::jsonb) e)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales").policies[*] ? (@.action == "void")');
DROP INDEX IF EXISTS public.sale_voided_idx;
ALTER TABLE public.sale DROP COLUMN IF EXISTS void_reason, DROP COLUMN IF EXISTS voided_by, DROP COLUMN IF EXISTS voided_on;
