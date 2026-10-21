-- 048_store_licenses.sql
-- A drug licence belongs to the premises, so each store carries its own (retail 20/21, or wholesale 20B/21B if the
-- business holds one), plus the address a vendor needs for "ship to". GSTIN stays one per business: stores in a
-- state are additional places of business on the same registration.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS address varchar(200),
  ADD COLUMN IF NOT EXISTS pincode varchar(10),
  ADD COLUMN IF NOT EXISTS phone   varchar(20);

CREATE TABLE IF NOT EXISTS public.store_license (
  id           serial PRIMARY KEY,
  store_id     int4 NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  license_type varchar(24) NOT NULL,
  number       varchar(40) NOT NULL,
  valid_from   date,
  valid_to     date,
  notes        varchar(200),
  created_on   timestamptz NOT NULL DEFAULT now(),
  created_by   int4,
  CONSTRAINT store_license_type_chk CHECK (license_type IN ('RETAIL_20_21','WHOLESALE_20B_21B','FSSAI','OTHER')),
  CONSTRAINT store_license_dates_chk CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT store_license_uq UNIQUE (store_id, license_type, number)
);
CREATE INDEX IF NOT EXISTS store_license_valid_to_idx ON public.store_license (valid_to);

-- Is the store allowed to take in drugs today? A store with no licence recorded is not blocked (nothing is known);
-- one that has drug licences recorded needs at least one type (retail or wholesale) whose latest licence has not expired.
CREATE OR REPLACE FUNCTION public.store_drug_license_expired(p_store int) RETURNS boolean
LANGUAGE sql STABLE AS $$
  WITH latest AS (
    SELECT license_type, bool_or(valid_to IS NULL) AS open_ended, max(valid_to) AS last_to
      FROM public.store_license
     WHERE store_id = p_store AND license_type IN ('RETAIL_20_21','WHOLESALE_20B_21B')
     GROUP BY license_type)
  SELECT EXISTS (SELECT 1 FROM latest)
     AND NOT EXISTS (SELECT 1 FROM latest WHERE open_ended OR last_to >= current_date);
$$;
