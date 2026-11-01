-- rollback of 143
ALTER TABLE public.business DROP COLUMN IF EXISTS bill_show_return_note;
ALTER TABLE public.business DROP COLUMN IF EXISTS bill_return_note;
