-- rollback of 138 (lines in dispute or rejected go back to NEW so no line is stranded)
UPDATE public.purchase_invoice_item SET status = 'NEW', total = COALESCE(rejected_total, total) WHERE status IN ('DISPUTED', 'REJECTED');
ALTER TABLE public.purchase_invoice_item
  DROP COLUMN IF EXISTS dispute_note, DROP COLUMN IF EXISTS dispute_by, DROP COLUMN IF EXISTS dispute_on,
  DROP COLUMN IF EXISTS dispute_result, DROP COLUMN IF EXISTS dispute_result_note, DROP COLUMN IF EXISTS dispute_result_by,
  DROP COLUMN IF EXISTS dispute_result_on, DROP COLUMN IF EXISTS rejected_total;
DELETE FROM public.app_setting WHERE setting_key IN ('purchase_tax_rates', 'mrp_rate_flag_ratio');
