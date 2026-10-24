ALTER TABLE public.price_policy DROP CONSTRAINT IF EXISTS price_policy_usual_chk;
ALTER TABLE public.price_policy DROP COLUMN IF EXISTS usual_discount_pct;
