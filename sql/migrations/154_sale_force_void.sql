-- 154: a Business Head or Owner-operator may force-void a bill that the ordinary void refuses (its shift is closed, someone else rang it, or it is on no shift).
-- The bill stays on the record (status VOID, who and why); stock, credits and the drug register are reversed as for a void, and any cash goes out of the shift that is open now.
-- Granted by role name, like 150; other roles can be given "forcevoid" on the roles screen (Sales & POS).
UPDATE public.app_role r
SET permissions = (
  SELECT jsonb_agg(
    CASE WHEN e->>'resource' = 'sales' AND NOT (e->'policies' @> '[{"action":"forcevoid"}]'::jsonb)
         THEN jsonb_set(e, '{policies}', (e->'policies') || '[{"action":"forcevoid"}]'::jsonb)
         ELSE e END)
  FROM jsonb_array_elements(r.permissions::jsonb) e)::json
WHERE r.name IN ('Business Head', 'Owner-operator')
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales")')
  AND NOT jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "sales").policies[*] ? (@.action == "forcevoid")');
