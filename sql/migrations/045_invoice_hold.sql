-- 045_invoice_hold.sql
-- Putting a purchase invoice on hold (a dispute, a wrong rate, goods not received in full) now records why,
-- who and when. The hold itself is the existing payment_status = 'On Hold', which already blocks payments.
ALTER TABLE public.purchase_invoice
  ADD COLUMN IF NOT EXISTS hold_reason varchar(200),
  ADD COLUMN IF NOT EXISTS hold_on     timestamptz,
  ADD COLUMN IF NOT EXISTS hold_by     int4 REFERENCES public.app_user(id);
