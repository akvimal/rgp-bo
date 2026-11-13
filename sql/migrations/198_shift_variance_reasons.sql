-- 198: why a shift's cash drawer did not match. When the counted cash differs from the expected cash at close, the person says why;
-- the reason for each digital provider's difference is kept inside closing_digital (a "reason" next to provider/system/counted/variance).
-- Additive and re-runnable.

ALTER TABLE public.store_shifts ADD COLUMN IF NOT EXISTS cash_variance_reason varchar(300) NULL;
