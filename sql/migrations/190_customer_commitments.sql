-- 190: customer commitments. A customer asks for a product the store does not have; it is ordered and sold on a later day, and the customer pays the whole
-- amount or an advance now. The advance is held against the commitment (not pooled into store credit): it is taken in the shift that was open (cash into that
-- shift's drawer, digital into its provider total), applied on the later bill as a payment type, and refunded or moved to the wallet if the order is cancelled.
-- Additive and re-runnable.
CREATE TABLE IF NOT EXISTS public.customer_commitment (
  id            serial PRIMARY KEY,
  store_id      int4 NOT NULL,
  customer_id   int4 NOT NULL REFERENCES public.customer(id),
  status        varchar(10) NOT NULL DEFAULT 'OPEN',     -- OPEN (taken), ORDERED (a line is on a purchase request), READY (something arrived), COLLECTED, CANCELLED
  needed_by     date NULL,
  hold_until    date NULL,                                -- set when stock first arrives: the received goods are held for the customer until then
  notified_at   timestamptz NULL,                         -- the customer was told it is ready
  notified_by   int4 NULL,
  notified_note varchar(200) NULL,
  notes         varchar(300) NULL,
  sale_id       int4 NULL,                                -- the bill that collected it
  cancel_reason varchar(200) NULL,
  created_by    int4 NULL,
  created_on    timestamptz NOT NULL DEFAULT now(),
  updated_by    int4 NULL,
  updated_on    timestamptz NULL,
  CONSTRAINT customer_commitment_status_chk CHECK (status IN ('OPEN', 'ORDERED', 'READY', 'COLLECTED', 'CANCELLED'))
);
CREATE INDEX IF NOT EXISTS customer_commitment_store_idx ON public.customer_commitment (store_id, status);
CREATE INDEX IF NOT EXISTS customer_commitment_customer_idx ON public.customer_commitment (customer_id);

CREATE TABLE IF NOT EXISTS public.customer_commitment_line (
  id             serial PRIMARY KEY,
  commitment_id  int4 NOT NULL REFERENCES public.customer_commitment(id) ON DELETE CASCADE,
  product_id     int4 NULL,
  requested_name varchar(200) NULL,                       -- for a product not in the product list yet
  qty            int4 NOT NULL CHECK (qty > 0),           -- in packs, like a purchase request
  agreed_price   numeric(10,2) NULL,                      -- per pack, with GST: what the customer agreed to pay
  request_id     int4 NULL,                               -- the purchase request that will bring it (one request may serve several lines)
  qty_received   int4 NOT NULL DEFAULT 0,
  active         boolean NOT NULL DEFAULT true,
  CONSTRAINT customer_commitment_line_product_chk CHECK (product_id IS NOT NULL OR requested_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS customer_commitment_line_commitment_idx ON public.customer_commitment_line (commitment_id);
CREATE INDEX IF NOT EXISTS customer_commitment_line_request_idx ON public.customer_commitment_line (request_id) WHERE request_id IS NOT NULL;

-- the advance ledger: RECEIPT (+), REFUND (-, paid back or moved to the wallet), APPLIED (-, used on a bill), REVERSAL (+, a bill that used it was voided)
CREATE TABLE IF NOT EXISTS public.customer_commitment_payment (
  id            serial PRIMARY KEY,
  commitment_id int4 NOT NULL REFERENCES public.customer_commitment(id),
  kind          varchar(8) NOT NULL,
  amount        numeric(10,2) NOT NULL,
  mode          varchar(8) NULL,                           -- CASH or DIGITAL for a receipt or a refund paid out; WALLET for a refund moved to store credit
  digi_method   varchar(8) NULL,
  digi_provider varchar(20) NULL,
  digi_ref      varchar(40) NULL,
  shift_id      int4 NULL,                                 -- the shift it was taken in (or paid out in): the cash drawer and the terminal tally by it
  store_id      int4 NULL,
  sale_id       int4 NULL,
  note          varchar(200) NULL,
  created_by    int4 NULL,
  created_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_commitment_payment_kind_chk CHECK (kind IN ('RECEIPT', 'REFUND', 'APPLIED', 'REVERSAL')),
  CONSTRAINT customer_commitment_payment_sign_chk CHECK (((kind IN ('RECEIPT', 'REVERSAL')) AND amount > 0) OR ((kind IN ('REFUND', 'APPLIED')) AND amount < 0)),
  CONSTRAINT customer_commitment_payment_mode_chk CHECK (mode IS NULL OR mode IN ('CASH', 'DIGITAL', 'WALLET'))
);
CREATE INDEX IF NOT EXISTS customer_commitment_payment_commitment_idx ON public.customer_commitment_payment (commitment_id);
CREATE INDEX IF NOT EXISTS customer_commitment_payment_shift_idx ON public.customer_commitment_payment (shift_id) WHERE shift_id IS NOT NULL;
-- a bill applies a commitment's advance once
CREATE UNIQUE INDEX IF NOT EXISTS customer_commitment_applied_uq ON public.customer_commitment_payment (sale_id) WHERE kind = 'APPLIED' AND sale_id IS NOT NULL;

-- a bill that collects a commitment, and the part of it paid from the advance
ALTER TABLE public.sale
  ADD COLUMN IF NOT EXISTS commitment_id     int4 NULL,
  ADD COLUMN IF NOT EXISTS commitment_amount real NOT NULL DEFAULT 0;
