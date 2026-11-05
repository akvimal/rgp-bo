-- rollback of 157 (a draft with no number would have to be given one first)
ALTER TABLE public.purchase_invoice DROP CONSTRAINT IF EXISTS purchase_invoice_ref_chk;
ALTER TABLE public.purchase_invoice ADD CONSTRAINT purchase_invoice_ref_chk CHECK (invoice_no IS NOT NULL OR challan_no IS NOT NULL);
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS scan_meta;
DROP TABLE IF EXISTS public.purchase_invoice_scan_line;
