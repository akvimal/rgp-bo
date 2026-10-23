-- 076: modules on/off per business (OPERATING_MODES step 3). A key that is absent means on, so every existing business keeps everything.
--   {"hr": false, "purchasing": "simple", "gst": false, "expenses": true, "payment_recon": true, "stock_audits": false, "transfers": false}
-- purchasing is off, simple (invoices, vendors, payments) or full (adds requests, orders, suggestions, payables).
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS modules jsonb NOT NULL DEFAULT '{}'::jsonb;
