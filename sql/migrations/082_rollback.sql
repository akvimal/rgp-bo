ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_store_type_chk;
ALTER TABLE public.stores DROP COLUMN IF EXISTS store_type;
