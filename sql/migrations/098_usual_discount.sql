-- 098: the discount a class usually gets off MRP, used to suggest a first price for a product that has none.
-- It is a starting point, not a limit: the suggestion is always kept between the class's lowest price (floor markup and deepest discount)
-- and the legal ceiling. Seeded from the 12-month study of production sales: low trade margin items sell near MRP, medium about a fifth
-- off, high trade margin items about half off.
ALTER TABLE public.price_policy ADD COLUMN IF NOT EXISTS usual_discount_pct numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.price_policy DROP CONSTRAINT IF EXISTS price_policy_usual_chk;
ALTER TABLE public.price_policy ADD CONSTRAINT price_policy_usual_chk CHECK (usual_discount_pct >= 0 AND usual_discount_pct <= 95);
UPDATE public.price_policy SET usual_discount_pct = CASE split_part(class_key, '_', 1) WHEN 'HIGH' THEN 50 WHEN 'MID' THEN 20 ELSE 5 END
 WHERE usual_discount_pct = 0;
