-- 186: old stock adjustments that look like expiry write-offs (made before out-passes existed, under other reasons) can be reviewed and tagged: confirmed as expiry or not
-- expiry. Nothing about the adjustment itself changes; the tag only says how the write-off is read in the expiry statement. Safe to run twice.
ALTER TABLE public.product_qtychange ADD COLUMN IF NOT EXISTS expiry_tag varchar(12);
ALTER TABLE public.product_qtychange ADD COLUMN IF NOT EXISTS expiry_tagged_by int4 REFERENCES public.app_user(id);
ALTER TABLE public.product_qtychange ADD COLUMN IF NOT EXISTS expiry_tagged_on timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_qtychange_expiry_tag_chk') THEN
    ALTER TABLE public.product_qtychange ADD CONSTRAINT product_qtychange_expiry_tag_chk CHECK (expiry_tag IS NULL OR expiry_tag IN ('EXPIRY', 'NOT_EXPIRY'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS product_qtychange_expiry_tag_idx ON public.product_qtychange (expiry_tag) WHERE expiry_tag IS NOT NULL;
