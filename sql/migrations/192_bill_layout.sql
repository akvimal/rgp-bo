-- 192: the sale bill's own layout settings, kept as one profile on the business (printer, "Amount in words", the sign after the business name, social handles,
-- the "Next refill" line). Apart from the business's other details so another printer (a line / thermal printer) can get its own profile later.
-- Null reads as the standard bill: no amount in words, no sign, no handles, the refill line on. Additive and re-runnable.
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS bill_layout jsonb NULL;
