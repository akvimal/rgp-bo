DROP FUNCTION IF EXISTS public.store_drug_license_expired(int);
DROP TABLE IF EXISTS public.store_license;
ALTER TABLE public.stores DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS pincode, DROP COLUMN IF EXISTS phone;
