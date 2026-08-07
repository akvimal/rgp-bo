ALTER TABLE public.vendor_payment
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS updated_on,
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS created_on,
    DROP COLUMN IF EXISTS archive,
    DROP COLUMN IF EXISTS active;
