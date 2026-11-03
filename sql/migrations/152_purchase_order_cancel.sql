-- 152: a purchase order that was submitted but not yet invoiced can be cancelled (voided): the order stays on record as CANCELLED with who, when and why.
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS cancelled_on timestamptz;
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS cancelled_by integer;
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS cancel_reason text;
