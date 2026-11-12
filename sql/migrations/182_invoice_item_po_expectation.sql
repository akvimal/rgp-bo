-- 182: an invoice raised against a purchase order brings the order's lines in and remembers what each line was expected to be (qty still to come, rate, MRP,
-- discount, GST) so a difference from the vendor's invoice can be shown. A line that was not on the order is marked off_po, with the reason it was received.
-- Safe to run twice.
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS po_expect jsonb;
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS off_po boolean NOT NULL DEFAULT false;
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS off_po_reason varchar(200);
