UPDATE public.purchase_invoice_item SET price_reason = NULL WHERE price_reason = 'UNIT_CHANGED';
ALTER TABLE public.purchase_invoice_item DROP CONSTRAINT IF EXISTS purchase_invoice_item_price_reason_chk;
ALTER TABLE public.purchase_invoice_item ADD CONSTRAINT purchase_invoice_item_price_reason_chk
  CHECK (price_reason IS NULL OR price_reason IN ('PRICE_REVISED', 'NEW_BATCH', 'SCHEME_ENDED', 'VENDOR_ERROR'));
