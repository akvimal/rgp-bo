-- 086: a minimum stock per product, in units: the Reorder list keeps at least this much on hand after the cover period.
-- Empty means no minimum. It applies to the store being looked at (or to all stores together when none is chosen).
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS min_stock integer NULL;
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_min_stock_chk;
ALTER TABLE public.product ADD CONSTRAINT product_min_stock_chk CHECK (min_stock IS NULL OR min_stock >= 0);
