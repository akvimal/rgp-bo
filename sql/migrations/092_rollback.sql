-- refuses (NOT NULL fails) while any receipt is still awaiting its invoice number: enter or remove those first
DROP INDEX IF EXISTS public.purchase_invoice_awaiting_idx;
DROP INDEX IF EXISTS public.purchase_invoice_challan_un;
ALTER TABLE public.purchase_invoice DROP CONSTRAINT IF EXISTS purchase_invoice_ref_chk;
ALTER TABLE public.purchase_invoice DROP COLUMN IF EXISTS challan_no, DROP COLUMN IF EXISTS challan_date, DROP COLUMN IF EXISTS challan_path;
ALTER TABLE public.purchase_invoice ALTER COLUMN invoice_no SET NOT NULL;
