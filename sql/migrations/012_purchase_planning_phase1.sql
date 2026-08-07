ALTER TABLE public.purchase_order
    ADD COLUMN IF NOT EXISTS expected_date date NULL,
    ADD COLUMN IF NOT EXISTS source_summary varchar NULL;

ALTER TABLE public.purchase_request
    ADD COLUMN IF NOT EXISTS vendor_id int4 NULL,
    ADD COLUMN IF NOT EXISTS source varchar NULL,
    ADD COLUMN IF NOT EXISTS priority varchar NULL,
    ADD COLUMN IF NOT EXISTS suggested_qty int4 NULL,
    ADD COLUMN IF NOT EXISTS ordered_qty int4 NULL,
    ADD COLUMN IF NOT EXISTS fulfilled_qty int4 NULL,
    ADD COLUMN IF NOT EXISTS customer_name varchar NULL,
    ADD COLUMN IF NOT EXISTS customer_phone varchar NULL,
    ADD COLUMN IF NOT EXISTS needed_by date NULL,
    ADD COLUMN IF NOT EXISTS source_ref varchar NULL,
    ADD COLUMN IF NOT EXISTS notes varchar NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'purchase_request_vendor_fk'
          AND table_name = 'purchase_request'
    ) THEN
        ALTER TABLE public.purchase_request
            ADD CONSTRAINT purchase_request_vendor_fk
            FOREIGN KEY (vendor_id) REFERENCES public.vendor(id);
    END IF;
END $$;

UPDATE public.purchase_request
SET status = CASE WHEN status = 'NEW' THEN 'Open' ELSE status END,
    source = COALESCE(source, 'Staff'),
    priority = COALESCE(priority, 'Normal')
WHERE source IS NULL
   OR priority IS NULL
   OR status = 'NEW';
