-- the one-reference-one-bill index is not restored: references are short now and repeat
DROP INDEX IF EXISTS public.payment_check_txn_uq;
ALTER TABLE public.payment_check DROP COLUMN IF EXISTS txn_id;
DROP TABLE IF EXISTS public.payment_txn, public.payment_import;
UPDATE public.app_role SET permissions = ((SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'paymentrecon') ||
  '[{"resource":"paymentrecon","path":"/secure/digital-payments","policies":[{"action":"view"},{"action":"verify"}]}]'::jsonb)::json
WHERE name = 'Business Head';
