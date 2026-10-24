-- 092: goods can be received on the vendor's delivery challan, with the invoice number entered later.
--  * invoice_no may be empty. A receipt with no invoice number is "awaiting invoice": it is stock and a cost, but not yet
--    payable and not yet in GST (its gst_period stays empty until the number is entered).
--  * challan_no / challan_date / challan_path record the delivery challan (and a photo of it).
--  * Every receipt needs a reference: an invoice number, a challan number, or both.
--  * The same challan number from the same vendor twice is refused, as an invoice number already is.
ALTER TABLE public.purchase_invoice ALTER COLUMN invoice_no DROP NOT NULL;
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS challan_no varchar(60) NULL;
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS challan_date date NULL;
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS challan_path varchar(300) NULL;

-- a blank invoice number means "not entered yet", never an empty string
UPDATE public.purchase_invoice SET invoice_no = NULL WHERE btrim(invoice_no) = '';

ALTER TABLE public.purchase_invoice DROP CONSTRAINT IF EXISTS purchase_invoice_ref_chk;
ALTER TABLE public.purchase_invoice ADD CONSTRAINT purchase_invoice_ref_chk CHECK (invoice_no IS NOT NULL OR challan_no IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_invoice_challan_un ON public.purchase_invoice (vendor_id, upper(challan_no)) WHERE challan_no IS NOT NULL AND active AND NOT archive;
CREATE INDEX IF NOT EXISTS purchase_invoice_awaiting_idx ON public.purchase_invoice (vendor_id, invoice_date) WHERE invoice_no IS NULL;
