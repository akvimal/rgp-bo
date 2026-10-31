-- 131: a bill can show more than one phone number, and the business has a phone of its own (the bill falls back to it when the store has none).
ALTER TABLE public.stores ALTER COLUMN phone TYPE character varying(60);
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS phone character varying(60);
