-- 150: a bill rung up by mistake can be voided while its shift is still open.
-- The bill stays on the record (status VOID, who, when and why); stock comes back, the shift's cash is corrected and the bill's
-- credit, register and tax-invoice records are reversed or marked, so nothing is deleted.
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS voided_on timestamptz;
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS voided_by integer;
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS void_reason text;
CREATE INDEX IF NOT EXISTS sale_voided_idx ON public.sale (voided_on) WHERE voided_on IS NOT NULL;

-- Managers may void any bill of the open shift (everyone who can add a sale may void their own).
UPDATE public.app_role r
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'sales' AND NOT (e->'policies' @> '[{"action":"void"}]'::jsonb)
         THEN jsonb_set(e, '{policies}', (e->'policies') || '[{"action":"void"}]'::jsonb)
         ELSE e END)
  FROM jsonb_array_elements(r.permissions::jsonb) e)::json
WHERE r.name IN ('Business Head', 'Store Head', 'Owner-operator')
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales")')
  AND NOT jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales").policies[*] ? (@.action == "void")');
