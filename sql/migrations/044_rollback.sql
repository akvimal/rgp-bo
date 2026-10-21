ALTER TABLE public.vendor DROP CONSTRAINT IF EXISTS vendor_block_reason_chk;
ALTER TABLE public.vendor DROP COLUMN IF EXISTS blocked, DROP COLUMN IF EXISTS block_reason,
  DROP COLUMN IF EXISTS blocked_on, DROP COLUMN IF EXISTS blocked_by;
