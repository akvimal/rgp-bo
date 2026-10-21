-- Rolls back 043_vendor_master.sql. Drops the licence table and the new vendor columns (their data is lost).
DROP TABLE IF EXISTS public.vendor_license;
DROP INDEX IF EXISTS public.vendor_gstn_unique_idx;
ALTER TABLE public.vendor DROP CONSTRAINT IF EXISTS vendor_master_chk;
ALTER TABLE public.vendor
  DROP COLUMN IF EXISTS legal_name, DROP COLUMN IF EXISTS vendor_type, DROP COLUMN IF EXISTS registration_type,
  DROP COLUMN IF EXISTS pan, DROP COLUMN IF EXISTS state_code, DROP COLUMN IF EXISTS city, DROP COLUMN IF EXISTS pincode,
  DROP COLUMN IF EXISTS email, DROP COLUMN IF EXISTS mobile, DROP COLUMN IF EXISTS rep_name, DROP COLUMN IF EXISTS rep_phone,
  DROP COLUMN IF EXISTS bank_name, DROP COLUMN IF EXISTS bank_account, DROP COLUMN IF EXISTS bank_ifsc,
  DROP COLUMN IF EXISTS upi_id, DROP COLUMN IF EXISTS credit_limit, DROP COLUMN IF EXISTS discount_pcnt;
DROP FUNCTION IF EXISTS public.is_valid_gstin(text);
