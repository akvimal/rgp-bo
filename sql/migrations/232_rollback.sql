-- Rollback of 232: the not-delivered records go. Lines already moved to other orders stay where they are.
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS undelivered_checked_qty;
ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS moved_note;
ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS moved_from_request_id;
ALTER TABLE public.purchase_request DROP COLUMN IF EXISTS not_delivered_qty;
