-- 093: a line whose MRP jumps against the product's last purchase (a box of 10 bought one time, single pieces the next) is
-- usually a pack/unit change, not a price change. The receiver confirms it with the reason UNIT_CHANGED, and the product's
-- pack size is then checked.
ALTER TABLE public.purchase_invoice_item DROP CONSTRAINT IF EXISTS purchase_invoice_item_price_reason_chk;
ALTER TABLE public.purchase_invoice_item ADD CONSTRAINT purchase_invoice_item_price_reason_chk
  CHECK (price_reason IS NULL OR price_reason IN ('PRICE_REVISED', 'NEW_BATCH', 'SCHEME_ENDED', 'VENDOR_ERROR', 'UNIT_CHANGED'));
