DELETE FROM public.app_setting WHERE setting_key IN ('price_tolerance_pct', 'price_approval_pct');
DROP INDEX IF EXISTS public.purchase_invoice_item_product_idx;
ALTER TABLE public.purchase_invoice_item DROP CONSTRAINT IF EXISTS purchase_invoice_item_price_reason_chk;
ALTER TABLE public.purchase_invoice_item DROP COLUMN IF EXISTS prev_rate, DROP COLUMN IF EXISTS prev_rate_date, DROP COLUMN IF EXISTS rate_change_pcnt,
  DROP COLUMN IF EXISTS price_reason, DROP COLUMN IF EXISTS price_approved_by, DROP COLUMN IF EXISTS price_approved_on;
