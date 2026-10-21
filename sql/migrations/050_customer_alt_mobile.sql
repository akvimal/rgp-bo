-- 050_customer_alt_mobile.sql
-- A second number for a customer (a spouse, a child, the shop's own line): shown on the record, searchable, and used
-- when someone rings from it. The primary mobile stays the identity; this one may be shared and is not unique.
ALTER TABLE public.customer
  ADD COLUMN IF NOT EXISTS alt_mobile varchar(10);

DO $$ BEGIN
  ALTER TABLE public.customer
    ADD CONSTRAINT customer_alt_mobile_chk CHECK (alt_mobile IS NULL OR alt_mobile ~ '^[6-9][0-9]{9}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS customer_alt_mobile_idx ON public.customer (alt_mobile) WHERE alt_mobile IS NOT NULL;
