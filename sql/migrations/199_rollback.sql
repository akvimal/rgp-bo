ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_gst_supply_kind_chk;
ALTER TABLE public.product DROP COLUMN IF EXISTS gst_supply_kind;
DROP TABLE IF EXISTS public.gst_supply_kind_default;
