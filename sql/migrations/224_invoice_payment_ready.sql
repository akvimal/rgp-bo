-- 224: the "payment ready" step. Completing a purchase invoice means the goods and the bill agree; marking it payment ready is the next, explicit
-- step: it says the invoice is checked and may go to finance. A payment (or pay run line) can only be recorded on an invoice that is marked ready,
-- alongside the existing hold and approval checks. Invoices already complete with a vendor invoice number are marked ready here, so nothing in flight stops.
-- Rollback: 224_rollback.sql.
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS payment_ready_on   timestamptz NULL;
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS payment_ready_by   int4 NULL REFERENCES public.app_user(id);
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS payment_ready_note varchar(200) NULL;

UPDATE public.purchase_invoice
   SET payment_ready_on = COALESCE(updated_on, created_on, now())
 WHERE status = 'COMPLETE' AND invoice_no IS NOT NULL AND payment_ready_on IS NULL;
