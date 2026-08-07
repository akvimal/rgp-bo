ALTER TABLE public.vendor_payment
    DROP COLUMN IF EXISTS remarks,
    DROP COLUMN IF EXISTS acknowledgement_reference,
    DROP COLUMN IF EXISTS acknowledged_at,
    DROP COLUMN IF EXISTS communicated_at,
    DROP COLUMN IF EXISTS communication_channel,
    DROP COLUMN IF EXISTS communication_status;

ALTER TABLE public.purchase_invoice
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS reference_no,
    DROP COLUMN IF EXISTS payment_status,
    DROP COLUMN IF EXISTS due_date;
