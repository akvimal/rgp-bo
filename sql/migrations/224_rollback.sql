ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS payment_ready_note;
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS payment_ready_by;
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS payment_ready_on;
