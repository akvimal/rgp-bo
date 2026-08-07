ALTER TABLE public.purchase_invoice
    ADD COLUMN IF NOT EXISTS due_date date NULL,
    ADD COLUMN IF NOT EXISTS payment_status varchar NULL,
    ADD COLUMN IF NOT EXISTS reference_no varchar NULL,
    ADD COLUMN IF NOT EXISTS notes varchar NULL;

UPDATE public.purchase_invoice
SET due_date = COALESCE(due_date, invoice_date),
    payment_status = COALESCE(payment_status, 'Unpaid');

ALTER TABLE public.vendor_payment
    ADD COLUMN IF NOT EXISTS communication_status varchar NULL,
    ADD COLUMN IF NOT EXISTS communication_channel varchar NULL,
    ADD COLUMN IF NOT EXISTS communicated_at timestamp NULL,
    ADD COLUMN IF NOT EXISTS acknowledged_at timestamp NULL,
    ADD COLUMN IF NOT EXISTS acknowledgement_reference varchar NULL,
    ADD COLUMN IF NOT EXISTS remarks varchar NULL;

UPDATE public.vendor_payment
SET communication_status = COALESCE(communication_status, 'Not Sent');
