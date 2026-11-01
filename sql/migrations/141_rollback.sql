-- rollback of 141
ALTER TABLE public.business DROP COLUMN IF EXISTS bill_show_mrp, DROP COLUMN IF EXISTS bill_show_saving;
