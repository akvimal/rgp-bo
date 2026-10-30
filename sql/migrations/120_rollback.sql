-- fails if a SHOP_EST or TRADE licence has been saved: remove those rows first
ALTER TABLE public.store_license DROP CONSTRAINT IF EXISTS store_license_type_chk;
ALTER TABLE public.store_license ADD CONSTRAINT store_license_type_chk
  CHECK (license_type IN ('RETAIL_20_21','WHOLESALE_20B_21B','FSSAI','OTHER'));
ALTER TABLE public.vendor_license DROP CONSTRAINT IF EXISTS vendor_license_type_chk;
ALTER TABLE public.vendor_license ADD CONSTRAINT vendor_license_type_chk
  CHECK (license_type IN ('WHOLESALE_20B_21B','RETAIL_20_21','MANUFACTURING','FSSAI','OTHER'));
