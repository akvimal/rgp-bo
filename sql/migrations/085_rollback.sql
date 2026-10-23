-- Rollback of 085. Requests that were raised for an unlisted product have no product to fall back to: remove them first.
DELETE FROM public.purchase_request WHERE product_id IS NULL;
ALTER TABLE public.purchase_request DROP CONSTRAINT IF EXISTS purchase_request_product_or_name_chk;
ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS requested_name;
