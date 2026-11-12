-- 182 rollback: the invoice item loses its purchase-order expectation and off-order mark.
ALTER TABLE public.purchase_invoice_item DROP COLUMN IF EXISTS po_expect;
ALTER TABLE public.purchase_invoice_item DROP COLUMN IF EXISTS off_po;
ALTER TABLE public.purchase_invoice_item DROP COLUMN IF EXISTS off_po_reason;
