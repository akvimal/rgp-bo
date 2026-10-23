ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_min_stock_chk;
ALTER TABLE public.product DROP COLUMN IF EXISTS min_stock;
