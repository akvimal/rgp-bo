DROP INDEX IF EXISTS public.purchase_request_store_idx;
DROP INDEX IF EXISTS public.purchase_request_group_idx;
ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS store_id;
ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS group_id;
DROP TABLE IF EXISTS public.purchase_request_group;
