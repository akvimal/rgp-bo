DELETE FROM public.app_setting WHERE setting_key IN ('invoice_approval', 'invoice_approval_limit');
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS approval_note;
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS approved_on;
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS approved_by;
