ALTER TABLE public.sale_deliveries DROP CONSTRAINT IF EXISTS sale_deliveries_charge_via_chk;
ALTER TABLE public.sale_deliveries DROP COLUMN IF EXISTS charge_ref, DROP COLUMN IF EXISTS charge_method, DROP COLUMN IF EXISTS charge_via;
