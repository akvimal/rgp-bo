-- rollback of 152 (orders already CANCELLED keep that status)
ALTER TABLE public.purchase_order DROP COLUMN IF EXISTS cancel_reason, DROP COLUMN IF EXISTS cancelled_by, DROP COLUMN IF EXISTS cancelled_on;
