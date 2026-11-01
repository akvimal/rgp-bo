-- rollback of 139
DROP INDEX IF EXISTS public.product_qtychange_audit_idx;
ALTER TABLE public.product_qtychange DROP COLUMN IF EXISTS audit_id, DROP COLUMN IF EXISTS settle_note, DROP COLUMN IF EXISTS settled_by, DROP COLUMN IF EXISTS settled_on;
