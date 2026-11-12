-- 186 rollback: old adjustments are no longer tagged as expiry or not expiry.
DROP INDEX IF EXISTS public.product_qtychange_expiry_tag_idx;
ALTER TABLE public.product_qtychange DROP CONSTRAINT IF EXISTS product_qtychange_expiry_tag_chk;
ALTER TABLE public.product_qtychange DROP COLUMN IF EXISTS expiry_tagged_on;
ALTER TABLE public.product_qtychange DROP COLUMN IF EXISTS expiry_tagged_by;
ALTER TABLE public.product_qtychange DROP COLUMN IF EXISTS expiry_tag;
