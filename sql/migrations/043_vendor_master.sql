-- 043_vendor_master.sql
-- Fuller vendor (supplier) master: legal identity, GST registration type, state, contact channels, sales rep,
-- bank / UPI, credit limit and discount, plus the drug / food licences a supplier holds (with validity).
-- Also installs is_valid_gstin(): format, state code and the check character, the single source of truth for
-- the API and the vendor-sheet loader.

-- ---------------------------------------------------------------- GSTIN check
CREATE OR REPLACE FUNCTION public.is_valid_gstin(g text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  chars constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  s int := 0; i int; v int; p int; st int;
BEGIN
  IF g IS NULL OR g !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN RETURN false; END IF;
  st := substr(g, 1, 2)::int;
  IF NOT ((st BETWEEN 1 AND 38) OR st IN (97, 99)) THEN RETURN false; END IF;
  FOR i IN 1..14 LOOP
    v := position(substr(g, i, 1) IN chars) - 1;
    p := v * CASE WHEN i % 2 = 1 THEN 1 ELSE 2 END;
    s := s + (p / 36) + (p % 36);
  END LOOP;
  RETURN substr(chars, ((36 - (s % 36)) % 36) + 1, 1) = substr(g, 15, 1);
END $$;

-- ---------------------------------------------------------------- vendor columns
ALTER TABLE public.vendor
  ADD COLUMN IF NOT EXISTS legal_name        varchar(120),
  ADD COLUMN IF NOT EXISTS vendor_type       varchar(20),
  ADD COLUMN IF NOT EXISTS registration_type varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS pan               varchar(10),
  ADD COLUMN IF NOT EXISTS state_code        varchar(2),
  ADD COLUMN IF NOT EXISTS city              varchar(60),
  ADD COLUMN IF NOT EXISTS pincode           varchar(6),
  ADD COLUMN IF NOT EXISTS email             varchar(120),
  ADD COLUMN IF NOT EXISTS mobile            varchar(15),
  ADD COLUMN IF NOT EXISTS rep_name          varchar(60),
  ADD COLUMN IF NOT EXISTS rep_phone         varchar(15),
  ADD COLUMN IF NOT EXISTS bank_name         varchar(80),
  ADD COLUMN IF NOT EXISTS bank_account      varchar(30),
  ADD COLUMN IF NOT EXISTS bank_ifsc         varchar(11),
  ADD COLUMN IF NOT EXISTS upi_id            varchar(80),
  ADD COLUMN IF NOT EXISTS credit_limit      numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_pcnt     numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_master_chk') THEN
    ALTER TABLE public.vendor ADD CONSTRAINT vendor_master_chk CHECK (
      (vendor_type IS NULL OR vendor_type IN ('DISTRIBUTOR','MANUFACTURER','LOCAL','OTHER'))
      AND registration_type IN ('REGULAR','COMPOSITION','UNREGISTERED','UNKNOWN')
      AND (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$')
      AND (state_code IS NULL OR state_code ~ '^[0-9]{2}$')
      AND (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$')
      AND (mobile IS NULL OR mobile ~ '^[6-9][0-9]{9}$')
      AND (rep_phone IS NULL OR rep_phone ~ '^[6-9][0-9]{9}$')
      AND (bank_ifsc IS NULL OR bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$')
      AND (credit_limit IS NULL OR credit_limit >= 0)
      AND (discount_pcnt IS NULL OR discount_pcnt BETWEEN 0 AND 100)
    ) NOT VALID;
    ALTER TABLE public.vendor VALIDATE CONSTRAINT vendor_master_chk;
  END IF;
END $$;

-- the same GSTIN cannot belong to two active vendors
CREATE UNIQUE INDEX IF NOT EXISTS vendor_gstn_unique_idx
  ON public.vendor (upper(btrim(gstn)))
  WHERE coalesce(btrim(gstn), '') <> '' AND active;

-- fill what can be derived from a valid GSTIN (state and PAN are part of it); anything else stays as it was
UPDATE public.vendor
   SET gstn = upper(btrim(gstn)),
       state_code = substr(upper(btrim(gstn)), 1, 2),
       pan = substr(upper(btrim(gstn)), 3, 10),
       registration_type = 'REGULAR'
 WHERE public.is_valid_gstin(upper(btrim(gstn))) AND registration_type = 'UNKNOWN';

-- ---------------------------------------------------------------- licences
CREATE TABLE IF NOT EXISTS public.vendor_license (
  id           serial PRIMARY KEY,
  vendor_id    int4 NOT NULL REFERENCES public.vendor(id) ON DELETE CASCADE,
  license_type varchar(24) NOT NULL,
  number       varchar(40) NOT NULL,
  valid_from   date,
  valid_to     date,
  notes        varchar(200),
  created_on   timestamptz NOT NULL DEFAULT now(),
  created_by   int4,
  CONSTRAINT vendor_license_type_chk CHECK (license_type IN ('WHOLESALE_20B_21B','RETAIL_20_21','MANUFACTURING','FSSAI','OTHER')),
  CONSTRAINT vendor_license_dates_chk CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT vendor_license_uq UNIQUE (vendor_id, license_type, number)
);
CREATE INDEX IF NOT EXISTS vendor_license_valid_to_idx ON public.vendor_license (valid_to);
