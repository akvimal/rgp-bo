ALTER TABLE public.product_qtychange DROP COLUMN IF EXISTS discarded;
ALTER TABLE public.sale_return_item DROP COLUMN IF EXISTS needs_inspection, DROP COLUMN IF EXISTS inspected_by, DROP COLUMN IF EXISTS inspected_on,
  DROP COLUMN IF EXISTS inspection_note, DROP COLUMN IF EXISTS accepted_qty, DROP COLUMN IF EXISTS discarded_qty, DROP COLUMN IF EXISTS settled_by, DROP COLUMN IF EXISTS settled_on;
ALTER TABLE public.stores DROP COLUMN IF EXISTS cash_refund_limit;
DROP TABLE IF EXISTS public.return_category_rule;
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_return_rule_chk;
ALTER TABLE public.product DROP COLUMN IF EXISTS return_rule;
