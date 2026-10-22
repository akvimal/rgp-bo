-- 068_payment_reconciliation.sql
-- Digital payments are taken on a static QR and a card machine, so the provider cannot be asked about a bill in real time.
-- Instead someone compares the bills with the Paytm / card-machine statement and records the result here, one row per bill:
-- VERIFIED (found, amount agrees), MISMATCH (found, a different amount) or NOT_FOUND (not on the statement). A bill with no
-- row is still to be checked. The row can be changed or removed; every change is audited.

CREATE TABLE IF NOT EXISTS public.payment_check (
  id          serial PRIMARY KEY,
  sale_id     int4 NOT NULL UNIQUE REFERENCES public.sale(id),
  status      varchar(10) NOT NULL,
  amount_seen numeric(12,2),
  note        varchar(300),
  checked_by  int4 REFERENCES public.app_user(id),
  checked_on  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_check_status_chk CHECK (status IN ('VERIFIED', 'MISMATCH', 'NOT_FOUND'))
);
CREATE INDEX IF NOT EXISTS payment_check_status_idx ON public.payment_check (status);

-- Business Head: check and see everything. Store Head: check the bills of their own stores.
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"paymentrecon","path":"/secure/digital-payments","policies":[{"action":"view"},{"action":"verify"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Store Head') AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "paymentrecon")');
