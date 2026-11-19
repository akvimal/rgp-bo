-- Rollback of 231: the amendment records go. Orders keep whatever status they have; items added after submission stay on them.
ALTER TABLE public.purchase_order DROP COLUMN IF EXISTS amendments;
