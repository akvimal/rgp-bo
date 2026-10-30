-- 120: Shop and establishment and Trade licences can be saved against a store or a vendor.
-- The licence type lists the screens offer (pack-config) already include SHOP_EST and TRADE, but the check constraints from 043/048
-- only allowed the drug and food types, so saving either of those two failed with "constraint violation".
ALTER TABLE public.store_license DROP CONSTRAINT IF EXISTS store_license_type_chk;
ALTER TABLE public.store_license ADD CONSTRAINT store_license_type_chk
  CHECK (license_type IN ('RETAIL_20_21','WHOLESALE_20B_21B','FSSAI','SHOP_EST','TRADE','OTHER'));
ALTER TABLE public.vendor_license DROP CONSTRAINT IF EXISTS vendor_license_type_chk;
ALTER TABLE public.vendor_license ADD CONSTRAINT vendor_license_type_chk
  CHECK (license_type IN ('WHOLESALE_20B_21B','RETAIL_20_21','MANUFACTURING','FSSAI','SHOP_EST','TRADE','OTHER'));
