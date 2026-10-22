-- 072_invoice_cash_discount.sql
-- A vendor invoice can carry a discount at the foot ("Less CD 4.00 %  48.94") that is not a line. The amount is kept with the
-- invoice so the lines can be checked against the printed total after it. purchase_invoice.total (the sum of the lines) is unchanged.
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS cash_discount double precision;
