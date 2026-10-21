-- 044_vendor_block.sql
-- Vendor states. A vendor can be:
--   active   - normal;
--   blocked  - on hold: still listed, history and dues untouched, payments still allowed, but no new purchase
--              requests, purchase orders or invoices (e.g. licence expired, quality or billing dispute);
--   disabled - retired (active = false): hidden from pick lists, can be enabled again.
-- A block always carries a reason, who set it and when.
ALTER TABLE public.vendor
  ADD COLUMN IF NOT EXISTS blocked      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason varchar(200),
  ADD COLUMN IF NOT EXISTS blocked_on   timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by   int4 REFERENCES public.app_user(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_block_reason_chk') THEN
    ALTER TABLE public.vendor ADD CONSTRAINT vendor_block_reason_chk
      CHECK (NOT blocked OR coalesce(btrim(block_reason), '') <> '');
  END IF;
END $$;
