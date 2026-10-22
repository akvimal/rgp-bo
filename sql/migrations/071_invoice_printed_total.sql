-- 071_invoice_printed_total.sql
-- The total printed on the vendor's invoice, entered with the header, so the lines can be checked against it before the
-- stock is received (purchase_invoice.total is the sum of the lines and follows them). And the path of the invoice copy
-- (a PDF or photo) attached to the invoice, which is also what a later upload-and-read step works from.
ALTER TABLE public.purchase_invoice
  ADD COLUMN IF NOT EXISTS printed_total  double precision,
  ADD COLUMN IF NOT EXISTS document_path  varchar(300);
