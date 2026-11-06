-- 161: pay later. A named customer may take a bill (or the rest of one) and pay in a few days.
--   customer.credit_limit   what they may owe at most; 0 = no credit (a manager invites a customer by setting a limit)
--   sale.due_amount/due_date the part of a bill left to pay and the day it was promised
--   customer_due_entry       DUE (+, from a bill) / PAYMENT (-, collected later) / ADJUSTMENT (+ or -, with a note); the balance is the sum
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS due_amount real NOT NULL DEFAULT 0;
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS due_date date;

CREATE TABLE IF NOT EXISTS public.customer_due_entry (
  id          serial PRIMARY KEY,
  customer_id int4 NOT NULL REFERENCES public.customer(id),
  kind        varchar(12) NOT NULL,
  amount      numeric(12,2) NOT NULL,
  sale_id     int4 REFERENCES public.sale(id),
  store_id    int4,
  shift_id    int4,
  pay_mode    varchar(10),
  provider    varchar(20),
  ref_no      varchar(40),
  due_date    date,
  note        varchar(200),
  entry_date  date NOT NULL DEFAULT current_date,
  created_by  int4,
  created_on  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT customer_due_kind_chk CHECK (kind IN ('DUE', 'PAYMENT', 'ADJUSTMENT')),
  CONSTRAINT customer_due_sign_chk CHECK ((kind = 'DUE' AND amount > 0) OR (kind = 'PAYMENT' AND amount < 0) OR (kind = 'ADJUSTMENT' AND amount <> 0)),
  CONSTRAINT customer_due_mode_chk CHECK (pay_mode IS NULL OR pay_mode IN ('CASH', 'DIGITAL'))
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_due_sale_uq ON public.customer_due_entry (sale_id) WHERE kind = 'DUE' AND sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_due_customer_idx ON public.customer_due_entry (customer_id, entry_date);
