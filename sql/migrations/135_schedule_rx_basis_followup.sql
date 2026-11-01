-- 135: how a scheduled supply stands with its prescription (pharmacy pack).
-- Each register line records the basis: ATTACHED (a picture on the bill), ON_FILE (one kept with the customer), LAST_SUPPLY (same as the customer's last supply),
-- SEEN (shown at the counter, not kept), REGULAR (a regular customer with an earlier prescription), LATER (will bring it), COULD_NOT, OTHER (with a note).
-- A bill marked LATER leaves a follow-up on the customer: it shows in the customer worklist until a prescription is uploaded for them, or it is waived with a reason.
ALTER TABLE public.schedule_register
  ADD COLUMN IF NOT EXISTS rx_basis varchar(12),
  ADD COLUMN IF NOT EXISTS rx_note varchar(200),
  ADD COLUMN IF NOT EXISTS rx_document_id integer;

CREATE TABLE IF NOT EXISTS public.schedule_rx_followup (
  id serial PRIMARY KEY,
  business_id integer NOT NULL,
  store_id integer,
  sale_id integer NOT NULL,
  customer_id integer NOT NULL,
  due_on date NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'OPEN',
  note varchar(200),
  document_id integer,
  created_on timestamptz NOT NULL DEFAULT now(),
  created_by integer,
  closed_on timestamptz,
  closed_by integer,
  CONSTRAINT schedule_rx_followup_status_chk CHECK (status IN ('OPEN', 'DONE', 'WAIVED', 'CANCELLED')),
  CONSTRAINT schedule_rx_followup_sale_uq UNIQUE (sale_id)
);
CREATE INDEX IF NOT EXISTS schedule_rx_followup_open_idx ON public.schedule_rx_followup (business_id, status, due_on);
CREATE INDEX IF NOT EXISTS schedule_rx_followup_customer_idx ON public.schedule_rx_followup (customer_id);
