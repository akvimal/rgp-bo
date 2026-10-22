-- 069_payment_statement.sql
-- The till now takes only the last 4 digits of the Paytm transaction id (optional), which repeat, so a reference no longer
-- identifies one bill: the one-reference-one-bill index goes. A Paytm / card machine transaction report can be uploaded; its
-- successful payments are kept (without customer phone, email or UPI id) so each bill can be suggested a payment by amount,
-- time and those last digits. A bill checked against a payment keeps the link.

DROP INDEX IF EXISTS public.sale_digi_ref_uq;
CREATE INDEX IF NOT EXISTS sale_digi_ref_idx ON public.sale (digi_provider, upper(digi_refno)) WHERE digi_refno IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_import (
  id           serial PRIMARY KEY,
  file_name    varchar(150),
  row_count    int4 NOT NULL DEFAULT 0,
  rows_kept    int4 NOT NULL DEFAULT 0,
  duplicates   int4 NOT NULL DEFAULT 0,
  skipped      int4 NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  period_from  date,
  period_to    date,
  uploaded_by  int4 REFERENCES public.app_user(id),
  uploaded_on  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_txn (
  id             serial PRIMARY KEY,
  import_id      int4 NOT NULL REFERENCES public.payment_import(id) ON DELETE CASCADE,
  txn_id         varchar(64) NOT NULL,
  utr            varchar(40),
  rrn            varchar(30),
  kind           varchar(4) NOT NULL,                 -- QR or CARD (the card machine)
  mode           varchar(30),
  amount         numeric(12,2) NOT NULL,
  settled_amount numeric(12,2),
  fee            numeric(10,2),
  paid_on        timestamp NOT NULL,                  -- as printed on the report, like sale.bill_date
  settled_on     timestamp,
  CONSTRAINT payment_txn_kind_chk CHECK (kind IN ('QR', 'CARD'))
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_txn_txn_uq ON public.payment_txn (txn_id);
CREATE INDEX IF NOT EXISTS payment_txn_paid_idx ON public.payment_txn (paid_on);
CREATE INDEX IF NOT EXISTS payment_txn_import_idx ON public.payment_txn (import_id);

ALTER TABLE public.payment_check ADD COLUMN IF NOT EXISTS txn_id int4 REFERENCES public.payment_txn(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_check_txn_uq ON public.payment_check (txn_id) WHERE txn_id IS NOT NULL;

-- Only the Business Head uploads statements.
UPDATE public.app_role SET permissions = ((SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'paymentrecon') ||
  '[{"resource":"paymentrecon","path":"/secure/digital-payments","policies":[{"action":"view"},{"action":"verify"},{"action":"import"}]}]'::jsonb)::json
WHERE name = 'Business Head';
