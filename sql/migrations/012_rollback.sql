ALTER TABLE public.purchase_request
    DROP CONSTRAINT IF EXISTS purchase_request_vendor_fk;

ALTER TABLE public.purchase_request
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS source_ref,
    DROP COLUMN IF EXISTS needed_by,
    DROP COLUMN IF EXISTS customer_phone,
    DROP COLUMN IF EXISTS customer_name,
    DROP COLUMN IF EXISTS fulfilled_qty,
    DROP COLUMN IF EXISTS ordered_qty,
    DROP COLUMN IF EXISTS suggested_qty,
    DROP COLUMN IF EXISTS priority,
    DROP COLUMN IF EXISTS source,
    DROP COLUMN IF EXISTS vendor_id;

ALTER TABLE public.purchase_order
    DROP COLUMN IF EXISTS source_summary,
    DROP COLUMN IF EXISTS expected_date;
