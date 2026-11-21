-- Rollback of 233: the kept online price answers go (they can be looked up again).
DROP TABLE IF EXISTS public.brand_price_lookup;
