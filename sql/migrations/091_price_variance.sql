-- 091: a vendor's rate change is seen, explained and, when large, approved before an invoice is completed.
--  * purchase_invoice_item keeps what the line was compared with (the vendor's previous net rate and its date), the change in
--    percent, the reason the receiver gave, and who approved a large rise. Filled when the invoice is completed.
--  * app_setting purchases/price_tolerance_pct: a rise up to this passes silently (default 0.5).
--  * app_setting purchases/price_approval_pct: a rise above this needs a Store Head or Business Head to complete (default 5).
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS prev_rate numeric(12,2) NULL;
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS prev_rate_date date NULL;
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS rate_change_pcnt numeric(7,2) NULL;
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS price_reason varchar(20) NULL;
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS price_approved_by int4 NULL;
ALTER TABLE public.purchase_invoice_item ADD COLUMN IF NOT EXISTS price_approved_on timestamptz NULL;
ALTER TABLE public.purchase_invoice_item DROP CONSTRAINT IF EXISTS purchase_invoice_item_price_reason_chk;
ALTER TABLE public.purchase_invoice_item ADD CONSTRAINT purchase_invoice_item_price_reason_chk
  CHECK (price_reason IS NULL OR price_reason IN ('PRICE_REVISED', 'NEW_BATCH', 'SCHEME_ENDED', 'VENDOR_ERROR'));

CREATE INDEX IF NOT EXISTS purchase_invoice_item_product_idx ON public.purchase_invoice_item (product_id, invoice_id);

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES
  ('purchases', 'price_tolerance_pct', '0.5', 'A vendor rate rise up to this percent passes without a reason', true, false, 1, 1),
  ('purchases', 'price_approval_pct', '5', 'A vendor rate rise above this percent needs a Store Head or Business Head to complete the invoice', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
