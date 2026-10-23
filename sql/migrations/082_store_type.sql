-- 082: what kind of store this is. A pharmacy store has a pharmacist (registration is recorded for its staff); an "other" store (a warehouse, a general shop) does not. Existing stores are pharmacies.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS store_type varchar(10) NOT NULL DEFAULT 'pharmacy';
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_store_type_chk;
ALTER TABLE public.stores ADD CONSTRAINT stores_store_type_chk CHECK (store_type IN ('pharmacy', 'other'));
