-- 056_customer_store_credit.sql
-- Store credit for customers. A return can be refunded as credit; the credit sits on the customer (usable at any store,
-- no expiry) and pays part or all of a later bill. The balance is the sum of the ledger.
--   customer_credit_entry  ISSUED (+, from a settled return) / REDEEMED (-, from a bill) / ADJUSTMENT (+ or -, with a note)
--   sale_return_item       how the customer was refunded and how much, set when the return is settled (adjusted)
--   sale.credit_amount     the part of a bill paid with store credit

CREATE TABLE IF NOT EXISTS public.customer_credit_entry (
  id          serial PRIMARY KEY,
  customer_id int4 NOT NULL REFERENCES public.customer(id),
  entry_date  date NOT NULL DEFAULT current_date,
  kind        varchar(12) NOT NULL,
  amount      numeric(10,2) NOT NULL,
  return_item_id int4,
  sale_id     int4,
  store_id    int4,
  note        varchar(200),
  created_by  int4,
  created_on  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_credit_kind_chk CHECK (kind IN ('ISSUED', 'REDEEMED', 'ADJUSTMENT')),
  CONSTRAINT customer_credit_sign_chk CHECK ((kind = 'ISSUED' AND amount > 0) OR (kind = 'REDEEMED' AND amount < 0) OR (kind = 'ADJUSTMENT' AND amount <> 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_credit_issued_uq ON public.customer_credit_entry (return_item_id) WHERE kind = 'ISSUED' AND return_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_credit_redeemed_uq ON public.customer_credit_entry (sale_id) WHERE kind = 'REDEEMED' AND sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_credit_entry_cust_idx ON public.customer_credit_entry (customer_id);

ALTER TABLE public.sale_return_item
  ADD COLUMN IF NOT EXISTS refund_mode varchar(10),
  ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2);
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS credit_amount real NOT NULL DEFAULT 0;
