ALTER TABLE public.vendor_payment
    ADD COLUMN IF NOT EXISTS active bool DEFAULT true NOT NULL,
    ADD COLUMN IF NOT EXISTS archive bool DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ADD COLUMN IF NOT EXISTS created_by int4 NULL,
    ADD COLUMN IF NOT EXISTS updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_by int4 NULL;

UPDATE public.vendor_payment
SET active = COALESCE(active, true),
    archive = COALESCE(archive, false)
WHERE active IS DISTINCT FROM true
   OR archive IS DISTINCT FROM false;
