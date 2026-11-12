-- 185 rollback: no vendor take-back setting, no out-passes, no disposal register. Stock adjustments posted for confirmed passes stay (they lose their link).
DROP INDEX IF EXISTS public.product_qtychange_pass_idx;
ALTER TABLE public.product_qtychange DROP COLUMN IF EXISTS disposal_pass_id;
DROP TABLE IF EXISTS public.schedule_disposal_register;
DROP TABLE IF EXISTS public.disposal_pass_line;
DROP TABLE IF EXISTS public.disposal_pass;
ALTER TABLE public.vendor DROP CONSTRAINT IF EXISTS vendor_takes_back_chk;
ALTER TABLE public.vendor DROP COLUMN IF EXISTS takeback_days;
ALTER TABLE public.vendor DROP COLUMN IF EXISTS takes_back;
